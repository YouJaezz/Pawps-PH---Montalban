import { cache } from "react";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { products } from "@/db/schema";
import type { StockUnit } from "@/db/schema";
import { computeInventoryValuation } from "@/lib/inventory-valuation";

/** Shared product snapshot — deduped per request via React cache(). */
export const getActiveInventoryProducts = cache(async () => {
  return db
    .select({
      id: products.id,
      name: products.name,
      brand: products.brand,
      variant: products.variant,
      costPrice: products.costPrice,
      retailPrice: products.retailPrice,
      bulkPrice: products.bulkPrice,
      stockQuantity: products.stockQuantity,
      stockUnit: products.stockUnit,
      kgPerSack: products.kgPerSack,
      unitsPerCase: products.unitsPerCase,
      expiryDate: products.expiryDate,
    })
    .from(products)
    .where(eq(products.archived, false));
});

export type ActiveInventoryProduct = Awaited<
  ReturnType<typeof getActiveInventoryProducts>
>[number];

export function inventoryValuationFromRows(
  rows: Pick<
    ActiveInventoryProduct,
    "costPrice" | "retailPrice" | "stockQuantity" | "stockUnit"
  >[],
) {
  return computeInventoryValuation(
    rows.map((p) => ({
      costPrice: p.costPrice,
      retailPrice: p.retailPrice,
      stockQuantity: p.stockQuantity,
      stockUnit: p.stockUnit as StockUnit,
    })),
  );
}
