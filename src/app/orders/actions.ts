"use server";

import { bumpCustomerSpend, resolveCustomerForOrder } from "@/lib/customers-server";
import { requireAuth, requireAdmin } from "@/lib/auth-guard";
import { normalizeOrderStatus } from "@/lib/order-status";
import { revalidateSalesPages } from "@/lib/revalidate-sales";
import {
  isSaleUnit,
  formatQuantityLabel,
  effectiveQuantity,
  lineTotalCents,
  parseQuantityInput,
  stockDeductQuantity,
  unitPriceForSale,
  stockRestockQuantity,
  type SaleUnit,
} from "@/lib/order-line-math";
import { formatStockLabel } from "@/lib/product-stock";
import { formatPhpFromCents } from "@/lib/money";
import type { OrderReceiptData } from "@/lib/order-receipt";
import {
  buildCustomSaleLineNote,
  buildExcessLineNote,
  excessLineLabel,
  parseCustomSaleLabel,
} from "@/lib/excess-sale";
import { db } from "@/db";
import {
  ORDER_STATUSES,
  deliveryLogs,
  orderItems,
  orders,
  products,
  stockMovements,
  type OrderStatus,
  type StockUnit,
} from "@/db/schema";
import { eq, inArray, and, sum } from "drizzle-orm";

export type OrderActionResult = {
  ok?: boolean;
  error?: string;
  message?: string;
  orderId?: number;
  receipt?: OrderReceiptData;
};

function actionError(message: string): OrderActionResult {
  return { error: message };
}

function actionSuccess(
  message: string,
  extra?: { orderId: number; receipt: OrderReceiptData },
): OrderActionResult {
  return extra
    ? { ok: true, message, orderId: extra.orderId, receipt: extra.receipt }
    : { ok: true, message };
}

function formatActionError(err: unknown) {
  if (err instanceof Error && err.message) return err.message;
  return "Something went wrong. Please try again.";
}

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

