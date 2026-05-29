"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/db";
import {
  deliveryLogs,
  orderItems,
  orders,
  products,
  stockMovements,
} from "@/db/schema";
import { eq, inArray, and } from "drizzle-orm";

function parseMoneyToCents(value: FormDataEntryValue | null) {
  const str = typeof value === "string" ? value.trim() : "";
  const n = Number(str);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

function parseIntOr(value: FormDataEntryValue | null, fallback: number) {
  const str = typeof value === "string" ? value.trim() : "";
  const n = Number.parseInt(str, 10);
  return Number.isFinite(n) ? n : fallback;
}

export async function quickSell(formData: FormData) {
  const productId = parseIntOr(formData.get("productId"), 0);
  const quantity = parseIntOr(formData.get("quantity"), 1);
  const priceTier = String(formData.get("priceTier") ?? "Retail") as
    | "Retail"
    | "Bulk";
  const customerName = String(formData.get("customerName") ?? "").trim();
  const locationRaw = String(formData.get("location") ?? "").trim();
  const deliveryMethodRaw = String(formData.get("deliveryMethod") ?? "").trim();
  const storeType = String(formData.get("storeType") ?? "Online") as
    | "Online"
    | "Walk-in";
  const deductStock = String(formData.get("deductStock") ?? "on") === "on";

  if (!productId || !quantity || !customerName) {
    throw new Error("Product, quantity, and customer name are required.");
  }

  const [p] = await db
    .select({
      id: products.id,
      costPrice: products.costPrice,
      retailPrice: products.retailPrice,
      bulkPrice: products.bulkPrice,
      stockQuantity: products.stockQuantity,
    })
    .from(products)
    .where(and(eq(products.id, productId), eq(products.archived, false)))
    .limit(1);

  if (!p) throw new Error("Product not found.");
  if (deductStock && p.stockQuantity < quantity) {
    throw new Error("Not enough stock.");
  }

  const unitPrice = priceTier === "Bulk" ? p.bulkPrice : p.retailPrice;
  const lineTotal = unitPrice * quantity;

  // Basic: auto-mark as Paid because it's a "quick sell".
  const insertedOrder = await db
    .insert(orders)
    .values({
      customerName,
      location: locationRaw.length ? locationRaw : null,
      totalAmount: lineTotal,
      amountPaid: lineTotal,
      paymentStatus: "Paid",
      deliveryMethod: deliveryMethodRaw.length ? deliveryMethodRaw : null,
      storeType,
      stockDeducted: deductStock,
    })
    .returning({ id: orders.id });

  const orderId = insertedOrder[0]?.id;
  if (!orderId) throw new Error("Failed to create order.");

  await db.insert(orderItems).values({
    orderId,
    productId,
    quantity,
    priceTier,
    unitCost: p.costPrice,
    unitPrice,
    lineTotal,
  });

  if (deductStock) {
    await db
      .update(products)
      .set({ stockQuantity: p.stockQuantity - quantity })
      .where(eq(products.id, productId));

    await db.insert(stockMovements).values({
      productId,
      movementType: "Sale",
      quantityDelta: -quantity,
      relatedOrderId: orderId,
      note: "Quick Sell",
    });
  }

  if (deliveryMethodRaw.length) {
    await db.insert(deliveryLogs).values({
      orderId,
      customerName,
      location: locationRaw.length ? locationRaw : null,
      deliveryMethod: deliveryMethodRaw as
        | "Montalban Free Delivery"
        | "Lalamove"
        | "Other",
      status: "Queued",
      fee: 0,
      reference: null,
      notes: "Auto-created from order",
    });
  }

  revalidatePath("/orders");
  revalidatePath("/");
  revalidatePath("/products");
  revalidatePath("/delivery");
}

export async function createBulkOrder(formData: FormData) {
  const customerName = String(formData.get("customerName") ?? "").trim();
  const locationRaw = String(formData.get("location") ?? "").trim();
  const deliveryMethodRaw = String(formData.get("deliveryMethod") ?? "").trim();
  const storeType = String(formData.get("storeType") ?? "Online") as
    | "Online"
    | "Walk-in";

  const productIds = formData
    .getAll("productId")
    .map((v) => Number.parseInt(String(v), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
  const quantities = formData
    .getAll("quantity")
    .map((v) => Number.parseInt(String(v), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
  const priceTier = String(formData.get("priceTier") ?? "Bulk") as
    | "Retail"
    | "Bulk";

  if (!customerName) throw new Error("Customer name is required.");
  if (productIds.length === 0 || quantities.length === 0) {
    throw new Error("Add at least 1 item.");
  }

  if (productIds.length === 0 || quantities.length === 0) {
    throw new Error("Invalid items.");
  }

  const selected = await db
    .select({
      id: products.id,
      costPrice: products.costPrice,
      retailPrice: products.retailPrice,
      bulkPrice: products.bulkPrice,
    })
    .from(products)
    .where(and(inArray(products.id, productIds), eq(products.archived, false)));

  const priceById = new Map(selected.map((p) => [p.id, p]));

  let total = 0;
  const lines: Array<{
    productId: number;
    quantity: number;
    unitCost: number;
    unitPrice: number;
    lineTotal: number;
  }> = [];

  for (let i = 0; i < productIds.length; i++) {
    const id = productIds[i]!;
    const qty = quantities[i] ?? 0;
    if (!qty) continue;
    const prod = priceById.get(id);
    if (!prod) continue;
    const unitPrice = priceTier === "Bulk" ? prod.bulkPrice : prod.retailPrice;
    const lineTotal = unitPrice * qty;
    total += lineTotal;
    lines.push({
      productId: id,
      quantity: qty,
      unitCost: prod.costPrice,
      unitPrice,
      lineTotal,
    });
  }

  const deposit = Math.round(total * 0.3);

  const insertedOrder = await db
    .insert(orders)
    .values({
      customerName,
      location: locationRaw.length ? locationRaw : null,
      totalAmount: total,
      amountPaid: deposit,
      paymentStatus: "30% Deposit",
      deliveryMethod: deliveryMethodRaw.length ? deliveryMethodRaw : null,
      storeType,
    })
    .returning({ id: orders.id });

  const orderId = insertedOrder[0]?.id;
  if (!orderId) throw new Error("Failed to create bulk order.");

  if (lines.length) {
    await db.insert(orderItems).values(
      lines.map((l) => ({
        orderId,
        productId: l.productId,
        quantity: l.quantity,
        priceTier,
        unitCost: l.unitCost,
        unitPrice: l.unitPrice,
        lineTotal: l.lineTotal,
      })),
    );
  }

  if (deliveryMethodRaw.length) {
    await db.insert(deliveryLogs).values({
      orderId,
      customerName,
      location: locationRaw.length ? locationRaw : null,
      deliveryMethod: deliveryMethodRaw as
        | "Montalban Free Delivery"
        | "Lalamove"
        | "Other",
      status: "Queued",
      fee: 0,
      reference: null,
      notes: "Auto-created from bulk order",
    });
  }

  revalidatePath("/orders");
  revalidatePath("/delivery");
}

export async function cancelOrder(formData: FormData) {
  const orderId = parseIntOr(formData.get("orderId"), 0);
  if (!orderId) throw new Error("Invalid order.");

  const [order] = await db
    .select({
      id: orders.id,
      orderStatus: orders.orderStatus,
      stockDeducted: orders.stockDeducted,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) throw new Error("Order not found.");
  if (order.orderStatus === "Cancelled") {
    throw new Error("Order is already cancelled.");
  }

  const lines = await db
    .select({
      productId: orderItems.productId,
      quantity: orderItems.quantity,
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  // Restock if stock was deducted at sale time, or if sale movements exist (legacy orders).
  const saleMovements = await db
    .select({
      productId: stockMovements.productId,
      quantityDelta: stockMovements.quantityDelta,
    })
    .from(stockMovements)
    .where(
      and(
        eq(stockMovements.relatedOrderId, orderId),
        eq(stockMovements.movementType, "Sale"),
      ),
    );

  const restockByProduct = new Map<number, number>();

  if (order.stockDeducted) {
    for (const l of lines) {
      restockByProduct.set(
        l.productId,
        (restockByProduct.get(l.productId) ?? 0) + l.quantity,
      );
    }
  } else if (saleMovements.length > 0) {
    for (const m of saleMovements) {
      const qty = Math.abs(m.quantityDelta);
      if (qty > 0) {
        restockByProduct.set(
          m.productId,
          (restockByProduct.get(m.productId) ?? 0) + qty,
        );
      }
    }
  }

  for (const [productId, qty] of restockByProduct) {
    const [p] = await db
      .select({ id: products.id, stockQuantity: products.stockQuantity })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);

    if (!p) continue;

    await db
      .update(products)
      .set({ stockQuantity: p.stockQuantity + qty })
      .where(eq(products.id, productId));

    await db.insert(stockMovements).values({
      productId,
      movementType: "Cancel",
      quantityDelta: qty,
      relatedOrderId: orderId,
      note: "Order cancelled — stock restored",
    });
  }

  await db
    .update(orders)
    .set({
      orderStatus: "Cancelled",
      paymentStatus: "Pending",
      amountPaid: 0,
      stockDeducted: false,
    })
    .where(eq(orders.id, orderId));

  await db
    .update(deliveryLogs)
    .set({ status: "Cancelled" })
    .where(eq(deliveryLogs.orderId, orderId));

  revalidatePath("/orders");
  revalidatePath("/products");
  revalidatePath("/delivery");
}

export async function addPayment(formData: FormData) {
  const orderId = parseIntOr(formData.get("orderId"), 0);
  const addAmount = parseMoneyToCents(formData.get("addAmount"));
  if (!orderId || addAmount <= 0) throw new Error("Invalid payment.");

  const [o] = await db
    .select({
      id: orders.id,
      totalAmount: orders.totalAmount,
      amountPaid: orders.amountPaid,
      paymentStatus: orders.paymentStatus,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!o) throw new Error("Order not found.");

  const newPaid = Math.min(o.totalAmount, o.amountPaid + addAmount);
  const newStatus =
    newPaid >= o.totalAmount
      ? "Paid"
      : newPaid >= Math.round(o.totalAmount * 0.3)
        ? "30% Deposit"
        : "Pending";

  await db
    .update(orders)
    .set({ amountPaid: newPaid, paymentStatus: newStatus })
    .where(eq(orders.id, orderId));

  revalidatePath("/orders");
}

