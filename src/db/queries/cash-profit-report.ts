import { cache } from "react";
import { and, ne, sql } from "drizzle-orm";

import { db } from "@/db";
import { orders } from "@/db/schema";
import {
  getActiveInventoryProducts,
  inventoryValuationFromRows,
} from "@/db/queries/inventory-products";
import {
  computeMonthlyNetIncomeBatch,
  computeProfitForDateRange,
  monthKey,
  type MonthlyNetIncome,
} from "@/lib/investor-income";
import { orderCreatedMsColumn } from "@/lib/order-timestamp";
import { phMonthLabel, phNow, phStartOfToday } from "@/lib/ph-time";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type PeriodSnapshot = MonthlyNetIncome & {
  label: string;
};

function emptyPeriod(label: string): PeriodSnapshot {
  return {
    label,
    grossRevenueCents: 0,
    cogsCents: 0,
    netIncomeCents: 0,
    orderCount: 0,
  };
}

export const getCashProfitReport = cache(async () => {
  const now = phNow();
  const todayStart = phStartOfToday();
  const todayMs = todayStart.getTime();
  const last7Ms = todayMs - 6 * MS_PER_DAY;
  const last30Ms = todayMs - 29 * MS_PER_DAY;
  const createdMs = orderCreatedMsColumn();
  const activeOrders = ne(orders.orderStatus, "Cancelled");

  const [cashRow, inventoryProducts, todayProfit, last7Profit, last30Profit, monthBatch] =
    await Promise.all([
      db
        .select({
          cashInHandCents: sql<number>`coalesce(sum(${orders.amountPaid}), 0)`,
          totalBilledCents: sql<number>`coalesce(sum(${orders.totalAmount}), 0)`,
          receivablesCents: sql<number>`coalesce(sum(${orders.totalAmount} - ${orders.amountPaid}), 0)`,
          orderCount: sql<number>`count(*)`,
        })
        .from(orders)
        .where(activeOrders)
        .then((rows) => rows[0]),
      getActiveInventoryProducts(),
      computeProfitForDateRange(todayMs, todayMs + MS_PER_DAY),
      computeProfitForDateRange(last7Ms, todayMs + MS_PER_DAY),
      computeProfitForDateRange(last30Ms, todayMs + MS_PER_DAY),
      computeMonthlyNetIncomeBatch([{ year: now.year, month: now.month }]),
    ]);

  const inventory = inventoryValuationFromRows(inventoryProducts);
  const thisMonth =
    monthBatch.get(monthKey(now.year, now.month)) ?? emptyPeriod("This month");
  const monthLabel = phMonthLabel(now.year, now.month);

  const periods: PeriodSnapshot[] = [
    { label: "Today", ...todayProfit },
    { label: "Last 7 days", ...last7Profit },
    { label: "Last 30 days", ...last30Profit },
    { label: monthLabel, ...thisMonth },
  ];

  return {
    monthLabel,
    cash: {
      cashInHandCents: Number(cashRow?.cashInHandCents ?? 0),
      receivablesCents: Number(cashRow?.receivablesCents ?? 0),
      totalBilledCents: Number(cashRow?.totalBilledCents ?? 0),
      activeOrderCount: Number(cashRow?.orderCount ?? 0),
    },
    thisMonth: {
      ...thisMonth,
      label: monthLabel,
    },
    periods,
    inventoryCapitalCents: inventory.stockValueCents,
  };
});
