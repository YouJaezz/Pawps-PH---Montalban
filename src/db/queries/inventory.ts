import { cache } from "react";

import { getActiveInventoryProducts, inventoryValuationFromRows } from "@/db/queries/inventory-products";
import { toStockAlertRow, type StockAlertRow } from "@/lib/stock-alerts";

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

export const getStockAlerts = cache(async () => {
  const allProducts = await getActiveInventoryProducts();
  const alerts = allProducts
    .map((p) =>
      toStockAlertRow({
        id: p.id,
        name: p.name,
        brand: p.brand,
        variant: p.variant,
        itemType: p.itemType,
        stockUnit: p.stockUnit,
        stockQuantity: p.stockQuantity,
        kgPerSack: p.kgPerSack,
        unitsPerCase: p.unitsPerCase,
      }),
    )
    .filter((p) => p.level !== "ok")
    .sort((a, b) => {
      if (a.level !== b.level) return a.level === "empty" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  return {
    empty: alerts.filter((a) => a.level === "empty"),
    low: alerts.filter((a) => a.level === "low"),
    all: alerts,
  };
});

export type { StockAlertRow };
