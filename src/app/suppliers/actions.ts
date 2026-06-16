"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/db";
import {
  preOrders,
  products,
  supplierCatalogItems,
  supplierDocuments,
  supplierPriceChanges,
  supplierPriceHistory,
  suppliers,
} from "@/db/schema";
import { parseSupplierFile } from "@/lib/supplier-parse";
import { requireAuth } from "@/lib/auth-guard";
import { inferPriceUnit } from "@/lib/price-units";
import {
  normalizeCatalogItemType,
} from "@/lib/catalog-item-types";
import { catalogItemKey, percentChange } from "@/lib/supplier-item-key";
import { and, eq } from "drizzle-orm";

const INSERT_CHUNK = 40;

function chunk<T>(rows: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) {
    out.push(rows.slice(i, i + size));
  }
  return out;
}

export type UploadCatalogResult = {
  ok?: boolean;
  error?: string;
  message?: string;
  itemCount?: number;
};

export async function createSupplier(formData: FormData) {
  await requireAuth();

  const name = String(formData.get("name") ?? "").trim();
  const contactRaw = String(formData.get("contact") ?? "").trim();
  const locationRaw = String(formData.get("location") ?? "").trim();
  const notesRaw = String(formData.get("notes") ?? "").trim();

  if (!name) throw new Error("Supplier name is required.");

  await db.insert(suppliers).values({
    name,
    contact: contactRaw.length ? contactRaw : null,
    location: locationRaw.length ? locationRaw : null,
    notes: notesRaw.length ? notesRaw : null,
  });

  revalidatePath("/suppliers");
}

