import type { StockUnit } from "@/db/schema";
import { displayStockQuantity } from "@/lib/product-stock";

export type StockAlertLevel = "empty" | "low" | "ok";

/** Low-stock threshold in raw storage units (pcs or kg tenths). */
const LOW_STOCK_RAW = 50;

export function stockAlertLevel(
  stockUnit: StockUnit,
  stockQuantity: number,
): StockAlertLevel {
  if (stockQuantity <= 0) return "empty";
  if (stockQuantity <= LOW_STOCK_RAW) return "low";
  return "ok";
}

export function stockAlertLabel(level: StockAlertLevel) {
  if (level === "empty") return "Out of stock";
  if (level === "low") return "Low stock";
  return "In stock";
}

export type StockAlertRow = {
  id: number;
  name: string;
  brand: string;
  variant: string | null;
  itemType: string | null;
  stockUnit: StockUnit;
  stockQuantity: number;
  kgPerSack: number | null;
  unitsPerCase: number | null;
  level: StockAlertLevel;
  displayQty: string;
};

export function toStockAlertRow(p: {
  id: number;
  name: string;
  brand: string;
  variant: string | null;
  itemType: string | null;
  stockUnit: StockUnit;
  stockQuantity: number;
  kgPerSack: number | null;
  unitsPerCase: number | null;
}): StockAlertRow {
  const level = stockAlertLevel(p.stockUnit, p.stockQuantity);
  const displayQty = displayStockQuantity(
    p.stockUnit === "Sack" ? "Kilogram" : p.stockUnit,
    p.stockQuantity,
  );
  return {
    ...p,
    level,
    displayQty: String(displayQty),
  };
}
