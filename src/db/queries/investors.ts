import { cache } from "react";
import { and, desc, eq, gt, gte, lt, ne, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  investorAgreements,
  investorPayouts,
  investors,
  orders,
} from "@/db/schema";
import { ensureDefaultAgreement } from "@/db/queries/investor-setup";
import {
  computeMonthlyNetIncomeBatch,
  investorShareCents,
  monthKey,
} from "@/lib/investor-income";
import {
  phIsCurrentMonth,
  phMonthBounds,
  phMonthLabel,
  phNow,
} from "@/lib/ph-time";

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
  liveDiffers: boolean;
  orderCount: number;
};

export type InvestorSalesPreview = {
  monthLabel: string;
  year: number;
  month: number;
  grossRevenueCents: number;
  orderCount: number;
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

function lockedSnapshotStale(
  existing: {
    grossRevenueCents: number;
    netIncomeCents: number;
  },
  metrics: { grossRevenueCents: number; netIncomeCents: number },
) {
  return (
    existing.grossRevenueCents === 0 &&
    metrics.grossRevenueCents > 0 &&
    existing.netIncomeCents === 0
  );
}

export const getInvestorDashboard = cache(async () => {
  const investorRows = await db
    .select()
    .from(investors)
    .where(eq(investors.active, true))
    .orderBy(investors.fullName);

  const primary = investorRows[0] ?? null;

  const agreementRecord = primary
    ? ((await ensureDefaultAgreement(primary.id)) ?? undefined)
    : undefined;

  const [agreements, payouts] = await Promise.all([
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
  const currentMonthLabel = phMonthLabel(currentYear, currentMonth);

  const agreement = primary
    ? (agreementByInvestor.get(primary.id) ?? agreementRecord)
    : undefined;

  const monthPeriods = phMonthPeriods(6);

  const metricsByMonth = await computeMonthlyNetIncomeBatch(monthPeriods);

  const currentMetrics =
    metricsByMonth.get(monthKey(currentYear, currentMonth)) ?? null;

  const salesPreview: InvestorSalesPreview = {
    monthLabel: currentMonthLabel,
    year: currentYear,
    month: currentMonth,
    grossRevenueCents: currentMetrics?.grossRevenueCents ?? 0,
    orderCount: currentMetrics?.orderCount ?? 0,
  };

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

      if (existing && !isCurrentMonth) {
        const stale = lockedSnapshotStale(existing, metrics);
        monthlyRows.push({
          year,
          month,
          label,
          grossRevenueCents: stale
            ? metrics.grossRevenueCents
            : existing.grossRevenueCents,
          cogsCents: stale ? metrics.cogsCents : existing.cogsCents,
          netIncomeCents: stale
            ? metrics.netIncomeCents
            : existing.netIncomeCents,
          sharePercent: existing.sharePercent,
          payoutCents: stale
            ? liveShare
            : existing.payoutCents,
          payoutId: existing.id,
          payoutStatus: existing.status,
          canAccrue: false,
          liveDiffers:
            stale ||
            existing.grossRevenueCents !== metrics.grossRevenueCents ||
            existing.netIncomeCents !== metrics.netIncomeCents,
          orderCount: metrics.orderCount,
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
        orderCount: metrics.orderCount,
      });
    }
  }

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

  // Direct sanity count — same rules as investor income (PH month, cash collected).
  const { start, end } = phMonthBounds(currentYear, currentMonth);
  const createdMs = sql<number>`CASE WHEN ${orders.createdAt} < 1000000000000 THEN ${orders.createdAt} * 1000 ELSE ${orders.createdAt} END`;
  const [sanityRow] = await db
    .select({
      orderCount: sql<number>`count(*)`,
      grossCents: sql<number>`coalesce(sum(${orders.amountPaid}), 0)`,
    })
    .from(orders)
    .where(
      and(
        sql`${createdMs} >= ${start.getTime()}`,
        sql`${createdMs} < ${end.getTime()}`,
        ne(orders.orderStatus, "Cancelled"),
        gt(orders.amountPaid, 0),
      ),
    );

  const sanityOrderCount = Number(sanityRow?.orderCount ?? 0);
  const sanityGrossCents = Number(sanityRow?.grossCents ?? 0);

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
    currentMonthLabel,
    salesPreview,
    sanityOrderCount,
    sanityGrossCents,
  };
});