export async function uploadSupplierCatalog(
  _prev: UploadCatalogResult | null,
  formData: FormData,
): Promise<UploadCatalogResult> {
  try {
    await requireAuth();

    const supplierId = Number.parseInt(
      String(formData.get("supplierId") ?? ""),
      10,
    );
    const file = formData.get("file");

    if (!Number.isFinite(supplierId) || supplierId <= 0) {
      return { error: "Select a supplier." };
    }

    if (!(file instanceof File) || file.size === 0) {
      return { error: "Choose a file to upload." };
    }

    if (file.size > 10 * 1024 * 1024) {
      return { error: "File is too large (max 10 MB)." };
    }

    const [supplier] = await db
      .select({ id: suppliers.id })
      .from(suppliers)
      .where(eq(suppliers.id, supplierId))
      .limit(1);

    if (!supplier) return { error: "Supplier not found." };

    const existingCatalog = await db
      .select({
        id: supplierCatalogItems.id,
        documentId: supplierCatalogItems.documentId,
        itemName: supplierCatalogItems.itemName,
        brand: supplierCatalogItems.brand,
        variant: supplierCatalogItems.variant,
        unitCost: supplierCatalogItems.unitCost,
      })
      .from(supplierCatalogItems)
      .where(eq(supplierCatalogItems.supplierId, supplierId));

    const previousDocumentId =
      existingCatalog.find((row) => row.documentId != null)?.documentId ?? null;

    const buffer = Buffer.from(await file.arrayBuffer());
    const safeName = file.name.replace(/[^\w.\-() ]+/g, "_");

    let parsed;
    try {
      parsed = await parseSupplierFile(buffer, file.name);
    } catch (parseErr) {
      console.error("Catalog parse failed:", parseErr);
      return {
        error:
          parseErr instanceof Error
            ? `Could not read file: ${parseErr.message}`
            : "Could not read file. Try PDF, xlsx, or csv.",
      };
    }

    if (parsed.length === 0) {
      return {
        error:
          "No items found in this file. Use a supplier price list (PDF, xlsx, csv).",
      };
    }

    const insertedDoc = await db
      .insert(supplierDocuments)
      .values({
        supplierId,
        fileName: file.name,
        filePath: `catalog://${supplierId}/${Date.now()}-${safeName}`,
        mimeType: file.type || null,
      })
      .returning({ id: supplierDocuments.id });

    const documentId = insertedDoc[0]?.id;
    if (!documentId) return { error: "Failed to save document record." };

    const now = new Date();

    const oldByKey = new Map(
      existingCatalog.map((row) => [catalogItemKey(row), row]),
    );

    const newByKey = new Map(
      parsed.map((row) => [
        catalogItemKey({
          brand: row.brand,
          variant: row.variant,
          itemName: row.itemName,
        }),
        row,
      ]),
    );

    const priceChangeRows: (typeof supplierPriceChanges.$inferInsert)[] = [];

    for (const row of parsed) {
      const key = catalogItemKey({
        brand: row.brand,
        variant: row.variant,
        itemName: row.itemName,
      });
      const previous = oldByKey.get(key);
      const previousCost = previous?.unitCost ?? null;
      const newCost = row.unitCostCents ?? null;
      const changePct = percentChange(previousCost, newCost);

      if (previousCost != null || newCost != null) {
        priceChangeRows.push({
          supplierId,
          itemKey: key,
          itemName: row.itemName,
          brand: row.brand ?? null,
          variant: row.variant ?? null,
          previousUnitCost: previousCost,
          newUnitCost: newCost,
          changePercent:
            changePct != null ? Math.round(changePct) : null,
          previousDocumentId,
          newDocumentId: documentId,
          recordedAt: now,
        });
      }
    }

    for (const [key, previous] of oldByKey) {
      if (newByKey.has(key)) continue;
      priceChangeRows.push({
        supplierId,
        itemKey: key,
        itemName: previous.itemName,
        brand: previous.brand,
        variant: previous.variant,
        previousUnitCost: previous.unitCost,
        newUnitCost: null,
        changePercent: null,
        previousDocumentId,
        newDocumentId: documentId,
        recordedAt: now,
      });
    }

    await db
      .delete(supplierCatalogItems)
      .where(eq(supplierCatalogItems.supplierId, supplierId));

    const catalogRows = parsed.map((row) => ({
      supplierId,
      documentId,
      itemName: row.itemName,
      brand: row.brand ?? null,
      variant: row.variant ?? null,
      sku: row.sku ?? null,
      unitCost: row.unitCostCents ?? null,
      packSize: row.packSize ?? null,
      packUnit: row.packUnit ?? null,
      perKiloPrice: row.perKiloCents ?? null,
      retailPrice: row.retailPriceCents ?? null,
      itemType: normalizeCatalogItemType(row.itemType),
      productName: row.productName ?? null,
      notes: row.notes ?? null,
      priceUnit: inferPriceUnit({
        itemType: row.itemType,
        packUnit: row.packUnit,
        packSize: row.packSize,
        itemName: row.itemName,
      }),
      unitsPerCase: 24,
    }));

    const historyRows = parsed.map((row) => ({
      supplierId,
      documentId,
      itemKey: catalogItemKey({
        brand: row.brand,
        variant: row.variant,
        itemName: row.itemName,
      }),
      itemName: row.itemName,
      brand: row.brand ?? null,
      variant: row.variant ?? null,
      unitCost: row.unitCostCents ?? null,
      retailPrice: row.retailPriceCents ?? null,
      perKiloPrice: row.perKiloCents ?? null,
      recordedAt: now,
    }));

    for (const batch of chunk(catalogRows, INSERT_CHUNK)) {
      await db.insert(supplierCatalogItems).values(batch);
    }

    if (priceChangeRows.length) {
      for (const batch of chunk(priceChangeRows, INSERT_CHUNK)) {
        await db.insert(supplierPriceChanges).values(batch);
      }
    }

    for (const batch of chunk(historyRows, INSERT_CHUNK)) {
      await db.insert(supplierPriceHistory).values(batch);
    }

    revalidatePath("/suppliers");

    return {
      ok: true,
      message: `Imported ${parsed.length} items for this supplier.`,
      itemCount: parsed.length,
    };
  } catch (err) {
    console.error("uploadSupplierCatalog failed:", err);
    return {
      error:
        err instanceof Error
          ? err.message
          : "Upload failed. Please try again.",
    };
  }
}

