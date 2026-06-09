import { cache } from "react";
import { and, eq, gte, inArray, lt, ne, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  investorAgreements,
  investorPayouts,
  investors,
  orderItems,
  orders,
} from "@/db/schema";
import { ensureDefaultAgreement } from "@/db/queries/investor-setup";
import { effectiveQuantity, type SaleUnit } from "@/lib/order-line-math";
import {
  phMonthBounds,
  phMonthKey,
  phMonthLabel,
  phNow,
} from "@/lib/ph-time";

function orderCreatedMsColumn() {
  return sql<number>`CASE WHEN ${orders.createdAt} < 1000000000000 THEN ${orders.createdAt} * 1000 ELSE ${orders.createdAt} END`;
}

function normalizeOrderCreatedAt(raw: Date | number | string): Date {
  if (raw instanceof Date) {
    const ms = raw.getTime();
    if (ms > 0 && ms < 1_000_000_000_000) return new Date(ms * 1000);
    return raw;
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) return new Date(raw);
  if (n > 0 && n < 1_000_000_000_000) return new Date(n * 1000);
  return new Date(n);
}

export type MonthlyNetIncome = {
  grossRevenueCents: number;
  cogsCents: number;
  netIncomeCents: number;
  orderCount: number;
};

export type MonthPeriod = { year: number; month: number };

export type MonthKey = `${number}-${number}`;

const EMPTY_MONTH: MonthlyNetIncome = {
  grossRevenueCents: 0,
  cogsCents: 0,
  netIncomeCents: 0,
  orderCount: 0,
};

export function monthKey(year: number, month: number): MonthKey {
  return `${year}-${month}`;
}

function monthBounds(year: number, month: number) {
  return phMonthBounds(year, month);
}

function lineCogs(line: {
  quantity: number;
  quantityTenths: number | null;
  saleUnit: string;
  unitCost: number;
  isExcessSale: boolean;
}) {
  if (line.isExcessSale) return 0;
  const qty = effectiveQuantity(
    line.quantity,
    line.saleUnit as SaleUnit,
    line.quantityTenths,
  );
  return Math.round(line.unitCost * qty);
}

function metricsForPaidOrders(
  paidOrders: Array<{
    id: number;
    totalAmount: number;
    amountPaid: number;
  }>,
  cogsByOrder: Map<number, number>,
): MonthlyNetIncome {
  if (paidOrders.length === 0) return EMPTY_MONTH;

  let grossRevenueCents = 0;
  let cogsCents = 0;
  for (const order of paidOrders) {
    grossRevenueCents += order.amountPaid;
    const fullCogs = cogsByOrder.get(order.id) ?? 0;
    if (order.totalAmount > 0 && order.amountPaid < order.totalAmount) {
      cogsCents += Math.round((fullCogs * order.amountPaid) / order.totalAmount);
    } else {
      cogsCents += fullCogs;
    }
  }

  return {
    grossRevenueCents,
    cogsCents,
    netIncomeCents: grossRevenueCents - cogsCents,
    orderCount: paidOrders.length,
  };
}

