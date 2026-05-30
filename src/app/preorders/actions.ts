"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/db";
import {
  preOrderItems,
  preOrders,
  supplierCatalogItems,
} from "@/db/schema";
import {
  displayCatalogFlavor,
  displayCatalogItem,
} from "@/lib/catalog-item-display";
import { requireAuth } from "@/lib/auth-guard";
import { eq } from "drizzle-orm";

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

export async function createPreOrder(formData: FormData) {
  await requireAuth();

  const supplierId = Number.parseInt(
    String(formData.get("supplierId") ?? ""),
    10,
  );
  const catalogItemId = Number.parseInt(
    String(formData.get("catalogItemId") ?? ""),
    10,
  );
  const quantity = parseIntOr(formData.get("quantity"), 0);
  const customerName = String(formData.get("customerName") ?? "").trim();
  const depositCents = parseMoneyToCents(formData.get("deposit"));
  const notes = String(formData.get("notes") ?? "").trim();
  const expectedRaw = String(formData.get("expectedDate") ?? "").trim();
  const expectedDate = expectedRaw ? new Date(expectedRaw) : null;

  if (!Number.isFinite(supplierId) || supplierId <= 0) {
    throw new Error("Select a supplier.");
  }
  if (!Number.isFinite(catalogItemId) || catalogItemId <= 0) {
    throw new Error("Select a catalog item.");
  }
  if (quantity <= 0) throw new Error("Quantity must be at least 1.");

  const [catalog] = await db
    .select({
      itemName: supplierCatalogItems.itemName,
      brand: supplierCatalogItems.brand,
      variant: supplierCatalogItems.variant,
      unitCost: supplierCatalogItems.unitCost,
    })
    .from(supplierCatalogItems)
    .where(eq(supplierCatalogItems.id, catalogItemId))
    .limit(1);

  if (!catalog) throw new Error("Catalog item not found.");

  const unitCostCents = catalog.unitCost ?? 0;
  const lineTotalCents = unitCostCents * quantity;
  const itemName = displayCatalogItem(catalog.brand, catalog.itemName);
  const variant =
    displayCatalogFlavor(catalog.variant, catalog.itemName) !== "—"
      ? displayCatalogFlavor(catalog.variant, catalog.itemName)
      : null;

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
    supplierCatalogItemId: catalogItemId,
    itemName,
    brand: catalog.brand,
    variant,
    quantity,
    unitCostCents,
    lineTotalCents,
  });

  revalidatePath("/preorders");
}

export async function updatePreOrderStatus(formData: FormData) {
  await requireAuth();

  const id = Number.parseInt(String(formData.get("id") ?? ""), 10);
  const status = String(formData.get("status") ?? "");

  if (!Number.isFinite(id) || id <= 0) throw new Error("Invalid pre-order.");

  const valid = [
    "Draft",
    "Ordered",
    "In Transit",
    "Partial",
    "Received",
    "Cancelled",
  ] as const;
  if (!valid.includes(status as (typeof valid)[number])) {
    throw new Error("Invalid status.");
  }

  await db
    .update(preOrders)
    .set({ status: status as (typeof valid)[number] })
    .where(eq(preOrders.id, id));

  revalidatePath("/preorders");
}

export async function receivePreOrderItem(formData: FormData) {
  await requireAuth();

  const itemId = Number.parseInt(String(formData.get("itemId") ?? ""), 10);
  const receivedQty = parseIntOr(formData.get("receivedQty"), 0);

  if (!Number.isFinite(itemId) || itemId <= 0) throw new Error("Invalid item.");
  if (receivedQty < 0) throw new Error("Received qty cannot be negative.");

  await db
    .update(preOrderItems)
    .set({ receivedQty })
    .where(eq(preOrderItems.id, itemId));

  revalidatePath("/preorders");
}

export async function deletePreOrder(formData: FormData) {
  await requireAuth();

  const id = Number.parseInt(String(formData.get("id") ?? ""), 10);
  if (!Number.isFinite(id) || id <= 0) throw new Error("Invalid pre-order.");

  await db.delete(preOrderItems).where(eq(preOrderItems.preOrderId, id));
  await db.delete(preOrders).where(eq(preOrders.id, id));

  revalidatePath("/preorders");
}