export async function deleteSupplier(formData: FormData) {
  await requireAuth();

  const supplierId = Number.parseInt(
    String(formData.get("supplierId") ?? ""),
    10,
  );
  const mode = String(formData.get("mode") ?? "disconnect");

  if (!Number.isFinite(supplierId) || supplierId <= 0) {
    throw new Error("Invalid supplier.");
  }

  if (mode === "purge") {
    await db
      .delete(supplierPriceChanges)
      .where(eq(supplierPriceChanges.supplierId, supplierId));
    await db
      .delete(supplierPriceHistory)
      .where(eq(supplierPriceHistory.supplierId, supplierId));
    await db
      .delete(supplierCatalogItems)
      .where(eq(supplierCatalogItems.supplierId, supplierId));
    await db
      .delete(supplierDocuments)
      .where(eq(supplierDocuments.supplierId, supplierId));
    await db.delete(preOrders).where(eq(preOrders.supplierId, supplierId));
    await db
      .update(products)
      .set({
        supplierId: null,
        supplierCatalogItemId: null,
      })
      .where(eq(products.supplierId, supplierId));
    await db.delete(suppliers).where(eq(suppliers.id, supplierId));
  } else {
    await db
      .update(products)
      .set({
        supplierId: null,
        supplierCatalogItemId: null,
      })
      .where(eq(products.supplierId, supplierId));
    const [existing] = await db
      .select({ notes: suppliers.notes })
      .from(suppliers)
      .where(eq(suppliers.id, supplierId))
      .limit(1);
    await db
      .update(suppliers)
      .set({
        notes: existing?.notes
          ? `${existing.notes} · Disconnected`
          : "Disconnected — no longer active",
      })
      .where(eq(suppliers.id, supplierId));
  }

  revalidatePath("/suppliers");
  revalidatePath("/products");
  revalidatePath("/preorders");
}

export async function deleteSupplierCatalogItem(formData: FormData) {
  await requireAuth();

  const id = Number.parseInt(String(formData.get("id") ?? ""), 10);
  if (!Number.isFinite(id) || id <= 0) throw new Error("Invalid item.");

  await db.delete(supplierCatalogItems).where(eq(supplierCatalogItems.id, id));
  revalidatePath("/suppliers");
}

