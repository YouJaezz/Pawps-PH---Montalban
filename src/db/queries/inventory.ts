import { cache } from "react";

import { getActiveInventoryProducts, inventoryValuationFromRows } from "@/db/queries/inventory-products";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const getInventoryAtAGlance = cache(async (opts?: { daysUntilExpiry?: number }) => {
  const daysUntilExpiry = opts?.daysUntilExpiry ?? 30;
  const cutoff = new Date(Date.now() + daysUntilExpiry * MS_PER_DAY);

  const allProducts = await getActiveInventoryProducts();
  const { stockValueCents } = inventoryValuationFromRows(allProducts);

  const expiringSoon = allProducts
    .filter((p) => p.expiryDate && p.expiryDate <= cutoff)
    .sort((a, b) => a.expiryDate!.getTime() - b.expiryDate!.getTime())
    .slice(0, 8);

  return {
    totalStockValueCents: stockValueCents,
    expiringSoon,
    expiringSoonCount: expiringSoon.length,
    cutoff,
  };
});
