import type { StockUnit } from "@/db/schema";

export function displayStockQuantity(stockUnit: StockUnit, stockQuantity: number) {
  if (stockUnit === "Kilogram") {
    return stockQuantity / 10;
  }
  return stockQuantity;
}

export function parseStockQuantityInput(raw: string, stockUnit: StockUnit) {
  const n = Number(raw.trim());
  if (!Number.isFinite(n) || n < 0) return null;
  if (stockUnit === "Kilogram") {
    return Math.max(0, Math.round(n * 10));
  }
  return Math.max(0, Math.round(n));
}

export function formatStockLabel(stockUnit: StockUnit, stockQuantity: number) {
  const n = displayStockQuantity(stockUnit, stockQuantity);
  if (stockUnit === "Kilogram") {
    return `${n % 1 === 0 ? n.toFixed(0) : n.toFixed(1)} kg`;
  }
  if (stockUnit === "Pack") return `${n} pack${n === 1 ? "" : "s"}`;
  return String(n);
}
