import { cache } from "react";
import { desc, eq, inArray } from "drizzle-orm";

import type { OrderEditPayload } from "@/app/orders/OrderEditModal";
import { db } from "@/db";
import { customers, orderItems, orders } from "@/db/schema";
import { getActiveInventoryProducts } from "@/db/queries/inventory-products";
import { formatQuantityLabel, type SaleUnit } from "@/lib/order-line-math";

function formatItemsSummary(items: string[]) {
  if (items.length === 0) return "—";
  if (items.length === 1) return items[0]!;
  if (items.length === 2) return items.join(" · ");
  return `${items[0]} · ${items[1]} · +${items.length - 2} more`;
}

function excessQtyFromNote(lineNote: string | null) {
  return (
    lineNote?.match(/^Excess\/bonus stock — (.+?) — no inventory/)?.[1] ?? "bonus"
  );
}

export const getOrdersPageData = cache(async () => {
  const [customerRows, recentOrders, inventoryProducts] = await Promise.all([
    db
      .select({
        id: customers.id,
        name: customers.name,
        contact: customers.contact,
        location: customers.location,
        totalSpend: customers.totalSpend,
      })
      .from(customers)
      .orderBy(customers.name),
    db
      .select({
        id: orders.id,
        customerName: orders.customerName,
        contact: orders.contact,
        location: orders.location,
        orderStatus: orders.orderStatus,
        totalAmount: orders.totalAmount,
        amountPaid: orders.amountPaid,
        paymentStatus: orders.paymentStatus,
        deliveryMethod: orders.deliveryMethod,
        storeType: orders.storeType,
        notes: orders.notes,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .orderBy(desc(orders.createdAt))
      .limit(50),
    getActiveInventoryProducts(),
  ]);

  const quickSellProducts = inventoryProducts.map((p) => ({
    id: p.id,
    name: p.name,
    brand: p.brand,
    variant: p.variant,
    retailPrice: p.retailPrice,
    bulkPrice: p.bulkPrice,
    stockQuantity: p.stockQuantity,
    stockUnit: p.stockUnit,
    kgPerSack: p.kgPerSack,
    unitsPerCase: p.unitsPerCase,
  }));

  const productById = new Map(inventoryProducts.map((p) => [p.id, p]));
  const recentOrderIds = recentOrders.map((o) => o.id);

  const recentLines =
    recentOrderIds.length === 0
      ? []
      : await db
          .select({
            id: orderItems.id,
            orderId: orderItems.orderId,
            productId: orderItems.productId,
            quantity: orderItems.quantity,
            quantityTenths: orderItems.quantityTenths,
            saleUnit: orderItems.saleUnit,
            priceTier: orderItems.priceTier,
            isExcessSale: orderItems.isExcessSale,
            lineNote: orderItems.lineNote,
            unitPrice: orderItems.unitPrice,
            lineTotal: orderItems.lineTotal,
          })
          .from(orderItems)
          .where(inArray(orderItems.orderId, recentOrderIds));

  const linesByOrder = new Map<number, string[]>();
  const editableByOrderId: Record<number, OrderEditPayload> = {};

  for (const o of recentOrders) {
    editableByOrderId[o.id] = {
      id: o.id,
      customerName: o.customerName,
      contact: o.contact,
      location: o.location,
      deliveryMethod: o.deliveryMethod,
      storeType: o.storeType,
      notes: o.notes,
      orderStatus: o.orderStatus,
      lines: [],
    };
  }

  for (const l of recentLines) {
    const p = productById.get(l.productId);
    if (!p) continue;

    const qtyLabel = l.isExcessSale
      ? `excess: ${excessQtyFromNote(l.lineNote)}`
      : formatQuantityLabel(
          l.saleUnit as SaleUnit,
          l.quantity,
          l.quantityTenths,
        );
    const label = l.isExcessSale
      ? `${p.name} · ${qtyLabel}`
      : `${p.name}${p.variant ? ` (${p.variant})` : ""} · ${qtyLabel}`;

    const arr = linesByOrder.get(l.orderId) ?? [];
    arr.push(label);
    linesByOrder.set(l.orderId, arr);

    const payload = editableByOrderId[l.orderId];
    if (payload && !l.isExcessSale) {
      payload.lines.push({
        id: l.id,
        productId: l.productId,
        productLabel: `${p.name}${p.variant ? ` (${p.variant})` : ""}`,
        quantity: l.quantity,
        quantityTenths: l.quantityTenths,
        saleUnit: l.saleUnit as SaleUnit,
        priceTier: l.priceTier as "Retail" | "Bulk",
        unitPrice: l.unitPrice,
        lineTotal: l.lineTotal,
        stockUnit: p.stockUnit,
        kgPerSack: p.kgPerSack,
        unitsPerCase: p.unitsPerCase,
      });
    }
  }

  const boardRows = recentOrders.map((o) => {
    const items = linesByOrder.get(o.id) ?? [];
    return {
      id: o.id,
      customerName: o.customerName,
      contact: o.contact,
      location: o.location,
      orderStatus: o.orderStatus,
      totalAmount: o.totalAmount,
      amountPaid: o.amountPaid,
      paymentStatus: o.paymentStatus,
      deliveryMethod: o.deliveryMethod,
      storeType: o.storeType,
      createdAt: o.createdAt.toISOString(),
      itemsSummary: formatItemsSummary(items),
      itemsSearchText: items.join(" "),
      itemCount: items.length,
    };
  });

  return {
    customerRows,
    quickSellProducts,
    boardRows,
    editableByOrderId,
  };
});
