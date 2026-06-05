import { db } from "@/db";
import { supplierCatalogItems, supplierDocuments, suppliers } from "@/db/schema";
import { asc, desc, sql } from "drizzle-orm";

export async function getSupplierCatalogRows() {
  const [supplierRows, catalogRows, docs, countRows] = await Promise.all([
    db
      .select({ id: suppliers.id, name: suppliers.name })
      .from(suppliers)
      .orderBy(suppliers.name),
    db
      .select({
        id: supplierCatalogItems.id,
        supplierId: supplierCatalogItems.supplierId,
        itemName: supplierCatalogItems.itemName,
        brand: supplierCatalogItems.brand,
        productName: supplierCatalogItems.productName,
        variant: supplierCatalogItems.variant,
        itemType: supplierCatalogItems.itemType,
        sku: supplierCatalogItems.sku,
        unitCost: supplierCatalogItems.unitCost,
        packSize: supplierCatalogItems.packSize,
        packUnit: supplierCatalogItems.packUnit,
        perKiloPrice: supplierCatalogItems.perKiloPrice,
        retailPrice: supplierCatalogItems.retailPrice,
        priceUnit: supplierCatalogItems.priceUnit,
        unitsPerCase: supplierCatalogItems.unitsPerCase,
        notes: supplierCatalogItems.notes,
        documentId: supplierCatalogItems.documentId,
      })
      .from(supplierCatalogItems)
      .orderBy(
        asc(supplierCatalogItems.supplierId),
        asc(supplierCatalogItems.itemName),
      ),
    db
      .select({
        id: supplierDocuments.id,
        fileName: supplierDocuments.fileName,
        supplierId: supplierDocuments.supplierId,
        uploadedAt: supplierDocuments.uploadedAt,
      })
      .from(supplierDocuments)
      .orderBy(desc(supplierDocuments.uploadedAt)),
    db
      .select({
        supplierId: supplierCatalogItems.supplierId,
        count: sql<number>`count(*)`,
      })
      .from(supplierCatalogItems)
      .groupBy(supplierCatalogItems.supplierId),
  ]);

  const supplierById = new Map(supplierRows.map((s) => [s.id, s.name]));
  const docById = new Map(docs.map((d) => [d.id, d.fileName]));

  const countBySupplier = new Map(
    countRows.map((r) => [r.supplierId, Number(r.count)]),
  );

  const suppliersWithCounts = supplierRows.map((s) => ({
    id: s.id,
    name: s.name,
    itemCount: countBySupplier.get(s.id) ?? 0,
  }));

  const searchRows = catalogRows.map((r) => ({
    id: r.id,
    supplierId: r.supplierId,
    supplierName: supplierById.get(r.supplierId) ?? "Unknown",
    itemName: r.itemName,
    brand: r.brand,
    productName: r.productName,
    variant: r.variant,
    itemType: r.itemType,
    sku: r.sku,
    unitCost: r.unitCost,
    packSize: r.packSize,
    packUnit: r.packUnit,
    perKiloPrice: r.perKiloPrice,
    retailPrice: r.retailPrice,
    priceUnit: r.priceUnit,
    unitsPerCase: r.unitsPerCase,
    notes: r.notes,
    fileName: r.documentId ? (docById.get(r.documentId) ?? null) : null,
  }));

  return { suppliersWithCounts, searchRows, docs, supplierById };
}

export async function getCatalogPickOptions() {
  return db
    .select({
      id: supplierCatalogItems.id,
      supplierId: supplierCatalogItems.supplierId,
      itemName: supplierCatalogItems.itemName,
      brand: supplierCatalogItems.brand,
      variant: supplierCatalogItems.variant,
      unitCost: supplierCatalogItems.unitCost,
      retailPrice: supplierCatalogItems.retailPrice,
    })
    .from(supplierCatalogItems)
    .orderBy(
      asc(supplierCatalogItems.supplierId),
      asc(supplierCatalogItems.itemName),
    );
}
