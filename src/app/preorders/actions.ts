"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/db";
import {
  preOrderItems,
  preOrders,
  products,
  supplierCatalogItems,
  suppliers,
} from "@/db/schema";
import { requireAuth } from "@/lib/auth-guard";
import {
  fulfillPreOrder,
  syncPreOrderReceiveStatus,
  tryAutoFulfillPreOrdersForProduct,
} from "@/lib/preorder-fulfillment";
import { and, eq } from "drizzle-orm";

export type PreOrderActionResult = {
  ok?: boolean;
  error?: string;
  message?: string;
  orderId?: number;
};

function formatError(err: unknown) {
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

import { revalidateSalesPages } from "@/lib/revalidate-sales";

function revalidatePreOrderPaths() {
  revalidatePath("/preorders");
  revalidatePath("/customers");
  revalidateSalesPages();
}

async function resolveSupplierId(
  productSupplierId: number | null,
  formSupplierId: number | null,
) {
  if (formSupplierId && formSupplierId > 0) return formSupplierId;
  if (productSupplierId && productSupplierId > 0) return productSupplierId;

  const [fallback] = await db
    .select({ id: suppliers.id })
    .from(suppliers)
    .limit(1);

  if (!fallback) throw new Error("Add a supplier first (used for internal tracking only).");
  return fallback.id;
}

export async function createPreOrder(formData: FormData) {
  await requireAuth();

  const itemMode = String(formData.get("itemMode") ?? "inventory");
  const productId = Number.parseInt(String(formData.get("productId") ?? ""), 10);
  const catalogItemId = Number.parseInt(
    String(formData.get("supplierCatalogItemId") ?? ""),
    10,
  );
  const formSupplierId = Number.parseInt(
    String(formData.get("supplierId") ?? ""),
    10,
  );
  const quantity = parseIntOr(formData.get("quantity"), 0);
  const customerName = String(formData.get("customerName") ?? "").trim();
  const depositCents = parseMoneyToCents(formData.get("deposit"));
  const notes = String(formData.get("notes") ?? "").trim();
  const expectedRaw = String(formData.get("expectedDate") ?? "").trim();
  const expectedDate = expectedRaw ? new Date(expectedRaw) : null;

  if (quantity <= 0) throw new Error("Quantity must be at least 1.");

  let lineProductId: number | null = null;
  let lineCatalogId: number | null = null;
  let itemName = "";
  let brand: string | null = null;
  let variant: string | null = null;
  let unitCostCents = 0;
  let supplierId: number;

  if (itemMode === "new") {
    itemName = String(formData.get("itemName") ?? "").trim();
    brand = String(formData.get("brand") ?? "").trim() || null;
    variant = String(formData.get("variant") ?? "").trim() || null;
    unitCostCents = parseMoneyToCents(formData.get("unitCost"));

    if (!itemName) {
      throw new Error("Enter the item name for this pre-order.");
    }

    if (Number.isFinite(catalogItemId) && catalogItemId > 0) {
      const [catalog] = await db
        .select({
          id: supplierCatalogItems.id,
          itemName: supplierCatalogItems.itemName,
          brand: supplierCatalogItems.brand,
          variant: supplierCatalogItems.variant,
          unitCost: supplierCatalogItems.unitCost,
          supplierId: supplierCatalogItems.supplierId,
        })
        .from(supplierCatalogItems)
        .where(eq(supplierCatalogItems.id, catalogItemId))
        .limit(1);

      if (!catalog) throw new Error("Supplier catalog item not found.");

      lineCatalogId = catalog.id;
      itemName = itemName || catalog.itemName;
      brand = brand || catalog.brand;
      variant = variant || catalog.variant?.trim() || null;
      if (unitCostCents <= 0) unitCostCents = catalog.unitCost ?? 0;

      supplierId = await resolveSupplierId(
        catalog.supplierId,
        Number.isFinite(formSupplierId) && formSupplierId > 0
          ? formSupplierId
          : null,
      );
    } else {
      if (unitCostCents <= 0) {
        throw new Error("Enter an estimated unit cost (₱) for this new item.");
      }
      supplierId = await resolveSupplierId(
        null,
        Number.isFinite(formSupplierId) && formSupplierId > 0
          ? formSupplierId
          : null,
      );
    }

    const [existingProduct] = await db
      .select({ id: products.id })
      .from(products)
      .where(
        and(eq(products.archived, false), eq(products.name, itemName)),
      )
      .limit(1);

    if (existingProduct) {
      lineProductId = existingProduct.id;
    }
  } else {
    if (!Number.isFinite(productId) || productId <= 0) {
      throw new Error("Select an inventory product.");
    }

    const [product] = await db
      .select({
        id: products.id,
        name: products.name,
        brand: products.brand,
        variant: products.variant,
        costPrice: products.costPrice,
        supplierId: products.supplierId,
        supplierCatalogItemId: products.supplierCatalogItemId,
      })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);

    if (!product) throw new Error("Product not found in inventory.");

    lineProductId = product.id;
    lineCatalogId = product.supplierCatalogItemId;
    itemName = product.name;
    brand = product.brand;
    variant = product.variant?.trim() || null;
    unitCostCents = product.costPrice;

    supplierId = await resolveSupplierId(
      product.supplierId,
      Number.isFinite(formSupplierId) && formSupplierId > 0
        ? formSupplierId
        : null,
    );
  }

  const lineTotalCents = unitCostCents * quantity;

  const inserted = await db
    .insert(preOrders)
    .values({
      supplierId,
      status: "Draft",
      customerName: customerName || null,
      expectedDate,
      depositCents,
      totalCostCents: lineTotalCents,
      notes: notes || null,
    })
    .returning({ id: preOrders.id });

  const preOrderId = inserted[0]?.id;
  if (!preOrderId) throw new Error("Failed to create pre-order.");

  await db.insert(preOrderItems).values({
    preOrderId,
    productId: lineProductId,
    supplierCatalogItemId: lineCatalogId,
    itemName,
    brand,
    variant,
    quantity,
    unitCostCents,
    lineTotalCents,
  });

  revalidatePath("/preorders");
  revalidatePath("/customers");
}

