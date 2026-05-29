import { and, eq, gte, inArray } from "drizzle-orm";

import { db } from "@/db";
import { orderItems, orders, products } from "@/db/schema";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export async function getBusinessInsights() {
  const now = new Date();
  const todayStart = startOfDay(now);
  const last7Start = new Date(todayStart.getTime() - 6 * MS_PER_DAY);
  const last30Start = new Date(todayStart.getTime() - 29 * MS_PER_DAY);

  const [todayOrders, last7Orders, last30Orders, allOrders] = await Promise.all([
    db
      .select({
        id: orders.id,
        totalAmount: orders.totalAmount,
        amountPaid: orders.amountPaid,
        paymentStatus: orders.paymentStatus,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .where(gte(orders.createdAt, todayStart)),
    db
      .select({
        id: orders.id,
        totalAmount: orders.totalAmount,
        amountPaid: orders.amountPaid,
        paymentStatus: orders.paymentStatus,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .where(gte(orders.createdAt, last7Start)),
    db
      .select({
        id: orders.id,
        totalAmount: orders.totalAmount,
        amountPaid: orders.amountPaid,
        paymentStatus: orders.paymentStatus,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .where(gte(orders.createdAt, last30Start)),
    db
      .select({
        amountPaid: orders.amountPaid,
        totalAmount: orders.totalAmount,
        paymentStatus: orders.paymentStatus,
      })
      .from(orders),
  ]);

  const sumPaid = (rows: Array<{ amountPaid: number }>) =>
    rows.reduce((acc, r) => acc + r.amountPaid, 0);
  const sumTotal = (rows: Array<{ totalAmount: number }>) =>
    rows.reduce((acc, r) => acc + r.totalAmount, 0);

  const receivablesCents =
    sumTotal(allOrders) - sumPaid(allOrders);

  // Per-product income/profit (last 30 days)
  const since = last30Start;
  const last30PaidOrders = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(gte(orders.createdAt, since), eq(orders.paymentStatus, "Paid")));
  const paidOrderIds = last30PaidOrders.map((o) => o.id);

  const lines =
    paidOrderIds.length === 0
      ? []
      : await db
          .select({
            orderId: orderItems.orderId,
            productId: orderItems.productId,
            quantity: orderItems.quantity,
            unitPrice: orderItems.unitPrice,
            unitCost: orderItems.unitCost,
            lineTotal: orderItems.lineTotal,
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
    cur.cost += l.unitCost * l.quantity;
    productAgg.set(l.productId, cur);
  }

  const productIds = Array.from(productAgg.keys());
  const productMeta =
    productIds.length === 0
      ? []
      : await db
          .select({
            id: products.id,
            name: products.name,
            brand: products.brand,
            variant: products.variant,
          })
          .from(products)
          .where(inArray(products.id, productIds));

  const metaById = new Map(productMeta.map((p) => [p.id, p]));
  const topProducts = productIds
    .map((id) => {
      const agg = productAgg.get(id)!;
      const meta = metaById.get(id);
      const profit = agg.revenue - agg.cost;
      return {
        productId: id,
        label: meta
          ? `${meta.name}${meta.variant ? ` (${meta.variant})` : ""}`
          : `#${id}`,
        quantity: agg.quantity,
        revenueCents: agg.revenue,
        profitCents: profit,
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
  };
}