async function deductStockForOrder(orderId: number) {
  const [order] = await db
    .select({ stockDeducted: orders.stockDeducted, notes: orders.notes })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order || order.stockDeducted) return;
  if (order.notes?.includes("[no-stock-deduct]")) return;

  const lines = await db
    .select({
      productId: orderItems.productId,
      quantity: orderItems.quantity,
      quantityTenths: orderItems.quantityTenths,
      saleUnit: orderItems.saleUnit,
      isExcessSale: orderItems.isExcessSale,
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  for (const line of lines) {
    if (line.isExcessSale) continue;
    const [product] = await db
      .select({
        id: products.id,
        stockQuantity: products.stockQuantity,
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

    await db
      .update(products)
      .set({ stockQuantity: product.stockQuantity - deductQty })
      .where(eq(products.id, product.id));

    await db.insert(stockMovements).values({
      productId: product.id,
      movementType: "Sale",
      quantityDelta: -deductQty,
      relatedOrderId: orderId,
      note: "Order completed",
    });
  }

  await db
    .update(orders)
    .set({ stockDeducted: true })
    .where(eq(orders.id, orderId));
}

async function recalcOrderTotal(orderId: number) {
  const [sumRow] = await db
    .select({
      total: sum(orderItems.lineTotal),
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  const total = Number(sumRow?.total ?? 0);

  const [order] = await db
    .select({
      amountPaid: orders.amountPaid,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) return;

  const amountPaid = Math.min(order.amountPaid, total);
  const paymentStatus =
    amountPaid >= total
      ? ("Paid" as const)
      : amountPaid >= Math.round(total * 0.3)
        ? ("30% Deposit" as const)
        : ("Pending" as const);

  await db
    .update(orders)
    .set({ totalAmount: total, amountPaid, paymentStatus })
    .where(eq(orders.id, orderId));
}

export async function quickSell(
  _prev: OrderActionResult | null,
  formData: FormData,
): Promise<OrderActionResult> {
  try {
    const session = await requireAuth();

    const customerName = String(formData.get("customerName") ?? "").trim();
    const contactRaw = String(formData.get("contact") ?? "").trim();
    const locationRaw = String(formData.get("location") ?? "").trim();
    const customerIdRaw = parseIntOr(formData.get("customerId"), 0);
    const notesRaw = String(formData.get("notes") ?? "").trim();
    const deliveryMethodRaw = String(formData.get("deliveryMethod") ?? "").trim();
    const storeType = String(formData.get("storeType") ?? "Online") as
      | "Online"
      | "Walk-in";
    const deductStock = formData.get("deductStock") === "on";

    const productIds = formData
      .getAll("productId")
      .map((v) => Number.parseInt(String(v), 10))
      .filter((n) => Number.isFinite(n) && n > 0);
    const quantitiesRaw = formData.getAll("quantity").map((v) => String(v));
    const saleUnitsRaw = formData.getAll("saleUnit").map((v) => String(v));
    const priceTiersRaw = formData.getAll("priceTier").map((v) => String(v));

    const excessProductIds = formData
      .getAll("excessProductId")
      .map((v) => Number.parseInt(String(v), 10))
      .filter((n) => Number.isFinite(n) && n > 0);
    const excessQtyLabels = formData.getAll("excessQtyLabel").map((v) => String(v));
    const excessQtyPresets = formData.getAll("excessQtyPreset").map((v) => String(v));
    const excessAmountsRaw = formData.getAll("excessAmount").map((v) => String(v));
    const excessNotesRaw = formData.getAll("excessNote").map((v) => String(v));

    if (productIds.length === 0) {
      const singleId = parseIntOr(formData.get("productId"), 0);
      if (singleId > 0) {
        productIds.push(singleId);
        quantitiesRaw.push(String(formData.get("quantity") ?? "1"));
        saleUnitsRaw.push(String(formData.get("saleUnit") ?? "Piece"));
        priceTiersRaw.push(String(formData.get("priceTier") ?? "Retail"));
      }
    }

    if (!customerName) {
      return actionError("Customer name is required.");
    }
    if (productIds.length === 0 && excessProductIds.length === 0) {
      return actionError("Add at least one regular or excess/bonus item.");
    }

    const allProductIds = [
      ...new Set([...productIds, ...excessProductIds]),
    ];

    const selected =
      allProductIds.length === 0
        ? []
        : await db
            .select({
              id: products.id,
              name: products.name,
              costPrice: products.costPrice,
              retailPrice: products.retailPrice,
              bulkPrice: products.bulkPrice,
              stockQuantity: products.stockQuantity,
              stockUnit: products.stockUnit,
              kgPerSack: products.kgPerSack,
              unitsPerCase: products.unitsPerCase,
            })
            .from(products)
            .where(
              and(inArray(products.id, allProductIds), eq(products.archived, false)),
            );

    const productById = new Map(selected.map((p) => [p.id, p]));

    let totalAmount = 0;
    const lines: Array<{
      productId: number;
      quantity: number;
      quantityTenths: number | null;
      saleUnit: SaleUnit;
      priceTier: "Retail" | "Bulk";
      unitCost: number;
      unitPrice: number;
      lineTotal: number;
      isExcessSale: boolean;
      lineNote: string | null;
    }> = [];

    const deductByProduct = new Map<number, number>();

    for (let i = 0; i < productIds.length; i++) {
      const productId = productIds[i]!;
      const saleUnitRaw = saleUnitsRaw[i] ?? "Piece";
      const saleUnit: SaleUnit = isSaleUnit(saleUnitRaw) ? saleUnitRaw : "Piece";
      const priceTier = priceTiersRaw[i] === "Bulk" ? "Bulk" : "Retail";
      const qtyParsed = parseQuantityInput(quantitiesRaw[i] ?? "", saleUnit);
      const p = productById.get(productId);

      if (!p || !qtyParsed) {
        return actionError("Invalid cart item. Check product and quantity.");
      }

      const { quantity, quantityTenths } = qtyParsed;
      const deductQty = stockDeductQuantity(
        saleUnit,
        quantity,
        quantityTenths,
        p.kgPerSack,
        p.unitsPerCase,
      );
      deductByProduct.set(
        productId,
        (deductByProduct.get(productId) ?? 0) + deductQty,
      );

      const unitPrice = unitPriceForSale(
        saleUnit,
        priceTier,
        p.retailPrice,
        p.bulkPrice,
        p.kgPerSack,
        p.unitsPerCase,
      );
      const lineTotal = lineTotalCents(
        unitPrice,
        saleUnit,
        quantity,
        quantityTenths,
      );

      totalAmount += lineTotal;
      lines.push({
        productId,
        quantity,
        quantityTenths,
        saleUnit,
        priceTier,
        unitCost: p.costPrice,
        unitPrice,
        lineTotal,
        isExcessSale: false,
        lineNote: null,
      });
    }

    for (let i = 0; i < excessProductIds.length; i++) {
      const productId = excessProductIds[i]!;
      const qtyLabel = excessQtyLabels[i]?.trim() ?? "";
      const qtyPreset = excessQtyPresets[i] ?? "";
      const lineTotal = parseMoneyToCents(excessAmountsRaw[i] ?? null);
      const p = productById.get(productId);

      if (!p || !qtyLabel || lineTotal <= 0) {
        return actionError("Invalid excess/bonus line. Check product, label, and amount.");
      }

      if (qtyPreset === "Custom") {
        const parsed = parseCustomSaleLabel(qtyLabel, {
          stockUnit: p.stockUnit as StockUnit,
          kgPerSack: p.kgPerSack,
          unitsPerCase: p.unitsPerCase,
        });
        if (!parsed) {
          return actionError(
            `Could not read custom quantity "${qtyLabel}". Try formats like "0.25 kg", "1 sack", or "3 pcs".`,
          );
        }

        const deductQty = stockDeductQuantity(
          parsed.saleUnit,
          parsed.quantity,
          parsed.quantityTenths,
          p.kgPerSack,
          p.unitsPerCase,
        );
        deductByProduct.set(
          productId,
          (deductByProduct.get(productId) ?? 0) + deductQty,
        );

        const effQty = effectiveQuantity(
          parsed.quantity,
          parsed.saleUnit,
          parsed.quantityTenths,
        );
        const unitPrice =
          effQty > 0 ? Math.round(lineTotal / effQty) : lineTotal;

        totalAmount += lineTotal;
        lines.push({
          productId,
          quantity: parsed.quantity,
          quantityTenths: parsed.quantityTenths,
          saleUnit: parsed.saleUnit,
          priceTier: "Retail",
          unitCost: p.costPrice,
          unitPrice,
          lineTotal,
          isExcessSale: false,
          lineNote: buildCustomSaleLineNote(parsed.displayLabel, excessNotesRaw[i]),
        });
        continue;
      }

      totalAmount += lineTotal;
      lines.push({
        productId,
        quantity: 1,
        quantityTenths: null,
        saleUnit: "Piece",
        priceTier: "Retail",
        unitCost: 0,
        unitPrice: lineTotal,
        lineTotal,
        isExcessSale: true,
        lineNote: buildExcessLineNote(qtyLabel, excessNotesRaw[i]),
      });
    }

    if (lines.length === 0) {
      return actionError("Add at least one valid item to the cart.");
    }

    if (deductStock) {
      for (const [productId, neededQty] of deductByProduct) {
        const p = productById.get(productId);
        if (!p) continue;
        if (p.stockQuantity < neededQty) {
          const stockLabel = formatStockLabel(
            p.stockUnit as import("@/db/schema").StockUnit,
            p.stockQuantity,
            p.kgPerSack,
            p.unitsPerCase,
          );
          return actionError(
            `Not enough stock for ${p.name} (${stockLabel} on hand). Uncheck "Deduct stock" or restock first.`,
          );
        }
      }
    }

    const customerId = await resolveCustomerForOrder({
      customerId: customerIdRaw > 0 ? customerIdRaw : undefined,
      customerName,
      contact: contactRaw,
      location: locationRaw,
    });

    const noteParts: string[] = [];
    if (notesRaw.length) noteParts.push(notesRaw);
    if (!deductStock) noteParts.push("[no-stock-deduct]");
    const notes = noteParts.length ? noteParts.join("\n") : null;

    const insertedOrder = await db
      .insert(orders)
      .values({
        customerId,
        customerName,
        contact: contactRaw.length ? contactRaw : null,
        location: locationRaw.length ? locationRaw : null,
        notes,
        orderStatus: "Pending",
        totalAmount,
        amountPaid: totalAmount,
        paymentStatus: "Paid",
        deliveryMethod: deliveryMethodRaw.length ? deliveryMethodRaw : null,
        storeType,
        stockDeducted: false,
        createdByUserId: session.userId,
        cashierName: session.name ?? session.email,
      })
      .returning({ id: orders.id, createdAt: orders.createdAt });

    const orderId = insertedOrder[0]?.id;
    const createdAt = insertedOrder[0]?.createdAt;
    if (!orderId || !createdAt) return actionError("Failed to create order.");

    await db.insert(orderItems).values(
      lines.map((line) => ({
        orderId,
        productId: line.productId,
        quantity: line.quantity,
        quantityTenths: line.quantityTenths,
        saleUnit: line.saleUnit,
        priceTier: line.priceTier,
        unitCost: line.unitCost,
        unitPrice: line.unitPrice,
        lineTotal: line.lineTotal,
        isExcessSale: line.isExcessSale,
        lineNote: line.lineNote,
      })),
    );

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

    if (customerId) {
      await bumpCustomerSpend(customerId, totalAmount);
    }

    revalidateSalesPages();

    const receiptLines = lines.map((line) => {
      const p = productById.get(line.productId)!;
      if (line.isExcessSale) {
        const qtyLabel =
          line.lineNote?.match(/^Excess\/bonus stock — (.+?) — no inventory/)?.[1] ??
          "bonus";
        return {
          label: excessLineLabel(p.name, qtyLabel),
          qtyLabel: qtyLabel,
          priceTier: "Excess",
          unitPrice: line.unitPrice,
          lineTotal: line.lineTotal,
          lineNote: line.lineNote,
          isExcessSale: true,
        };
      }
      return {
        label: p.name,
        qtyLabel: formatQuantityLabel(
          line.saleUnit,
          line.quantity,
          line.quantityTenths,
        ),
        priceTier: line.priceTier,
        unitPrice: line.unitPrice,
        lineTotal: line.lineTotal,
        lineNote: null,
        isExcessSale: false,
      };
    });

    const itemLabel = lines.length === 1 ? "1 item" : `${lines.length} items`;
    return actionSuccess(
      `Order #${orderId} created as Pending — ${itemLabel}, ${formatPhpFromCents(totalAmount)} collected. Complete it from the orders table when ready.`,
      {
        orderId,
        receipt: {
          orderId,
          customerName,
          contact: contactRaw.length ? contactRaw : null,
          location: locationRaw.length ? locationRaw : null,
          storeType,
          deliveryMethod: deliveryMethodRaw.length ? deliveryMethodRaw : null,
          orderStatus: "Pending",
          paymentStatus: "Paid",
          totalAmount,
          amountPaid: totalAmount,
          createdAt: createdAt.toISOString(),
          cashierName: session.name ?? session.email,
          lines: receiptLines,
        },
      },
    );
  } catch (err) {
    console.error("quickSell failed:", err);
    return actionError(formatActionError(err));
  }
}

export async function createBulkOrder(
  _prev: OrderActionResult | null,
  formData: FormData,
): Promise<OrderActionResult> {
  try {
    const session = await requireAuth();

    const customerName = String(formData.get("customerName") ?? "").trim();
    const contactRaw = String(formData.get("contact") ?? "").trim();
    const locationRaw = String(formData.get("location") ?? "").trim();
    const customerIdRaw = parseIntOr(formData.get("customerId"), 0);
    const notesRaw = String(formData.get("notes") ?? "").trim();
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
    const saleUnitRaw = String(formData.get("saleUnit") ?? "Piece");
    const saleUnit: SaleUnit = isSaleUnit(saleUnitRaw) ? saleUnitRaw : "Piece";
    const quantitiesRaw = formData.getAll("quantity").map((v) => String(v));

    if (!customerName) return actionError("Customer name is required.");
    if (productIds.length === 0 || quantities.length === 0) {
      return actionError("Add at least 1 item.");
    }

    const selected = await db
      .select({
        id: products.id,
        name: products.name,
        costPrice: products.costPrice,
        retailPrice: products.retailPrice,
        bulkPrice: products.bulkPrice,
        kgPerSack: products.kgPerSack,
        unitsPerCase: products.unitsPerCase,
      })
      .from(products)
      .where(and(inArray(products.id, productIds), eq(products.archived, false)));

    const priceById = new Map(selected.map((p) => [p.id, p]));

    let total = 0;
    const lines: Array<{
      productId: number;
      quantity: number;
      quantityTenths: number | null;
      saleUnit: SaleUnit;
      unitCost: number;
      unitPrice: number;
      lineTotal: number;
    }> = [];

    for (let i = 0; i < productIds.length; i++) {
      const id = productIds[i]!;
      const qtyParsed = parseQuantityInput(
        quantitiesRaw[i] ?? String(quantities[i] ?? ""),
        saleUnit,
      );
      if (!qtyParsed) continue;
      const prod = priceById.get(id);
      if (!prod) continue;
      const unitPrice = unitPriceForSale(
        saleUnit,
        priceTier,
        prod.retailPrice,
        prod.bulkPrice,
        prod.kgPerSack,
        prod.unitsPerCase,
      );
      const lineTotal = lineTotalCents(
        unitPrice,
        saleUnit,
        qtyParsed.quantity,
        qtyParsed.quantityTenths,
      );
      total += lineTotal;
      lines.push({
        productId: id,
        quantity: qtyParsed.quantity,
        quantityTenths: qtyParsed.quantityTenths,
        saleUnit,
        unitCost: prod.costPrice,
        unitPrice,
        lineTotal,
      });
    }

    if (lines.length === 0) return actionError("Invalid items.");

    const deposit = Math.round(total * 0.3);

    const customerId = await resolveCustomerForOrder({
      customerId: customerIdRaw > 0 ? customerIdRaw : undefined,
      customerName,
      contact: contactRaw,
      location: locationRaw,
    });

    const insertedOrder = await db
      .insert(orders)
      .values({
        customerId,
        customerName,
        contact: contactRaw.length ? contactRaw : null,
        location: locationRaw.length ? locationRaw : null,
        notes: notesRaw.length ? notesRaw : null,
        orderStatus: "Pending",
        totalAmount: total,
        amountPaid: deposit,
        paymentStatus: "30% Deposit",
        deliveryMethod: deliveryMethodRaw.length ? deliveryMethodRaw : null,
        storeType,
        createdByUserId: session.userId,
        cashierName: session.name ?? session.email,
      })
      .returning({ id: orders.id, createdAt: orders.createdAt });

    const orderId = insertedOrder[0]?.id;
    const createdAt = insertedOrder[0]?.createdAt;
    if (!orderId || !createdAt) return actionError("Failed to create bulk order.");

    await db.insert(orderItems).values(
      lines.map((l) => ({
        orderId,
        productId: l.productId,
        quantity: l.quantity,
        quantityTenths: l.quantityTenths,
        saleUnit: l.saleUnit,
        priceTier,
        unitCost: l.unitCost,
        unitPrice: l.unitPrice,
        lineTotal: l.lineTotal,
      })),
    );

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

    if (customerId && deposit > 0) {
      await bumpCustomerSpend(customerId, deposit);
    }

    revalidateSalesPages();

    const receiptLines = lines.map((line) => {
      const p = priceById.get(line.productId)!;
      return {
        label: p.name,
        qtyLabel: formatQuantityLabel(
          line.saleUnit,
          line.quantity,
          line.quantityTenths,
        ),
        priceTier,
        unitPrice: line.unitPrice,
        lineTotal: line.lineTotal,
      };
    });

    return actionSuccess(
      `Order #${orderId} created as Pending — ${formatPhpFromCents(deposit)} deposit collected. Complete it from the orders table when ready.`,
      {
        orderId,
        receipt: {
          orderId,
          customerName,
          contact: contactRaw.length ? contactRaw : null,
          location: locationRaw.length ? locationRaw : null,
          storeType,
          deliveryMethod: deliveryMethodRaw.length ? deliveryMethodRaw : null,
          orderStatus: "Pending",
          paymentStatus: "30% Deposit",
          totalAmount: total,
          amountPaid: deposit,
          createdAt: createdAt.toISOString(),
          cashierName: session.name ?? session.email,
          lines: receiptLines,
        },
      },
    );
  } catch (err) {
    console.error("createBulkOrder failed:", err);
    return actionError(formatActionError(err));
  }
}

export async function cancelOrder(formData: FormData) {
  await requireAdmin();

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
  const status = normalizeOrderStatus(order.orderStatus);
  if (status === "Cancelled") {
    throw new Error("Order is already cancelled.");
  }

  const lines = await db
    .select({
      productId: orderItems.productId,
      quantity: orderItems.quantity,
      quantityTenths: orderItems.quantityTenths,
      saleUnit: orderItems.saleUnit,
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
      const [p] = await db
        .select({
          kgPerSack: products.kgPerSack,
          unitsPerCase: products.unitsPerCase,
        })
        .from(products)
        .where(eq(products.id, l.productId))
        .limit(1);
      const qty = stockRestockQuantity(
        l.saleUnit as SaleUnit,
        l.quantity,
        l.quantityTenths,
        p?.kgPerSack,
        p?.unitsPerCase,
      );
      restockByProduct.set(
        l.productId,
        (restockByProduct.get(l.productId) ?? 0) + qty,
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

  revalidateSalesPages();
}

export async function updateOrderStatus(formData: FormData) {
  await requireAdmin();

  const orderId = parseIntOr(formData.get("orderId"), 0);
  const nextStatus = String(formData.get("orderStatus") ?? "") as OrderStatus;

  if (!orderId) throw new Error("Invalid order.");
  if (!(ORDER_STATUSES as readonly string[]).includes(nextStatus)) {
    throw new Error("Invalid order status.");
  }

  const [order] = await db
    .select({
      id: orders.id,
      orderStatus: orders.orderStatus,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) throw new Error("Order not found.");

  const current = normalizeOrderStatus(order.orderStatus);
  if (current === "Cancelled") {
    throw new Error("Cancelled orders cannot be updated.");
  }

  await db
    .update(orders)
    .set({ orderStatus: nextStatus })
    .where(eq(orders.id, orderId));

  if (nextStatus === "Out for Delivery") {
    await db
      .update(deliveryLogs)
      .set({ status: "Picked Up" })
      .where(eq(deliveryLogs.orderId, orderId));
  } else if (nextStatus === "Completed") {
    await db
      .update(deliveryLogs)
      .set({ status: "Delivered" })
      .where(eq(deliveryLogs.orderId, orderId));
    await deductStockForOrder(orderId);
  } else if (nextStatus === "Cancelled") {
    await db
      .update(deliveryLogs)
      .set({ status: "Cancelled" })
      .where(eq(deliveryLogs.orderId, orderId));
  }

  revalidateSalesPages();
}

export async function markOrderPaid(formData: FormData) {
  await requireAdmin();

  const orderId = parseIntOr(formData.get("orderId"), 0);
  if (!orderId) throw new Error("Invalid order.");

  const [o] = await db
    .select({
      id: orders.id,
      customerId: orders.customerId,
      totalAmount: orders.totalAmount,
      amountPaid: orders.amountPaid,
      paymentStatus: orders.paymentStatus,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!o) throw new Error("Order not found.");
  if (o.paymentStatus === "Paid") return;

  const delta = o.totalAmount - o.amountPaid;
  await db
    .update(orders)
    .set({ amountPaid: o.totalAmount, paymentStatus: "Paid" })
    .where(eq(orders.id, orderId));

  if (o.customerId && delta > 0) {
    await bumpCustomerSpend(o.customerId, delta);
  }

  revalidateSalesPages();
}

export async function addPayment(formData: FormData) {
  await requireAdmin();

  const orderId = parseIntOr(formData.get("orderId"), 0);
  const addAmount = parseMoneyToCents(formData.get("addAmount"));
  if (!orderId || addAmount <= 0) throw new Error("Invalid payment.");

  const [o] = await db
    .select({
      id: orders.id,
      customerId: orders.customerId,
      totalAmount: orders.totalAmount,
      amountPaid: orders.amountPaid,
      paymentStatus: orders.paymentStatus,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!o) throw new Error("Order not found.");

  const prevPaid = o.amountPaid;
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

  const delta = newPaid - prevPaid;
  if (o.customerId && delta > 0) {
    await bumpCustomerSpend(o.customerId, delta);
  }

  revalidateSalesPages();
}

export async function updateOrderLineItem(formData: FormData) {
  await requireAdmin();

  const lineId = parseIntOr(formData.get("lineId"), 0);
  const orderId = parseIntOr(formData.get("orderId"), 0);
  const saleUnitRaw = String(formData.get("saleUnit") ?? "Piece");
  const saleUnit: SaleUnit = isSaleUnit(saleUnitRaw) ? saleUnitRaw : "Piece";
  const priceTier = String(formData.get("priceTier") ?? "Retail") as
    | "Retail"
    | "Bulk";
  const quantityRaw = String(formData.get("quantity") ?? "");
  const unitPriceOverride = parseMoneyToCents(formData.get("unitPrice"));

  if (!lineId || !orderId) throw new Error("Invalid order line.");
  const qtyParsed = parseQuantityInput(quantityRaw, saleUnit);
  if (!qtyParsed) throw new Error("Enter a valid quantity.");

  const [order] = await db
    .select({ orderStatus: orders.orderStatus })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) throw new Error("Order not found.");
  if (normalizeOrderStatus(order.orderStatus) === "Cancelled") {
    throw new Error("Cannot edit a cancelled order.");
  }

  const [line] = await db
    .select({
      id: orderItems.id,
      productId: orderItems.productId,
    })
    .from(orderItems)
    .where(and(eq(orderItems.id, lineId), eq(orderItems.orderId, orderId)))
    .limit(1);

  if (!line) throw new Error("Line item not found.");

  const [product] = await db
    .select({
      costPrice: products.costPrice,
      retailPrice: products.retailPrice,
      bulkPrice: products.bulkPrice,
      kgPerSack: products.kgPerSack,
      unitsPerCase: products.unitsPerCase,
    })
    .from(products)
    .where(eq(products.id, line.productId))
    .limit(1);

  if (!product) throw new Error("Product not found.");

  const unitPrice =
    unitPriceOverride > 0
      ? unitPriceOverride
      : unitPriceForSale(
          saleUnit,
          priceTier,
          product.retailPrice,
          product.bulkPrice,
          product.kgPerSack,
          product.unitsPerCase,
        );

  const lineTotal = lineTotalCents(
    unitPrice,
    saleUnit,
    qtyParsed.quantity,
    qtyParsed.quantityTenths,
  );

  await db
    .update(orderItems)
    .set({
      quantity: qtyParsed.quantity,
      quantityTenths: qtyParsed.quantityTenths,
      saleUnit,
      priceTier,
      unitCost: product.costPrice,
      unitPrice,
      lineTotal,
    })
    .where(eq(orderItems.id, lineId));

  await recalcOrderTotal(orderId);

  revalidateSalesPages();
}

export async function updateOrderDetails(formData: FormData) {
  await requireAdmin();

  const orderId = parseIntOr(formData.get("orderId"), 0);
  if (!orderId) throw new Error("Invalid order.");

  const storeType = String(formData.get("storeType") ?? "Online") as
    | "Online"
    | "Walk-in";
  const customerName = String(formData.get("customerName") ?? "").trim();
  const contactRaw = String(formData.get("contact") ?? "").trim();
  const locationRaw = String(formData.get("location") ?? "").trim();
  const deliveryMethodRaw = String(formData.get("deliveryMethod") ?? "").trim();
  const notesRaw = String(formData.get("notes") ?? "").trim();

  if (!customerName) throw new Error("Customer name is required.");

  const [order] = await db
    .select({ orderStatus: orders.orderStatus })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) throw new Error("Order not found.");
  if (normalizeOrderStatus(order.orderStatus) === "Cancelled") {
    throw new Error("Cannot edit a cancelled order.");
  }

  await db
    .update(orders)
    .set({
      storeType,
      customerName,
      contact: contactRaw.length ? contactRaw : null,
      location: locationRaw.length ? locationRaw : null,
      deliveryMethod: deliveryMethodRaw.length ? deliveryMethodRaw : null,
      notes: notesRaw.length ? notesRaw : null,
    })
    .where(eq(orders.id, orderId));

  revalidateSalesPages();
}

