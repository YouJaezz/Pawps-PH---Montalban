import { and, asc, eq, isNotNull, lte } from "drizzle-orm";

import { db } from "@/db";
import { products } from "@/db/schema";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export async function getInventoryAtAGlance(opts?: { daysUntilExpiry?: number }) {
  const daysUntilExpiry = opts?.daysUntilExpiry ?? 30;
  const now = new Date();
  const cutoff = new Date(now.getTime() + daysUntilExpiry * MS_PER_DAY);

  // Note: costPrice is per-unit; multiply in JS to avoid cross-dialect issues.
  const allProducts = await db
    .select({
      id: products.id,
      name: products.name,
      brand: products.brand,
      variant: products.variant,
      costPrice: products.costPrice,
      stockQuantity: products.stockQuantity,
      expiryDate: products.expiryDate,
    })
    .from(products)
    .where(eq(products.archived, false));

  const totalStockValueCents = allProducts.reduce((acc, p) => {
    return acc + p.costPrice * p.stockQuantity;
  }, 0);

  const expiringSoon = await db
    .select({
      id: products.id,
      name: products.name,
      brand: products.brand,
      variant: products.variant,
      stockQuantity: products.stockQuantity,
      expiryDate: products.expiryDate,
    })
    .from(products)
    .where(
      and(
        eq(products.archived, false),
        isNotNull(products.expiryDate),
        lte(products.expiryDate, cutoff),
      ),
    )
    .orderBy(asc(products.expiryDate))
    .limit(8);

  return {
    totalStockValueCents,
    expiringSoon,
    expiringSoonCount: expiringSoon.length,
    cutoff,
  };
}

