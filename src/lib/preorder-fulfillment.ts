import { db } from "@/db";
import {
  orderItems,
  orders,
  preOrderItems,
  preOrders,
  products,
  supplierCatalogItems,
} from "@/db/schema";
import {
  adjustBranchStock,
  getDefaultBranchId,
} from "@/lib/branch-stock";
import { bumpCustomerSpend, resolveCustomerForOrder } from "@/lib/customers-server";
import {
  getOpenPreOrderIdsForProduct,
  linkPreOrderItemsToProduct,
} from "@/lib/preorder-inventory-link";
import { stockDeductQuantity, type SaleUnit } from "@/lib/order-line-math";
import { and, asc, eq, inArray, isNotNull, isNull, ne } from "drizzle-orm";

export type PreOrderFulfillResult = {
  kind: "order" | "restock" | "already";
  orderId?: number;
  message: string;
};

type PreOrderItemRow = typeof preOrderItems.$inferSelect;

function effectiveQty(item: PreOrderItemRow) {
  return item.receivedQty > 0 ? item.receivedQty : item.quantity;
}

async function findProductForPreOrderItem(item: PreOrderItemRow) {
  if (item.productId) {
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
      .where(and(eq(products.id, item.productId), eq(products.archived, false)))
      .limit(1);
    return product ?? null;
  }

  if (!item.supplierCatalogItemId) return null;

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
        eq(products.supplierCatalogItemId, item.supplierCatalogItemId),
        eq(products.archived, false),
      ),
    )
    .limit(1);

  return product ?? null;
}

async function loadPreOrderItems(preOrderId: number) {
  return db
    .select()
    .from(preOrderItems)
    .where(eq(preOrderItems.preOrderId, preOrderId));
}

async function preOrderHasStockForAllLines(items: PreOrderItemRow[]) {
  for (const item of items) {
    const qty = effectiveQty(item);
    if (qty <= 0) continue;

    const product = await findProductForPreOrderItem(item);
    if (!product || product.stockQuantity < qty) return false;
  }
  return items.some((item) => effectiveQty(item) > 0);
}