function parseMoneyToCents(value: FormDataEntryValue | null) {
  const str = typeof value === "string" ? value.trim() : "";
  if (!str) return 0;
  const n = Number(str);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export async function updateSupplier(formData: FormData) {
  await requireAuth();

  const supplierId = Number.parseInt(String(formData.get("supplierId") ?? ""), 10);
  if (!Number.isFinite(supplierId) || supplierId <= 0) {
    throw new Error("Invalid supplier.");
  }

  const name = String(formData.get("name") ?? "").trim();
  const contactRaw = String(formData.get("contact") ?? "").trim();
  const locationRaw = String(formData.get("location") ?? "").trim();
  const notesRaw = String(formData.get("notes") ?? "").trim();

  if (!name) throw new Error("Supplier name is required.");

  const [existing] = await db
    .select({ id: suppliers.id })
    .from(suppliers)
    .where(eq(suppliers.id, supplierId))
    .limit(1);

  if (!existing) throw new Error("Supplier not found.");

  await db
    .update(suppliers)
    .set({
      name,
      contact: contactRaw.length ? contactRaw : null,
      location: locationRaw.length ? locationRaw : null,
      notes: notesRaw.length ? notesRaw : null,
    })
    .where(eq(suppliers.id, supplierId));

  revalidatePath("/suppliers");
  revalidatePath("/products");
}

export async function createSupplierCatalogItem(formData: FormData) {
  await requireAuth();

  const supplierId = Number.parseInt(String(formData.get("supplierId") ?? ""), 10);
  if (!Number.isFinite(supplierId) || supplierId <= 0) {
    throw new Error("Select a supplier.");
  }

  const [supplier] = await db
    .select({ id: suppliers.id })
    .from(suppliers)
    .where(eq(suppliers.id, supplierId))
    .limit(1);

  if (!supplier) throw new Error("Supplier not found.");

  const itemName = String(formData.get("itemName") ?? "").trim();
  const brandRaw = String(formData.get("brand") ?? "").trim();
  const variantRaw = String(formData.get("variant") ?? "").trim();
  const itemTypeRaw = String(formData.get("itemType") ?? "").trim();
  const packSizeRaw = String(formData.get("packSize") ?? "").trim();
  const packUnitRaw = String(formData.get("packUnit") ?? "").trim();
  const notesRaw = String(formData.get("notes") ?? "").trim();

  if (!itemName) throw new Error("Item name is required.");

  const unitCost = parseMoneyToCents(formData.get("unitCost"));
  const retailPrice = parseMoneyToCents(formData.get("retailPrice"));
  const perKiloPrice = parseMoneyToCents(formData.get("perKiloPrice"));
  const priceUnitRaw = String(formData.get("priceUnit") ?? "Sack");
  const priceUnit =
    priceUnitRaw === "Piece" || priceUnitRaw === "Case" ? priceUnitRaw : "Sack";
  const unitsPerCase = Number.parseInt(String(formData.get("unitsPerCase") ?? "24"), 10);

  const brand = brandRaw.length ? brandRaw : null;
  const variant = variantRaw.length ? variantRaw : null;
  const itemType = normalizeCatalogItemType(itemTypeRaw);
  const packSize = packSizeRaw.length ? packSizeRaw : null;
  const packUnit = packUnitRaw.length ? packUnitRaw : null;
  const notes = notesRaw.length ? notesRaw : null;
  const safeUnitsPerCase =
    Number.isFinite(unitsPerCase) && unitsPerCase > 0 ? unitsPerCase : 24;

  const targetKey = catalogItemKey({ brand, variant, itemName });
  const supplierItems = await db
    .select({
      id: supplierCatalogItems.id,
      itemName: supplierCatalogItems.itemName,
      brand: supplierCatalogItems.brand,
      variant: supplierCatalogItems.variant,
    })
    .from(supplierCatalogItems)
    .where(eq(supplierCatalogItems.supplierId, supplierId));

  const existingItem = supplierItems.find(
    (row) =>
      catalogItemKey({
        brand: row.brand,
        variant: row.variant,
        itemName: row.itemName,
      }) === targetKey,
  );

  if (existingItem) {
    await db
      .update(supplierCatalogItems)
      .set({
        itemName,
        brand,
        variant,
        itemType,
        unitCost: unitCost || null,
        retailPrice: retailPrice || null,
        perKiloPrice: perKiloPrice || null,
        packSize,
        packUnit,
        notes,
        priceUnit,
        unitsPerCase: safeUnitsPerCase,
      })
      .where(eq(supplierCatalogItems.id, existingItem.id));
  } else {
    await db.insert(supplierCatalogItems).values({
    supplierId,
    itemName,
    brand,
    variant,
    itemType,
    unitCost: unitCost || null,
    retailPrice: retailPrice || null,
    perKiloPrice: perKiloPrice || null,
    packSize,
    packUnit,
    notes,
    documentId: null,
    priceUnit,
    unitsPerCase: safeUnitsPerCase,
    });
  }

  revalidatePath("/suppliers");
  revalidatePath("/products");
}

export async function updateSupplierCatalogItem(formData: FormData) {
  await requireAuth();

  const id = Number.parseInt(String(formData.get("id") ?? ""), 10);
  if (!Number.isFinite(id) || id <= 0) throw new Error("Invalid catalog item.");

  const itemName = String(formData.get("itemName") ?? "").trim();
  const brandRaw = String(formData.get("brand") ?? "").trim();
  const variantRaw = String(formData.get("variant") ?? "").trim();
  const itemTypeRaw = String(formData.get("itemType") ?? "").trim();
  const packSizeRaw = String(formData.get("packSize") ?? "").trim();
  const packUnitRaw = String(formData.get("packUnit") ?? "").trim();
  const notesRaw = String(formData.get("notes") ?? "").trim();

  if (!itemName) throw new Error("Item name is required.");

  const unitCost = parseMoneyToCents(formData.get("unitCost"));
  const retailPrice = parseMoneyToCents(formData.get("retailPrice"));
  const perKiloPrice = parseMoneyToCents(formData.get("perKiloPrice"));
  const priceUnitRaw = String(formData.get("priceUnit") ?? "Sack");
  const priceUnit =
    priceUnitRaw === "Piece" || priceUnitRaw === "Case" ? priceUnitRaw : "Sack";
  const unitsPerCase = Number.parseInt(String(formData.get("unitsPerCase") ?? "24"), 10);

  const [existing] = await db
    .select({ id: supplierCatalogItems.id })
    .from(supplierCatalogItems)
    .where(eq(supplierCatalogItems.id, id))
    .limit(1);

  if (!existing) throw new Error("Catalog item not found.");

  await db
    .update(supplierCatalogItems)
    .set({
      itemName,
      brand: brandRaw.length ? brandRaw : null,
      variant: variantRaw.length ? variantRaw : null,
      itemType: normalizeCatalogItemType(itemTypeRaw),
      unitCost: unitCost || null,
      retailPrice: retailPrice || null,
      perKiloPrice: perKiloPrice || null,
      packSize: packSizeRaw.length ? packSizeRaw : null,
      packUnit: packUnitRaw.length ? packUnitRaw : null,
      notes: notesRaw.length ? notesRaw : null,
      priceUnit,
      unitsPerCase: Number.isFinite(unitsPerCase) && unitsPerCase > 0 ? unitsPerCase : 24,
    })
    .where(eq(supplierCatalogItems.id, id));

  revalidatePath("/suppliers");
  revalidatePath("/products");
}
