import { cache } from "react";
import { inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { orderItems, orders } from "@/db/schema";
import {
  getActiveInventoryProducts,
  inventoryValuationFromRows,
} from "@/db/queries/inventory-products";
import { phStartOfToday } from "@/lib/ph-time";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function orderCreatedMsColumn() {
  return sql<number>`CASE WHEN ${orders.createdAt} < 1000000000000 THEN ${orders.createdAt} * 1000 ELSE ${orders.createdAt} END`;
}

export const getBusinessInsights = cache(async () => {
  const todayStart = phStartOfToday();
  const todayMs = todayStart.getTime();
  const last7Ms = todayMs - 6 * MS_PER_DAY;
  const last30Ms = todayMs - 29 * MS_PER_DAY;

  const createdMs = orderCreatedMsColumn();

  const [inventoryProducts, orderRows] = await Promise.all([
    getActiveInventoryProducts(),
    db
      .select({
        id: orders.id,
        amountPaid: orders.amountPaid,
        totalAmount: orders.totalAmount,
        paymentStatus: orders.paymentStatus,
        createdMs: orderCreatedMsColumn(),
      })
      .from(orders),
  ]);

  const inventoryValuation = inventoryValuationFromRows(inventoryProducts);

  let incomeTodayCents = 0;
  let incomeLast7DaysCents = 0;
  let incomeLast30DaysCents = 0;
  let receivablesCents = 0;
  const paidLast30Ids: number[] = [];

  for (const row of orderRows) {
    const ts = Number(row.createdMs);
    const paid = row.amountPaid;
    receivablesCents += row.totalAmount - paid;

    if (ts >= last30Ms) {
      incomeLast30DaysCents += paid;
      if (row.paymentStatus === "Paid") paidLast30Ids.push(row.id);
    }
    if (ts >= last7Ms) incomeLast7DaysCents += paid;
    if (ts >= todayMs) incomeTodayCents += paid;
  }

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

  return {
    incomeTodayCents,
    incomeLast7DaysCents,
    incomeLast30DaysCents,
    receivablesCents,
    topProductsLast30Days: topProducts,
    stockValueCents: inventoryValuation.stockValueCents,
    potentialStockIncomeCents: inventoryValuation.potentialIncomeCents,
    profitPotentialCents: inventoryValuation.profitPotentialCents,
  };
});
