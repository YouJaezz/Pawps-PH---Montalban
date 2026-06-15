import { cache } from "react";
import { and, eq, gte, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { orderItems, orders } from "@/db/schema";
import {
  getActiveInventoryProducts,
  inventoryValuationFromRows,
} from "@/db/queries/inventory-products";
import { orderCreatedMsColumn } from "@/lib/order-timestamp";
import { phStartOfToday } from "@/lib/ph-time";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const getBusinessInsights = cache(async () => {
  const todayStart = phStartOfToday();
  const todayMs = todayStart.getTime();
  const last7Ms = todayMs - 6 * MS_PER_DAY;
  const last30Ms = todayMs - 29 * MS_PER_DAY;
  const createdMs = orderCreatedMsColumn();

  const [inventoryProducts, incomeRow, paidLast30Rows] = await Promise.all([
    getActiveInventoryProducts(),
    db
      .select({
        incomeTodayCents: sql<number>`coalesce(sum(case when ${createdMs} >= ${todayMs} then ${orders.amountPaid} else 0 end), 0)`,
        incomeLast7DaysCents: sql<number>`coalesce(sum(case when ${createdMs} >= ${last7Ms} then ${orders.amountPaid} else 0 end), 0)`,
        incomeLast30DaysCents: sql<number>`coalesce(sum(case when ${createdMs} >= ${last30Ms} then ${orders.amountPaid} else 0 end), 0)`,
        receivablesCents: sql<number>`coalesce(sum(${orders.totalAmount} - ${orders.amountPaid}), 0)`,
      })
      .from(orders),
    db
      .select({ id: orders.id })
      .from(orders)
      .where(
        and(eq(orders.paymentStatus, "Paid"), gte(createdMs, last30Ms)),
      ),
  ]);

  const inventoryValuation = inventoryValuationFromRows(inventoryProducts);
  const paidLast30Ids = paidLast30Rows.map((r) => r.id);

  const lines =
    paidLast30Ids.length === 0
      ? []
      : await db
          .select({
            productId: orderItems.productId,
            quantity: orderItems.quantity,
            lineTotal: orderItems.lineTotal,
            unitCost: orderItems.unitCost,
            isExcessSale: orderItems.isExcessSale,
          })
          .from(orderItems)
          .where(inArray(orderItems.orderId, paidLast30Ids));

  const productAgg = new Map<
    number,
    { quantity: number; revenue: number; cost: number }
  >();

  for (const l of lines) {
    const cur = productAgg.get(l.productId) ?? {
      quantity: 0,
      revenue: 0,
      cost: 0,
    };
    cur.quantity += l.quantity;
    cur.revenue += l.lineTotal;
    cur.cost += l.isExcessSale ? 0 : l.unitCost * l.quantity;
    productAgg.set(l.productId, cur);
  }

  const metaById = new Map(
    inventoryProducts
      .filter((p) => productAgg.has(p.id))
      .map((p) => [p.id, p]),
  );

  const topProducts = [...productAgg.entries()]
    .map(([id, agg]) => {
      const meta = metaById.get(id);
      return {
        productId: id,
        label: meta
          ? `${meta.name}${meta.variant ? ` (${meta.variant})` : ""}`
          : `#${id}`,
        quantity: agg.quantity,
        revenueCents: agg.revenue,
        profitCents: agg.revenue - agg.cost,
      };
    })
    .sort((a, b) => b.revenueCents - a.revenueCents)
    .slice(0, 8);

  const income = incomeRow[0];

  return {
    incomeTodayCents: Number(income?.incomeTodayCents ?? 0),
    incomeLast7DaysCents: Number(income?.incomeLast7DaysCents ?? 0),
    incomeLast30DaysCents: Number(income?.incomeLast30DaysCents ?? 0),
    receivablesCents: Number(income?.receivablesCents ?? 0),
    topProductsLast30Days: topProducts,
    stockValueCents: inventoryValuation.stockValueCents,
    potentialStockIncomeCents: inventoryValuation.potentialIncomeCents,
    profitPotentialCents: inventoryValuation.profitPotentialCents,
  };
});
