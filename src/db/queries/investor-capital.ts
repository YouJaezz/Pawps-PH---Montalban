import { cache } from "react";
import { desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { investorCapitalLedger, investors, shopCashOutflows } from "@/db/schema";
import { phMonthBounds, phNow } from "@/lib/ph-time";

export type InvestorCapitalContributionRow = {
  id: number;
  amountCents: number;
  description: string;
  contributedAt: string;
  investorName: string | null;
  notes: string | null;
};

export async function getInvestorCapitalSpentCents() {
  const [row] = await db
    .select({
      totalCents: sql<number>`coalesce(sum(${shopCashOutflows.amountCents}), 0)`,
    })
    .from(shopCashOutflows)
    .where(eq(shopCashOutflows.fundingSource, "investor_capital"));
  return Number(row?.totalCents ?? 0);
}

export const getInvestorCapitalDashboard = cache(async () => {
  const now = phNow();
  const { start: monthStart, end: monthEnd } = phMonthBounds(now.year, now.month);

  const [contribRow, spentCents, rawContributions, thisMonthSpent] = await Promise.all([
    db
      .select({
        totalCents: sql<number>`coalesce(sum(${investorCapitalLedger.amountCents}), 0)`,
        entryCount: sql<number>`count(*)`,
      })
      .from(investorCapitalLedger)
      .then((rows) => rows[0]),
    getInvestorCapitalSpentCents(),
    db
      .select()
      .from(investorCapitalLedger)
      .orderBy(desc(investorCapitalLedger.contributedAt), desc(investorCapitalLedger.id))
      .limit(30),
    db
      .select({
        totalCents: sql<number>`coalesce(sum(${shopCashOutflows.amountCents}), 0)`,
      })
      .from(shopCashOutflows)
      .where(
        sql`${shopCashOutflows.fundingSource} = 'investor_capital'
          AND ${shopCashOutflows.paidAt} >= ${monthStart}
          AND ${shopCashOutflows.paidAt} < ${monthEnd}`,
      )
      .then((rows) => rows[0]),
  ]);

  const contributedCents = Number(contribRow?.totalCents ?? 0);
  const balanceCents = contributedCents - spentCents;

  const investorIds = [
    ...new Set(
      rawContributions.map((c) => c.investorId).filter((id): id is number => id != null),
    ),
  ];

  const investorRows =
    investorIds.length > 0
      ? await db
          .select({ id: investors.id, fullName: investors.fullName })
          .from(investors)
          .where(inArray(investors.id, investorIds))
      : [];

  const investorName = new Map(investorRows.map((i) => [i.id, i.fullName]));

  const contributions: InvestorCapitalContributionRow[] = rawContributions.map((c) => ({
    id: c.id,
    amountCents: c.amountCents,
    description: c.description,
    contributedAt: c.contributedAt.toISOString(),
    investorName: c.investorId ? (investorName.get(c.investorId) ?? null) : null,
    notes: c.notes,
  }));

  return {
    contributedCents,
    spentCents,
    balanceCents,
    contributionCount: Number(contribRow?.entryCount ?? 0),
    thisMonthSpentCents: Number(thisMonthSpent?.totalCents ?? 0),
    contributions,
  };
});