/** Compute net income for many months in two DB queries (orders + lines). */
export async function computeMonthlyNetIncomeBatch(months: MonthPeriod[]) {
  const result = new Map<MonthKey, MonthlyNetIncome>();
  if (months.length === 0) return result;

  for (const m of months) {
    result.set(monthKey(m.year, m.month), { ...EMPTY_MONTH });
  }

  let rangeStart = monthBounds(months[0]!.year, months[0]!.month).start;
  let rangeEnd = monthBounds(months[0]!.year, months[0]!.month).end;
  for (const m of months) {
    const { start, end } = monthBounds(m.year, m.month);
    if (start < rangeStart) rangeStart = start;
    if (end > rangeEnd) rangeEnd = end;
  }

  const createdMs = orderCreatedMsColumn();
  const monthOrders = await db
    .select({
      id: orders.id,
      totalAmount: orders.totalAmount,
      amountPaid: orders.amountPaid,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(
      and(
        sql`${createdMs} >= ${rangeStart.getTime()}`,
        sql`${createdMs} < ${rangeEnd.getTime()}`,
        ne(orders.orderStatus, "Cancelled"),
      ),
    );

  const paidOrders = monthOrders.filter((o) => o.amountPaid > 0);
  if (paidOrders.length === 0) return result;

  const paidByMonth = new Map<MonthKey, typeof paidOrders>();
  for (const order of paidOrders) {
    const created = normalizeOrderCreatedAt(order.createdAt);
    const key = phMonthKey(created) as MonthKey;
    if (!result.has(key)) continue;
    const arr = paidByMonth.get(key) ?? [];
    arr.push(order);
    paidByMonth.set(key, arr);
  }

  const orderIds = paidOrders.map((o) => o.id);
  const lines = await db
    .select({
      orderId: orderItems.orderId,
      quantity: orderItems.quantity,
      quantityTenths: orderItems.quantityTenths,
      saleUnit: orderItems.saleUnit,
      unitCost: orderItems.unitCost,
      isExcessSale: orderItems.isExcessSale,
    })
    .from(orderItems)
    .where(inArray(orderItems.orderId, orderIds));

  const cogsByOrder = new Map<number, number>();
  for (const line of lines) {
    cogsByOrder.set(
      line.orderId,
      (cogsByOrder.get(line.orderId) ?? 0) + lineCogs(line),
    );
  }

  for (const [key, ordersInMonth] of paidByMonth) {
    result.set(key, metricsForPaidOrders(ordersInMonth, cogsByOrder));
  }

  return result;
}

/** Net income for one month — uses cash collected minus prorated COGS. */
export async function computeMonthlyNetIncome(year: number, month: number) {
  const batch = await computeMonthlyNetIncomeBatch([{ year, month }]);
  return batch.get(monthKey(year, month)) ?? EMPTY_MONTH;
}

export function investorShareCents(netIncomeCents: number, sharePercent: number) {
  return Math.round((netIncomeCents * sharePercent) / 100);
}

export type InvestorSummary = {
  hasSetup: boolean;
  investorName: string | null;
  sharePercent: number | null;
  capitalCents: number | null;
  currentMonthLabel: string;
  currentGrossCents: number;
  currentNetCents: number;
  currentShareCents: number;
  currentOrderCount: number;
  paidOutYtdCents: number;
  accruedUnpaidCents: number;
};

export const getInvestorSummary = cache(async (): Promise<InvestorSummary | null> => {
  const [investor] = await db
    .select()
    .from(investors)
    .where(eq(investors.active, true))
    .orderBy(investors.fullName)
    .limit(1);

  if (!investor) return null;

  await ensureDefaultAgreement(investor.id);

  const { year, month } = phNow();
  const currentMonthLabel = phMonthLabel(year, month);

  const [agreement, payouts, metricsBatch] = await Promise.all([
    db
      .select()
      .from(investorAgreements)
      .where(
        and(
          eq(investorAgreements.investorId, investor.id),
          eq(investorAgreements.active, true),
        ),
      )
      .limit(1)
      .then((rows) => rows[0]),
    db
      .select({
        payoutCents: investorPayouts.payoutCents,
        status: investorPayouts.status,
        periodYear: investorPayouts.periodYear,
      })
      .from(investorPayouts)
      .where(eq(investorPayouts.investorId, investor.id)),
    computeMonthlyNetIncomeBatch([{ year, month }]),
  ]);

  if (!agreement) {
    return {
      hasSetup: false,
      investorName: investor.fullName,
      sharePercent: null,
      capitalCents: null,
      currentMonthLabel,
      currentGrossCents: 0,
      currentNetCents: 0,
      currentShareCents: 0,
      currentOrderCount: 0,
      paidOutYtdCents: 0,
      accruedUnpaidCents: 0,
    };
  }

  const metrics = metricsBatch.get(monthKey(year, month)) ?? EMPTY_MONTH;
  const currentShareCents = investorShareCents(
    metrics.netIncomeCents,
    agreement.sharePercent,
  );

  const paidOutYtdCents = payouts
    .filter((p) => p.periodYear === year && p.status === "Paid")
    .reduce((s, p) => s + p.payoutCents, 0);

  const accruedUnpaidCents = payouts
    .filter((p) => p.status === "Accrued")
    .reduce((s, p) => s + p.payoutCents, 0);

  return {
    hasSetup: true,
    investorName: investor.fullName,
    sharePercent: agreement.sharePercent,
    capitalCents: agreement.capitalCents,
    currentMonthLabel,
    currentGrossCents: metrics.grossRevenueCents,
    currentNetCents: metrics.netIncomeCents,
    currentShareCents,
    currentOrderCount: metrics.orderCount,
    paidOutYtdCents,
    accruedUnpaidCents,
  };
});
