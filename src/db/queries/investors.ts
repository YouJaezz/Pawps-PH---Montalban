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
};

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

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const primary = investorRows[0] ?? null;
  const agreement = primary ? agreementByInvestor.get(primary.id) : undefined;

  const monthPeriods = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(currentYear, currentMonth - 1 - i, 1);
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  });

  const metricsByMonth =
    agreement && primary
      ? await computeMonthlyNetIncomeBatch(monthPeriods)
      : new Map();

  const monthlyRows: InvestorMonthlyRow[] = [];
  if (agreement && primary) {
    for (const { year, month } of monthPeriods) {
      const isCurrentMonth = year === currentYear && month === currentMonth;
      const label = new Date(year, month - 1, 1).toLocaleDateString("en-PH", {
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

      const metrics = metricsByMonth.get(monthKey(year, month)) ?? {
        grossRevenueCents: 0,
        cogsCents: 0,
        netIncomeCents: 0,
        orderCount: 0,
      };

      monthlyRows.push({
        year,
        month,
        label,
        grossRevenueCents: metrics.grossRevenueCents,
        cogsCents: metrics.cogsCents,
        netIncomeCents: metrics.netIncomeCents,
        sharePercent: agreement.sharePercent,
        payoutCents: investorShareCents(
          metrics.netIncomeCents,
          agreement.sharePercent,
        ),
        payoutId: null,
        payoutStatus: isCurrentMonth ? "Projected" : "Open",
        canAccrue: !isCurrentMonth,
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