async function reserveStockForOrder(orderId: number, note: string) {
  const [order] = await db
    .select({ stockDeducted: orders.stockDeducted, branchId: orders.branchId })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order || order.stockDeducted) return;

  const branchId = order.branchId ?? (await getDefaultBranchId());

  const lines = await db
    .select({
      productId: orderItems.productId,
      quantity: orderItems.quantity,
      quantityTenths: orderItems.quantityTenths,
      saleUnit: orderItems.saleUnit,
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  for (const line of lines) {
    const [product] = await db
      .select({
        id: products.id,
        kgPerSack: products.kgPerSack,
        unitsPerCase: products.unitsPerCase,
      })
      .from(products)
      .where(eq(products.id, line.productId))
      .limit(1);

    if (!product) continue;

    const deductQty = stockDeductQuantity(
      line.saleUnit as SaleUnit,
      line.quantity,
      line.quantityTenths,
      product.kgPerSack,
      product.unitsPerCase,
    );

    await adjustBranchStock({
      branchId,
      productId: product.id,
      delta: -deductQty,
      movementType: "Sale",
      relatedOrderId: orderId,
      note,
    });
  }

  await db
    .update(orders)
    .set({ stockDeducted: true })
    .where(eq(orders.id, orderId));
}

/** Shop stock orders only — customer pre-orders rely on inventory restock from any source. */
async function restockShopPreOrderItems(
  preOrderId: number,
  items: PreOrderItemRow[],
) {
  const defaultBranchId = await getDefaultBranchId();

  for (const item of items) {
    const qty = effectiveQty(item);
    if (qty <= 0) continue;

    const product = await findProductForPreOrderItem(item);
    if (!product) continue;

    await adjustBranchStock({
      branchId: defaultBranchId,
      productId: product.id,
      delta: qty,
      movementType: "Restock",
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
  const shortStock: string[] = [];

  for (const item of items) {
    const qty = effectiveQty(item);
    if (qty <= 0) continue;

    const product = await findProductForPreOrderItem(item);
    if (!product) {
      missing.push(item.itemName);
      continue;
    }

    if (product.stockQuantity < qty) {
      shortStock.push(`${item.itemName} (need ${qty}, have ${product.stockQuantity})`);
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

  if (shortStock.length > 0) {
    throw new Error(
      `Not enough inventory yet: ${shortStock.join("; ")}. Restock in Inventory first — any supplier is fine.`,
    );
  }

  if (lines.length === 0) {
    throw new Error("No quantities to convert into an order.");
  }

  const totalAmount = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const amountPaid = Math.min(preOrder.depositCents, totalAmount);
  const paymentStatus = paymentStatusFor(totalAmount, amountPaid);

  const customerId = await resolveCustomerForOrder({ customerName });
  const noteParts = [`Converted from pre-order #${preOrder.id}`];
  if (preOrder.notes?.trim()) noteParts.push(preOrder.notes.trim());
  const defaultBranchId = await getDefaultBranchId();

  const insertedOrder = await db
    .insert(orders)
    .values({
      customerId,
      customerName,
      contact: null,
      location: null,
      notes: noteParts.join(" · "),
      orderStatus: "Confirmed",
      subtotalCents: totalAmount,
      totalAmount,
      amountPaid,
      paymentStatus,
      deliveryMethod: null,
      storeType: "Online",
      stockDeducted: false,
      branchId: defaultBranchId,
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

  await reserveStockForOrder(
    orderId,
    `Reserved for pre-order #${preOrder.id}`,
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

  const items = await loadPreOrderItems(preOrderId);
  const customerName = preOrder.customerName?.trim();

  if (!customerName) {
    await restockShopPreOrderItems(preOrderId, items);
    return {
      kind: "restock",
      message: "Stock restocked to inventory (shop order, no customer).",
    };
  }

  const orderId = await createCustomerOrderFromPreOrder(preOrder, items);

  await db
    .update(preOrders)
    .set({ status: "Received", fulfillmentOrderId: orderId })
    .where(eq(preOrders.id, preOrderId));

  return {
    kind: "order",
    orderId,
    message: `Created sales order #${orderId} for ${customerName}. Stock reserved from inventory.`,
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

/** When inventory restocks, auto-move waiting customer pre-orders to Sales & Orders. */
export async function tryAutoFulfillPreOrdersForProduct(productId: number) {
  const [product] = await db
    .select({
      id: products.id,
      name: products.name,
      brand: products.brand,
      variant: products.variant,
      supplierCatalogItemId: products.supplierCatalogItemId,
    })
    .from(products)
    .where(and(eq(products.id, productId), eq(products.archived, false)))
    .limit(1);

  if (!product) return [];

  await linkPreOrderItemsToProduct(product);

  const preOrderIds = await getOpenPreOrderIdsForProduct(productId);
  if (preOrderIds.length === 0) return [];

  const openPreOrders = await db
    .select({
      id: preOrders.id,
      customerName: preOrders.customerName,
      fulfillmentOrderId: preOrders.fulfillmentOrderId,
      status: preOrders.status,
      createdAt: preOrders.createdAt,
    })
    .from(preOrders)
    .where(
      and(
        inArray(preOrders.id, preOrderIds),
        isNotNull(preOrders.customerName),
        isNull(preOrders.fulfillmentOrderId),
        ne(preOrders.status, "Cancelled"),
      ),
    )
    .orderBy(asc(preOrders.createdAt));

  const results: PreOrderFulfillResult[] = [];

  for (const preOrder of openPreOrders) {
    if (!preOrder.customerName?.trim()) continue;

    const items = await loadPreOrderItems(preOrder.id);
    const ready = await preOrderHasStockForAllLines(items);
    if (!ready) continue;

    try {
      const result = await fulfillPreOrder(preOrder.id);
      results.push(result);
    } catch (err) {
      console.error(`Auto-fulfill pre-order #${preOrder.id} failed:`, err);
    }
  }

  return results;
}

export async function getPreOrderStockHints(productIds: number[]) {
  if (productIds.length === 0) return new Map<number, number>();

  const rows = await db
    .select({
      id: products.id,
      stockQuantity: products.stockQuantity,
    })
    .from(products)
    .where(and(inArray(products.id, productIds), eq(products.archived, false)));

  return new Map(rows.map((row) => [row.id, row.stockQuantity]));
}

export async function resolvePreOrderItemStockHint(item: {
  productId: number | null;
  supplierCatalogItemId: number | null;
}) {
  if (item.productId != null) {
    const map = await getPreOrderStockHints([item.productId]);
    return map.get(item.productId) ?? 0;
  }

  if (item.supplierCatalogItemId) {
    const [product] = await db
      .select({ stockQuantity: products.stockQuantity })
      .from(products)
      .where(
        and(
          eq(products.supplierCatalogItemId, item.supplierCatalogItemId),
          eq(products.archived, false),
        ),
      )
      .limit(1);
    return product?.stockQuantity ?? null;
  }

  return null;
}

export { linkPreOrderItemsToProduct } from "@/lib/preorder-inventory-link";
