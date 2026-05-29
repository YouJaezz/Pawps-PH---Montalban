"use server";

import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import {
  supplierCatalogItems,
  supplierDocuments,
  supplierPriceChanges,
  supplierPriceHistory,
  suppliers,
} from "@/db/schema";
import { parseSupplierFile } from "@/lib/supplier-parse";
import { requireAuth } from "@/lib/auth-guard";
import { catalogItemKey, percentChange } from "@/lib/supplier-item-key";
import { eq } from "drizzle-orm";

const UPLOAD_DIR = path.join(process.cwd(), "storage", "supplier-uploads");

async function ensureUploadDir() {
  await mkdir(UPLOAD_DIR, { recursive: true });
}

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

export async function uploadSupplierCatalog(formData: FormData) {
  await requireAuth();

  const supplierId = Number.parseInt(String(formData.get("supplierId") ?? ""), 10);
  const file = formData.get("file");

  if (!Number.isFinite(supplierId) || supplierId <= 0) {
    throw new Error("Select a supplier.");
  }

  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Choose a file to upload.");
  }

  const [supplier] = await db
    .select({ id: suppliers.id })
    .from(suppliers)
    .where(eq(suppliers.id, supplierId))
    .limit(1);

  if (!supplier) throw new Error("Supplier not found.");

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

  await ensureUploadDir();

  const safeName = file.name.replace(/[^\w.\-() ]+/g, "_");
  const storedName = `${Date.now()}-${safeName}`;
  const storedPath = path.join(UPLOAD_DIR, storedName);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(storedPath, buffer);

  const insertedDoc = await db
    .insert(supplierDocuments)
    .values({
      supplierId,
      fileName: file.name,
      filePath: storedPath,
      mimeType: file.type || null,
    })
    .returning({ id: supplierDocuments.id });

  const documentId = insertedDoc[0]?.id;
  if (!documentId) throw new Error("Failed to save document record.");

  const parsed = await parseSupplierFile(buffer, file.name);
  const now = new Date();

  const oldByKey = new Map(
    existingCatalog.map((row) => [
      catalogItemKey(row),
      row,
    ]),
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

  if (priceChangeRows.length) {
    await db.insert(supplierPriceChanges).values(priceChangeRows);
  }

  await db
    .delete(supplierCatalogItems)
    .where(eq(supplierCatalogItems.supplierId, supplierId));

  if (parsed.length) {
    await db.insert(supplierCatalogItems).values(
      parsed.map((row) => ({
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
        itemType: row.itemType ?? null,
        productName: row.productName ?? null,
        notes: row.notes ?? null,
      })),
    );

    await db.insert(supplierPriceHistory).values(
      parsed.map((row) => ({
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
      })),
    );
  }

  revalidatePath("/suppliers");
}

export async function deleteSupplierCatalogItem(formData: FormData) {
  await requireAuth();

  const id = Number.parseInt(String(formData.get("id") ?? ""), 10);
  if (!Number.isFinite(id) || id <= 0) throw new Error("Invalid item.");

  await db.delete(supplierCatalogItems).where(eq(supplierCatalogItems.id, id));
  revalidatePath("/suppliers");
}
