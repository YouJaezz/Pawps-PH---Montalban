import type { StockUnit } from "@/db/schema";
import { displayStockQuantity } from "@/lib/product-stock";

export type ProductValuationRow = {
  costPrice: number;
  retailPrice: number;
  stockQuantity: number;
  stockUnit: StockUnit;
};

export function effectiveStockQty(row: ProductValuationRow) {
  const unit = row.stockUnit === "Sack" ? "Kilogram" : row.stockUnit;
  return displayStockQuantity(unit, row.stockQuantity);
}

export function computeInventoryValuation(rows: ProductValuationRow[]) {
  let stockValueCents = 0;
  let potentialIncomeCents = 0;
  let profitPotentialCents = 0;

  for (const p of rows) {
    const qty = effectiveStockQty(p);
    stockValueCents += p.costPrice * qty;
    potentialIncomeCents += p.retailPrice * qty;
    profitPotentialCents += Math.max(0, p.retailPrice - p.costPrice) * qty;
  }

  return {
    stockValueCents,
    potentialIncomeCents,
    profitPotentialCents,
  };
}
