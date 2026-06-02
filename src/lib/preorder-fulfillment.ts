import { db } from "@/db";
import {
  orderItems,
  orders,
  preOrderItems,
  preOrders,
  products,
  stockMovements,
  supplierCatalogItems,
} from "@/db/schema";
import { bumpCustomerSpend, resolveCustomerForOrder } from "@/lib/customers-server";
import { and, eq } from "drizzle-orm";

export type PreOrderFulfillResult = {
  kind: "order" | "restock" | "already";
  orderId?: number;
  message: string;
};

type PreOrderItemRow = typeof preOrderItems.$inferSelect;

function effectiveQty(item: PreOrderItemRow) {
  return item.receivedQty > 0 ? item.receivedQty : item.quantity;
}

async function findProductForCatalogItem(catalogItemId: number | null) {
  if (!catalogItemId) return null;

  const [product] = await db
    .select({
      id: products.id,
      name: products.name,
      costPrice: products.costPrice,
      retailPrice: products.retailPrice,
      bulkPrice: products.bulkPrice,
      stockQuantity: products.stockQuantity,
    })
    .from(products)
    .where(
      and(
        eq(products.supplierCatalogItemId, catalogItemId),
        eq(products.archived, false),
      ),
    )
    .limit(1);

  return product ?? null;
}

async function restockPreOrderItems(
  preOrderId: number,
  items: PreOrderItemRow[],
) {
  for (const item of items) {
    const qty = effectiveQty(item);
    if (qty <= 0) continue;

    const product = await findProductForCatalogItem(item.supplierCatalogItemId);
    if (!product) continue;

    await db
      .update(products)
      .set({ stockQuantity: product.stockQuantity + qty })
      .where(eq(products.id, product.id));

    await db.insert(stockMovements).values({
      productId: product.id,
      movementType: "Restock",
      quantityDelta: qty,
      note: `Pre-order #${preOrderId} received`,
    });
  }
}

function paymentStatusFor(totalCents: number, paidCents: number) {
  if (paidCents >= totalCents) return "Paid" as const;
  if (paidCents >= Math.round(totalCents * 0.3)) return "30% Deposit" as const;
  return "Pending" as const;
}

async function createCustomerOrderFromPreOrder(
  preOrder: typeof preOrders.$inferSelect,
  items: PreOrderItemRow[],
) {
  const customerName = preOrder.customerName?.trim();
  if (!customerName) {
    throw new Error("Customer name is required to create a sales order.");
  }

  const lines: Array<{
    productId: number;
    quantity: number;
    unitCost: number;
    unitPrice: number;
    lineTotal: number;
    label: string;
  }> = [];

  const missing: string[] = [];

  for (const item of items) {
    const qty = effectiveQty(item);
    if (qty <= 0) continue;

    const product = await findProductForCatalogItem(item.supplierCatalogItemId);
    if (!product) {
      missing.push(item.itemName);
      continue;
    }

    let unitPrice = product.retailPrice;
    if (unitPrice <= 0 && item.supplierCatalogItemId) {
      const [catalog] = await db
        .select({ retailPrice: supplierCatalogItems.retailPrice })
        .from(supplierCatalogItems)
        .where(eq(supplierCatalogItems.id, item.supplierCatalogItemId))
        .limit(1);
      unitPrice = catalog?.retailPrice ?? item.unitCostCents;
    }

    lines.push({
      productId: product.id,
      quantity: qty,
      unitCost: product.costPrice,
      unitPrice,
      lineTotal: unitPrice * qty,
      label: item.itemName,
    });
  }

  if (missing.length > 0) {
    throw new Error(
      `Link these items in Inventory first: ${missing.join(", ")}`,
    );
  }

  if (lines.length === 0) {
    throw new Error("No received quantities to convert into an order.");
  }

  const totalAmount = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const amountPaid = Math.min(preOrder.depositCents, totalAmount);
  const paymentStatus = paymentStatusFor(totalAmount, amountPaid);

  const customerId = await resolveCustomerForOrder({ customerName });
  const noteParts = [`Converted from pre-order #${preOrder.id}`];
  if (preOrder.notes?.trim()) noteParts.push(preOrder.notes.trim());

  const insertedOrder = await db
    .insert(orders)
    .values({
      customerId,
      customerName,
      contact: null,
      location: null,
      notes: noteParts.join(" · "),
      orderStatus: "Confirmed",
      totalAmount,
      amountPaid,
      paymentStatus,
      deliveryMethod: null,
      storeType: "Online",
      stockDeducted: false,
    })
    .returning({ id: orders.id });

  const orderId = insertedOrder[0]?.id;
  if (!orderId) throw new Error("Failed to create sales order.");

  await db.insert(orderItems).values(
    lines.map((line) => ({
      orderId,
      productId: line.productId,
      quantity: line.quantity,
      priceTier: "Retail" as const,
      unitCost: line.unitCost,
      unitPrice: line.unitPrice,
      lineTotal: line.lineTotal,
    })),
  );

  if (customerId && amountPaid > 0) {
    await bumpCustomerSpend(customerId, amountPaid);
  }

  return orderId;
}

export async function fulfillPreOrder(
  preOrderId: number,
): Promise<PreOrderFulfillResult> {
  const [preOrder] = await db
    .select()
    .from(preOrders)
    .where(eq(preOrders.id, preOrderId))
    .limit(1);

  if (!preOrder) throw new Error("Pre-order not found.");

  if (preOrder.fulfillmentOrderId) {
    return {
      kind: "already",
      orderId: preOrder.fulfillmentOrderId,
      message: `Already linked to sales order #${preOrder.fulfillmentOrderId}.`,
    };
  }

  const items = await db
    .select()
    .from(preOrderItems)
    .where(eq(preOrderItems.preOrderId, preOrderId));

  await restockPreOrderItems(preOrderId, items);

  const customerName = preOrder.customerName?.trim();
  if (!customerName) {
    return {
      kind: "restock",
      message: "Stock restocked to inventory (shop order, no customer).",
    };
  }

  const orderId = await createCustomerOrderFromPreOrder(preOrder, items);

  await db
    .update(preOrders)
    .set({ fulfillmentOrderId: orderId })
    .where(eq(preOrders.id, preOrderId));

  return {
    kind: "order",
    orderId,
    message: `Created sales order #${orderId} for ${customerName}. Track payment and delivery in Sales & Orders.`,
  };
}

export async function syncPreOrderReceiveStatus(preOrderId: number) {
  const items = await db
    .select({
      quantity: preOrderItems.quantity,
      receivedQty: preOrderItems.receivedQty,
    })
    .from(preOrderItems)
    .where(eq(preOrderItems.preOrderId, preOrderId));

  if (items.length === 0) return null;

  const fullyReceived = items.every(
    (item) => item.receivedQty >= item.quantity && item.quantity > 0,
  );
  const partiallyReceived = items.some((item) => item.receivedQty > 0);

  if (fullyReceived) return "Received" as const;
  if (partiallyReceived) return "Partial" as const;
  return null;
}
