import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  investorAgreements,
  investorPayouts,
  investors,
} from "@/db/schema";
import {
  computeMonthlyNetIncome,
  investorShareCents,
} from "@/lib/investor-income";

export type InvestorMonthlyRow = {
  year: number;
  month: number;
  label: string;
  grossRevenueCents: number;
  cogsCents: number;
  netIncomeCents: number;
  sharePercent: number;
  payoutCents: number;
  payoutId: number | null;
  /** Open = past month, not locked yet · Projected = current month · Accrued/Paid = locked in DB */
  payoutStatus: "Open" | "Projected" | "Accrued" | "Paid";
  canAccrue: boolean;
};

export async function getInvestorDashboard() {
  const investorRows = await db
    .select()
    .from(investors)
    .where(eq(investors.active, true))
    .orderBy(investors.fullName);

  const agreements = await db
    .select()
    .from(investorAgreements)
    .where(eq(investorAgreements.active, true));

  const agreementByInvestor = new Map(
    agreements.map((a) => [a.investorId, a]),
  );

  const payouts = await db
    .select()
    .from(investorPayouts)
    .orderBy(
      desc(investorPayouts.periodYear),
      desc(investorPayouts.periodMonth),
    );

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const primary = investorRows[0] ?? null;
  const agreement = primary ? agreementByInvestor.get(primary.id) : undefined;

  const monthlyRows: InvestorMonthlyRow[] = [];
  if (agreement && primary) {
    for (let i = 0; i < 6; i++) {
      const d = new Date(currentYear, currentMonth - 1 - i, 1);
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const isCurrentMonth = year === currentYear && month === currentMonth;
      const label = d.toLocaleDateString("en-PH", {
        month: "long",
        year: "numeric",
      });

      const existing = payouts.find(
        (p) =>
          p.investorId === primary.id &&
          p.periodYear === year &&
          p.periodMonth === month,
      );

      if (existing) {
        monthlyRows.push({
          year,
          month,
          label,
          grossRevenueCents: existing.grossRevenueCents,
          cogsCents: existing.cogsCents,
          netIncomeCents: existing.netIncomeCents,
          sharePercent: existing.sharePercent,
          payoutCents: existing.payoutCents,
          payoutId: existing.id,
          payoutStatus: existing.status,
          canAccrue: false,
        });
        continue;
      }

      const metrics = await computeMonthlyNetIncome(year, month);
      const payoutCents = investorShareCents(
        metrics.netIncomeCents,
        agreement.sharePercent,
      );

      monthlyRows.push({
        year,
        month,
        label,
        grossRevenueCents: metrics.grossRevenueCents,
        cogsCents: metrics.cogsCents,
        netIncomeCents: metrics.netIncomeCents,
        sharePercent: agreement.sharePercent,
        payoutCents,
        payoutId: null,
        payoutStatus: isCurrentMonth ? "Projected" : "Open",
        canAccrue: !isCurrentMonth,
      });
    }
  }

  const currentMetrics = agreement
    ? await computeMonthlyNetIncome(currentYear, currentMonth)
    : null;

  const currentShareCents =
    agreement && currentMetrics
      ? investorShareCents(
          currentMetrics.netIncomeCents,
          agreement.sharePercent,
        )
      : 0;

  const investorPayoutsForPrimary = primary
    ? payouts.filter((p) => p.investorId === primary.id)
    : [];

  const paidYtdCents = investorPayoutsForPrimary
    .filter((p) => p.periodYear === currentYear && p.status === "Paid")
    .reduce((sum, p) => sum + p.payoutCents, 0);

  const accruedUnpaidCents = investorPayoutsForPrimary
    .filter((p) => p.status === "Accrued")
    .reduce((sum, p) => sum + p.payoutCents, 0);

  const setupStep = !primary ? 1 : !agreement ? 2 : 3;

  return {
    investors: investorRows,
    primary,
    agreement,
    monthlyRows,
    currentMetrics,
    currentShareCents,
    paidYtdCents,
    accruedUnpaidCents,
    setupStep,
    payoutHistory: investorPayoutsForPrimary,
  };
}
