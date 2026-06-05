import { db } from "@/db";
import {
  supplierDocuments,
  supplierPriceChanges,
  supplierPriceHistory,
  suppliers,
} from "@/db/schema";
import { desc, sql } from "drizzle-orm";

export type SupplierUploadSummary = {
  documentId: number;
  supplierId: number;
  supplierName: string;
  fileName: string;
  uploadedAt: Date;
  avgChangePercent: number | null;
  itemsIncreased: number;
  itemsDecreased: number;
  itemsUnchanged: number;
  itemsNew: number;
  itemsRemoved: number;
};

export type PriceChangeRow = {
  id: number;
  supplierName: string;
  itemName: string;
  brand: string | null;
  variant: string | null;
  previousUnitCost: number | null;
  newUnitCost: number | null;
  changePercent: number | null;
  recordedAt: Date;
  fileName: string | null;
};

function roundPercent(value: number | null) {
  if (value == null) return null;
  return Math.round(value * 10) / 10;
}

export async function getSupplierInflationInsights() {
  const supplierRows = await db
    .select({ id: suppliers.id, name: suppliers.name })
    .from(suppliers);

  const supplierById = new Map(supplierRows.map((s) => [s.id, s.name]));

  const docs = await db
    .select({
      id: supplierDocuments.id,
      supplierId: supplierDocuments.supplierId,
      fileName: supplierDocuments.fileName,
      uploadedAt: supplierDocuments.uploadedAt,
    })
    .from(supplierDocuments)
    .orderBy(desc(supplierDocuments.uploadedAt));

  const changes = await db
    .select({
      id: supplierPriceChanges.id,
      supplierId: supplierPriceChanges.supplierId,
      itemName: supplierPriceChanges.itemName,
      brand: supplierPriceChanges.brand,
      variant: supplierPriceChanges.variant,
      previousUnitCost: supplierPriceChanges.previousUnitCost,
      newUnitCost: supplierPriceChanges.newUnitCost,
      changePercent: supplierPriceChanges.changePercent,
      newDocumentId: supplierPriceChanges.newDocumentId,
      recordedAt: supplierPriceChanges.recordedAt,
    })
    .from(supplierPriceChanges)
    .orderBy(desc(supplierPriceChanges.recordedAt))
    .limit(200);

  const docById = new Map(docs.map((d) => [d.id, d.fileName]));

  const uploadSummaries: SupplierUploadSummary[] = [];

  for (const doc of docs) {
    const docChanges = changes.filter((c) => c.newDocumentId === doc.id);
    if (docChanges.length === 0) continue;

    const withPercent = docChanges.filter((c) => c.changePercent != null);
    const avgChangePercent =
      withPercent.length > 0
        ? roundPercent(
            withPercent.reduce((sum, c) => sum + (c.changePercent ?? 0), 0) /
              withPercent.length,
          )
        : null;

    uploadSummaries.push({
      documentId: doc.id,
      supplierId: doc.supplierId,
      supplierName: supplierById.get(doc.supplierId) ?? "Unknown",
      fileName: doc.fileName,
      uploadedAt: doc.uploadedAt,
      avgChangePercent,
      itemsIncreased: docChanges.filter(
        (c) => c.changePercent != null && c.changePercent > 0,
      ).length,
      itemsDecreased: docChanges.filter(
        (c) => c.changePercent != null && c.changePercent < 0,
      ).length,
      itemsUnchanged: docChanges.filter((c) => c.changePercent === 0).length,
      itemsNew: docChanges.filter((c) => c.previousUnitCost == null && c.newUnitCost != null).length,
      itemsRemoved: docChanges.filter((c) => c.newUnitCost == null).length,
    });
  }

  const latestChanges: PriceChangeRow[] = changes.slice(0, 50).map((c) => ({
    id: c.id,
    supplierName: supplierById.get(c.supplierId) ?? "Unknown",
    itemName: c.itemName,
    brand: c.brand,
    variant: c.variant,
    previousUnitCost: c.previousUnitCost,
    newUnitCost: c.newUnitCost,
    changePercent: c.changePercent,
    recordedAt: c.recordedAt,
    fileName: docById.get(c.newDocumentId) ?? null,
  }));

  const topIncreases = [...latestChanges]
    .filter((c) => c.changePercent != null && c.changePercent > 0)
    .sort((a, b) => (b.changePercent ?? 0) - (a.changePercent ?? 0))
    .slice(0, 10);

  const overallAvg = await db
    .select({
      avg: sql<number>`avg(${supplierPriceChanges.changePercent})`,
    })
    .from(supplierPriceChanges)
    .where(sql`${supplierPriceChanges.changePercent} is not null`);

  const uploadCount = docs.length;
  const changeEventCount = changes.length;

  return {
    uploadCount,
    changeEventCount,
    overallAvgInflationPercent: roundPercent(
      overallAvg[0]?.avg != null ? Number(overallAvg[0].avg) : null,
    ),
    uploadSummaries: uploadSummaries.slice(0, 20),
    topIncreases,
    latestChanges: latestChanges.slice(0, 25),
  };
}

/** Backfill history for catalogs uploaded before price tracking existed. */
export async function backfillSupplierPriceHistoryIfEmpty() {
  const existing = await db
    .select({ count: sql<number>`count(*)` })
    .from(supplierPriceHistory)
    .limit(1);

  if (Number(existing[0]?.count ?? 0) > 0) return;

  const { supplierCatalogItems } = await import("@/db/schema");

  const catalog = await db
    .select({
      supplierId: supplierCatalogItems.supplierId,
      documentId: supplierCatalogItems.documentId,
      itemName: supplierCatalogItems.itemName,
      brand: supplierCatalogItems.brand,
      variant: supplierCatalogItems.variant,
      unitCost: supplierCatalogItems.unitCost,
      retailPrice: supplierCatalogItems.retailPrice,
      perKiloPrice: supplierCatalogItems.perKiloPrice,
      createdAt: supplierCatalogItems.createdAt,
    })
    .from(supplierCatalogItems);

  if (catalog.length === 0) return;

  const { catalogItemKey } = await import("@/lib/supplier-item-key");

  const historyRows = catalog
    .filter((row) => row.documentId != null)
    .map((row) => ({
      supplierId: row.supplierId,
      documentId: row.documentId!,
      itemKey: catalogItemKey(row),
      itemName: row.itemName,
      brand: row.brand,
      variant: row.variant,
      unitCost: row.unitCost,
      retailPrice: row.retailPrice,
      perKiloPrice: row.perKiloPrice,
      recordedAt: row.createdAt,
    }));

  if (historyRows.length === 0) return;

  await db.insert(supplierPriceHistory).values(historyRows);
}
