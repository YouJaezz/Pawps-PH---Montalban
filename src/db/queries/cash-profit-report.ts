import { cache } from "react";
import { and, gte, lt, ne, sql } from "drizzle-orm";

import { db } from "@/db";
import { orders } from "@/db/schema";
import {
  getActiveInventoryProducts,
  inventoryValuationFromRows,
} from "@/db/queries/inventory-products";
import { getShopCashOutflowTotals } from "@/db/queries/shop-cash";
import { getInvestorCapitalDashboard } from "@/db/queries/investor-capital";
import {
  computeMonthlyNetIncomeBatch,
  computeProfitForDateRange,
  monthKey,
  type MonthlyNetIncome,
} from "@/lib/investor-income";
import { orderCreatedMsColumn } from "@/lib/order-timestamp";
import { phMonthBounds, phMonthLabel, phNow, phStartOfToday } from "@/lib/ph-time";

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

  const monthBounds = phMonthBounds(now.year, now.month);
  const monthStartMs = monthBounds.start.getTime();
  const monthEndMs = monthBounds.end.getTime();

  const [cashRow, monthCashRow, inventoryProducts, todayProfit, last7Profit, last30Profit, monthBatch, shopOutflows, shopOutflowsThisMonth, investorCapital] =
    await Promise.all([
      db
        .select({
          cashInHandCents: sql<number>`coalesce(sum(${orders.amountPaid}), 0)`,
          grossSubtotalCents: sql<number>`coalesce(sum(${orders.subtotalCents}), 0)`,
          totalDiscountCents: sql<number>`coalesce(sum(${orders.discountCents}), 0)`,
          totalBilledCents: sql<number>`coalesce(sum(${orders.totalAmount}), 0)`,
          receivablesCents: sql<number>`coalesce(sum(${orders.totalAmount} - ${orders.amountPaid}), 0)`,
          orderCount: sql<number>`count(*)`,
        })
        .from(orders)
        .where(activeOrders)
        .then((rows) => rows[0]),
      db
        .select({
          grossSubtotalCents: sql<number>`coalesce(sum(${orders.subtotalCents}), 0)`,
          totalDiscountCents: sql<number>`coalesce(sum(${orders.discountCents}), 0)`,
        })
        .from(orders)
        .where(
          and(
            activeOrders,
            gte(orderCreatedMsColumn(), monthStartMs),
            lt(orderCreatedMsColumn(), monthEndMs),
          ),
        )
        .then((rows) => rows[0]),
      getActiveInventoryProducts(),
      computeProfitForDateRange(todayMs, todayMs + MS_PER_DAY),
      computeProfitForDateRange(last7Ms, todayMs + MS_PER_DAY),
      computeProfitForDateRange(last30Ms, todayMs + MS_PER_DAY),
      computeMonthlyNetIncomeBatch([{ year: now.year, month: now.month }]),
      getShopCashOutflowTotals({ fundingSource: "shop_cash" }),
      (() => {
        const { start, end } = phMonthBounds(now.year, now.month);
        return getShopCashOutflowTotals({
          monthStartMs: start.getTime(),
          monthEndMs: end.getTime(),
          fundingSource: "shop_cash",
        });
      })(),
      getInvestorCapitalDashboard(),
    ]);

  const inventory = inventoryValuationFromRows(inventoryProducts);
  const thisMonth =
    monthBatch.get(monthKey(now.year, now.month)) ?? emptyPeriod("This month");
  const monthLabel = phMonthLabel(now.year, now.month);
  const cashInHandCents = Number(cashRow?.cashInHandCents ?? 0);
  const shopOutflowsAllTimeCents = shopOutflows.totalCents;
  const availableShopCashCents = cashInHandCents - shopOutflowsAllTimeCents;

  const periods: PeriodSnapshot[] = [
    { label: "Today", ...todayProfit },
    { label: "Last 7 days", ...last7Profit },
    { label: "Last 30 days", ...last30Profit },
    { label: monthLabel, ...thisMonth },
  ];

  return {
    monthLabel,
    cash: {
      cashInHandCents,
      grossSubtotalCents: Number(cashRow?.grossSubtotalCents ?? 0),
      totalDiscountCents: Number(cashRow?.totalDiscountCents ?? 0),
      thisMonthGrossSubtotalCents: Number(monthCashRow?.grossSubtotalCents ?? 0),
      thisMonthDiscountCents: Number(monthCashRow?.totalDiscountCents ?? 0),
      receivablesCents: Number(cashRow?.receivablesCents ?? 0),
      totalBilledCents: Number(cashRow?.totalBilledCents ?? 0),
      activeOrderCount: Number(cashRow?.orderCount ?? 0),
      shopOutflowsAllTimeCents,
      shopOutflowsThisMonthCents: shopOutflowsThisMonth.totalCents,
      shopExpensesThisMonthCents: shopOutflowsThisMonth.expenseCents,
      shopRestockThisMonthCents: shopOutflowsThisMonth.restockCents,
      availableShopCashCents,
      investorCapitalBalanceCents: investorCapital.balanceCents,
      investorCapitalSpentCents: investorCapital.spentCents,
      investorCapitalContributedCents: investorCapital.contributedCents,
    },
    thisMonth: {
      ...thisMonth,
      label: monthLabel,
    },
    periods,
    inventoryCapitalCents: inventory.stockValueCents,
  };
});
