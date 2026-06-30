import { cache } from "react";
import { desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  priceHistory,
  products,
  supplierPriceChanges,
  suppliers,
} from "@/db/schema";

export type CostChangeAlert = {
  id: string;
  source: "inventory" | "supplier_catalog" | "restock";
  productLabel: string | null;
  supplierName: string | null;
  previousCents: number | null;
  newCents: number | null;
  changePercent: number | null;
  recordedAt: Date;
  detail: string | null;
};

export const getRecentCostChangeAlerts = cache(async (limit = 12) => {
  const [inventoryChanges, supplierChanges] = await Promise.all([
    db
      .select({
        id: priceHistory.id,
        productId: priceHistory.productId,
        oldPrice: priceHistory.oldPrice,
        newPrice: priceHistory.newPrice,
        changedAt: priceHistory.changedAt,
        reason: priceHistory.reason,
        productName: products.name,
        productVariant: products.variant,
        productBrand: products.brand,
      })
      .from(priceHistory)
      .innerJoin(products, eq(priceHistory.productId, products.id))
      .where(eq(priceHistory.priceKind, "cost"))
      .orderBy(desc(priceHistory.changedAt))
      .limit(limit),
    db
      .select({
        id: supplierPriceChanges.id,
        supplierId: supplierPriceChanges.supplierId,
        itemName: supplierPriceChanges.itemName,
        brand: supplierPriceChanges.brand,
        variant: supplierPriceChanges.variant,
        previousUnitCost: supplierPriceChanges.previousUnitCost,
        newUnitCost: supplierPriceChanges.newUnitCost,
        changePercent: supplierPriceChanges.changePercent,
        changeSource: supplierPriceChanges.changeSource,
        recordedAt: supplierPriceChanges.recordedAt,
        supplierName: suppliers.name,
      })
      .from(supplierPriceChanges)
      .innerJoin(suppliers, eq(supplierPriceChanges.supplierId, suppliers.id))
      .where(eq(supplierPriceChanges.changeSource, "catalog_upload"))
      .orderBy(desc(supplierPriceChanges.recordedAt))
      .limit(limit),
  ]);

  const inventoryAlerts: CostChangeAlert[] = inventoryChanges.map((row) => ({
    id: `ph-${row.id}`,
    source: row.reason?.includes("Restock payment") ? "restock" : "inventory",
    productLabel: `${row.productName}${row.productVariant ? ` (${row.productVariant})` : ""}`,
    supplierName: null,
    previousCents: row.oldPrice,
    newCents: row.newPrice,
    changePercent:
      row.oldPrice > 0
        ? Math.round(((row.newPrice - row.oldPrice) / row.oldPrice) * 1000) / 10
        : null,
    recordedAt: row.changedAt,
    detail: row.reason,
  }));

  const supplierAlerts: CostChangeAlert[] = supplierChanges.map((row) => ({
    id: `spc-${row.id}`,
    source: row.changeSource === "restock" ? "restock" : "supplier_catalog",
    productLabel: row.itemName,
    supplierName: row.supplierName,
    previousCents: row.previousUnitCost,
    newCents: row.newUnitCost,
    changePercent: row.changePercent,
    recordedAt: row.recordedAt,
    detail:
      row.changeSource === "restock"
        ? "Detected from restock payment"
        : "Supplier pricelist upload",
  }));

  const merged = [...inventoryAlerts, ...supplierAlerts]
    .sort((a, b) => b.recordedAt.getTime() - a.recordedAt.getTime())
    .slice(0, limit);

  const restockCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(supplierPriceChanges)
    .where(eq(supplierPriceChanges.changeSource, "restock"))
    .then((rows) => Number(rows[0]?.count ?? 0));

  return { alerts: merged, restockChangeCount: restockCount };
});
