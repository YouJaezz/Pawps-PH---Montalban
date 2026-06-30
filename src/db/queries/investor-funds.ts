import { cache } from "react";
import { desc, sql } from "drizzle-orm";

import { db } from "@/db";
import { investorFunds } from "@/db/schema";
import { phMonthBounds, phNow } from "@/lib/ph-time";

export type InvestorFundsRow = {
  id: number;
  investorName: string;
  amountCents: number;
  type: "contribution" | "leftover" | "return" | string;
  date: string;
  notes: string | null;
};

export const getInvestorFundsDashboard = cache(async () => {
  const now = phNow();
  const { start: monthStart, end: monthEnd } = phMonthBounds(now.year, now.month);
  const monthStartMs = monthStart.getTime();
  const monthEndMs = monthEnd.getTime();

  const monthFilter = sql`${investorFunds.date} >= ${new Date(monthStartMs)} AND ${investorFunds.date} < ${new Date(monthEndMs)}`;

  const [allTime, thisMonth, rawEntries] = await Promise.all([
    db
      .select({
        inCents: sql<number>`coalesce(sum(case when ${investorFunds.type} in ('contribution','leftover') then ${investorFunds.amountCents} else 0 end), 0)`,
        outCents: sql<number>`coalesce(sum(case when ${investorFunds.type} = 'return' then ${investorFunds.amountCents} else 0 end), 0)`,
        entryCount: sql<number>`count(*)`,
      })
      .from(investorFunds)
      .then((rows) => rows[0]),
    db
      .select({
        inCents: sql<number>`coalesce(sum(case when ${investorFunds.type} in ('contribution','leftover') then ${investorFunds.amountCents} else 0 end), 0)`,
        outCents: sql<number>`coalesce(sum(case when ${investorFunds.type} = 'return' then ${investorFunds.amountCents} else 0 end), 0)`,
        entryCount: sql<number>`count(*)`,
      })
      .from(investorFunds)
      .where(monthFilter)
      .then((rows) => rows[0]),
    db.select().from(investorFunds).orderBy(desc(investorFunds.date), desc(investorFunds.id)).limit(80),
  ]);

  const allIn = Number(allTime?.inCents ?? 0);
  const allOut = Number(allTime?.outCents ?? 0);
  const monthIn = Number(thisMonth?.inCents ?? 0);
  const monthOut = Number(thisMonth?.outCents ?? 0);

  const entries: InvestorFundsRow[] = rawEntries.map((e) => ({
    id: e.id,
    investorName: e.investorName,
    amountCents: e.amountCents,
    type: e.type,
    date: e.date.toISOString(),
    notes: e.notes,
  }));

  return {
    allTime: {
      inCents: allIn,
      outCents: allOut,
      balanceCents: allIn - allOut,
      entryCount: Number(allTime?.entryCount ?? 0),
    },
    thisMonth: {
      inCents: monthIn,
      outCents: monthOut,
      netCents: monthIn - monthOut,
      entryCount: Number(thisMonth?.entryCount ?? 0),
    },
    entries,
  };
});

