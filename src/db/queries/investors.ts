import { cache } from "react";
import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  investorAgreements,
  investorPayouts,
  investors,
} from "@/db/schema";
import {
  computeMonthlyNetIncomeBatch,
  investorShareCents,
  monthKey,
} from "@/lib/investor-income";
import { phIsCurrentMonth, phMonthLabel, phNow } from "@/lib/ph-time";

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
  payoutStatus: "Open" | "Projected" | "Accrued" | "Paid";
  canAccrue: boolean;
  /** Locked snapshot differs from live sales (e.g. locked before more orders came in). */
  liveDiffers: boolean;
};

function phMonthPeriods(count: number) {
  const { year: startYear, month: startMonth } = phNow();
  const periods: Array<{ year: number; month: number }> = [];
  for (let i = 0; i < count; i++) {
    let y = startYear;
    let m = startMonth - i;
    while (m <= 0) {
      m += 12;
      y -= 1;
    }
    periods.push({ year: y, month: m });
  }
  return periods;
}

export const getInvestorDashboard = cache(async () => {
  const [investorRows, agreements, payouts] = await Promise.all([
    db
      .select()
      .from(investors)
      .where(eq(investors.active, true))
      .orderBy(investors.fullName),
    db
      .select()
      .from(investorAgreements)
      .where(eq(investorAgreements.active, true)),
    db
      .select()
      .from(investorPayouts)
      .orderBy(
        desc(investorPayouts.periodYear),
        desc(investorPayouts.periodMonth),
      ),
  ]);

  const agreementByInvestor = new Map(
    agreements.map((a) => [a.investorId, a]),
  );

  const { year: currentYear, month: currentMonth } = phNow();

  const primary = investorRows[0] ?? null;
  const agreement = primary ? agreementByInvestor.get(primary.id) : undefined;

  const monthPeriods = phMonthPeriods(6);

  const metricsByMonth =
    agreement && primary
      ? await computeMonthlyNetIncomeBatch(monthPeriods)
      : new Map();

  const monthlyRows: InvestorMonthlyRow[] = [];
  if (agreement && primary) {
    for (const { year, month } of monthPeriods) {
      const isCurrentMonth = phIsCurrentMonth(year, month);
      const label = phMonthLabel(year, month);

      const existing = payouts.find(
        (p) =>
          p.investorId === primary.id &&
          p.periodYear === year &&
          p.periodMonth === month,
      );

      const metrics = metricsByMonth.get(monthKey(year, month)) ?? {
        grossRevenueCents: 0,
        cogsCents: 0,
        netIncomeCents: 0,
        orderCount: 0,
      };

      const liveShare = investorShareCents(
        metrics.netIncomeCents,
        agreement.sharePercent,
      );

      // Current month always shows live sales; past months use locked snapshot when set.
      if (existing && !isCurrentMonth) {
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
          liveDiffers:
            existing.grossRevenueCents !== metrics.grossRevenueCents ||
            existing.netIncomeCents !== metrics.netIncomeCents,
        });
        continue;
      }

      monthlyRows.push({
        year,
        month,
        label,
        grossRevenueCents: metrics.grossRevenueCents,
        cogsCents: metrics.cogsCents,
        netIncomeCents: metrics.netIncomeCents,
        sharePercent: agreement.sharePercent,
        payoutCents: liveShare,
        payoutId: existing?.id ?? null,
        payoutStatus: isCurrentMonth
          ? "Projected"
          : existing
            ? existing.status
            : "Open",
        canAccrue: !isCurrentMonth && !existing,
        liveDiffers: false,
      });
    }
  }

  const currentMetrics = agreement
    ? (metricsByMonth.get(monthKey(currentYear, currentMonth)) ?? null)
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
});