export async function linkPreOrderItemToProduct(
  _prev: PreOrderActionResult | null,
  formData: FormData,
): Promise<PreOrderActionResult> {
  try {
    await requireAuth();

    const itemId = Number.parseInt(String(formData.get("itemId") ?? ""), 10);
    const productId = Number.parseInt(String(formData.get("productId") ?? ""), 10);

    if (!Number.isFinite(itemId) || itemId <= 0) {
      return { error: "Invalid pre-order line." };
    }
    if (!Number.isFinite(productId) || productId <= 0) {
      return { error: "Select an inventory product to link." };
    }

    const [item] = await db
      .select({
        id: preOrderItems.id,
        productId: preOrderItems.productId,
        preOrderId: preOrderItems.preOrderId,
      })
      .from(preOrderItems)
      .where(eq(preOrderItems.id, itemId))
      .limit(1);

    if (!item) return { error: "Pre-order line not found." };
    if (item.productId != null) {
      return { error: "This line is already linked to inventory." };
    }

    const [product] = await db
      .select({
        id: products.id,
        archived: products.archived,
      })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);

    if (!product || product.archived) {
      return { error: "Inventory product not found." };
    }

    await db
      .update(preOrderItems)
      .set({ productId: product.id })
      .where(eq(preOrderItems.id, itemId));

    await tryAutoFulfillPreOrdersForProduct(product.id);

    revalidatePreOrderPaths();
    return {
      ok: true,
      message: "Linked to inventory. Restock when stock arrives to auto-fulfill.",
    };
  } catch (err) {
    console.error("linkPreOrderItemToProduct failed:", err);
    return { error: formatError(err) };
  }
}

export async function updatePreOrderStatus(
  _prev: PreOrderActionResult | null,
  formData: FormData,
): Promise<PreOrderActionResult> {
  try {
    await requireAuth();

    const id = Number.parseInt(String(formData.get("id") ?? ""), 10);
    const status = String(formData.get("status") ?? "");

    if (!Number.isFinite(id) || id <= 0) {
      return { error: "Invalid pre-order." };
    }

    const valid = [
      "Draft",
      "Ordered",
      "In Transit",
      "Partial",
      "Received",
      "Cancelled",
    ] as const;
    if (!valid.includes(status as (typeof valid)[number])) {
      return { error: "Invalid status." };
    }

    await db
      .update(preOrders)
      .set({ status: status as (typeof valid)[number] })
      .where(eq(preOrders.id, id));

    if (status === "Received") {
      const result = await fulfillPreOrder(id);
      revalidatePreOrderPaths();
      return {
        ok: true,
        message: result.message,
        orderId: result.orderId,
      };
    }

    revalidatePath("/preorders");
  revalidatePath("/customers");
    return { ok: true, message: "Status updated." };
  } catch (err) {
    console.error("updatePreOrderStatus failed:", err);
    return { error: formatError(err) };
  }
}

export async function receivePreOrderItem(
  _prev: PreOrderActionResult | null,
  formData: FormData,
): Promise<PreOrderActionResult> {
  try {
    await requireAuth();

    const itemId = Number.parseInt(String(formData.get("itemId") ?? ""), 10);
    const receivedQty = parseIntOr(formData.get("receivedQty"), 0);

    if (!Number.isFinite(itemId) || itemId <= 0) {
      return { error: "Invalid item." };
    }
    if (receivedQty < 0) return { error: "Received qty cannot be negative." };

    const [item] = await db
      .select({ preOrderId: preOrderItems.preOrderId })
      .from(preOrderItems)
      .where(eq(preOrderItems.id, itemId))
      .limit(1);

    if (!item) return { error: "Item not found." };

    await db
      .update(preOrderItems)
      .set({ receivedQty })
      .where(eq(preOrderItems.id, itemId));

    const nextStatus = await syncPreOrderReceiveStatus(item.preOrderId);
    if (nextStatus) {
      await db
        .update(preOrders)
        .set({ status: nextStatus })
        .where(eq(preOrders.id, item.preOrderId));

      if (nextStatus === "Received") {
        const result = await fulfillPreOrder(item.preOrderId);
        revalidatePreOrderPaths();
        return {
          ok: true,
          message: result.message,
          orderId: result.orderId,
        };
      }
    }

    revalidatePath("/preorders");
  revalidatePath("/customers");
    return { ok: true, message: "Received quantity saved." };
  } catch (err) {
    console.error("receivePreOrderItem failed:", err);
    return { error: formatError(err) };
  }
}

export async function deletePreOrder(formData: FormData) {
  await requireAuth();

  const id = Number.parseInt(String(formData.get("id") ?? ""), 10);
  if (!Number.isFinite(id) || id <= 0) throw new Error("Invalid pre-order.");

  const [row] = await db
    .select({ fulfillmentOrderId: preOrders.fulfillmentOrderId })
    .from(preOrders)
    .where(eq(preOrders.id, id))
    .limit(1);

  if (row?.fulfillmentOrderId) {
    throw new Error(
      `Cannot delete — linked to sales order #${row.fulfillmentOrderId}. Cancel the order first.`,
    );
  }

  await db.delete(preOrderItems).where(eq(preOrderItems.preOrderId, id));
  await db.delete(preOrders).where(eq(preOrders.id, id));

  revalidatePath("/preorders");
  revalidatePath("/customers");
}
