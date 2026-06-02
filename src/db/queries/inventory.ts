import { eq } from "drizzle-orm";

import { db } from "@/db";
import { products } from "@/db/schema";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export async function getInventoryAtAGlance(opts?: { daysUntilExpiry?: number }) {
  const daysUntilExpiry = opts?.daysUntilExpiry ?? 30;
  const cutoff = new Date(Date.now() + daysUntilExpiry * MS_PER_DAY);

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

  const totalStockValueCents = allProducts.reduce(
    (acc, p) => acc + p.costPrice * p.stockQuantity,
    0,
  );

  const expiringSoon = allProducts
    .filter((p) => p.expiryDate && p.expiryDate <= cutoff)
    .sort((a, b) => a.expiryDate!.getTime() - b.expiryDate!.getTime())
    .slice(0, 8);

  return {
    totalStockValueCents,
    expiringSoon,
    expiringSoonCount: expiringSoon.length,
    cutoff,
  };
}
