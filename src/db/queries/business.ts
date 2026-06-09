import { cache } from "react";
import { and, eq, gte, inArray } from "drizzle-orm";

import { db } from "@/db";
import { orderItems, orders } from "@/db/schema";
import {
  getActiveInventoryProducts,
  inventoryValuationFromRows,
} from "@/db/queries/inventory-products";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export const getBusinessInsights = cache(async () => {
  const now = new Date();
  const todayStart = startOfDay(now);
  const last7Start = new Date(todayStart.getTime() - 6 * MS_PER_DAY);
  const last30Start = new Date(todayStart.getTime() - 29 * MS_PER_DAY);

  const inventoryProducts = await getActiveInventoryProducts();
  const inventoryValuation = inventoryValuationFromRows(inventoryProducts);

  const [todayOrders, last7Orders, last30Orders, allOrders] = await Promise.all([
    db
      .select({
        amountPaid: orders.amountPaid,
      })
      .from(orders)
      .where(gte(orders.createdAt, todayStart)),
    db
      .select({
        amountPaid: orders.amountPaid,
      })
      .from(orders)
      .where(gte(orders.createdAt, last7Start)),
    db
      .select({
        amountPaid: orders.amountPaid,
      })
      .from(orders)
      .where(gte(orders.createdAt, last30Start)),
    db
      .select({
        amountPaid: orders.amountPaid,
        totalAmount: orders.totalAmount,
      })
      .from(orders),
  ]);

  const sumPaid = (rows: Array<{ amountPaid: number }>) =>
    rows.reduce((acc, r) => acc + r.amountPaid, 0);
  const sumTotal = (rows: Array<{ totalAmount: number }>) =>
    rows.reduce((acc, r) => acc + r.totalAmount, 0);

  const receivablesCents = sumTotal(allOrders) - sumPaid(allOrders);

  const last30PaidOrders = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(gte(orders.createdAt, last30Start), eq(orders.paymentStatus, "Paid")));
  const paidOrderIds = last30PaidOrders.map((o) => o.id);

  const lines =
    paidOrderIds.length === 0
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
          .where(inArray(orderItems.orderId, paidOrderIds));

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
    incomeTodayCents: sumPaid(todayOrders),
    incomeLast7DaysCents: sumPaid(last7Orders),
    incomeLast30DaysCents: sumPaid(last30Orders),
    receivablesCents,
    topProductsLast30Days: topProducts,
    stockValueCents: inventoryValuation.stockValueCents,
    potentialStockIncomeCents: inventoryValuation.potentialIncomeCents,
    profitPotentialCents: inventoryValuation.profitPotentialCents,
  };
});
