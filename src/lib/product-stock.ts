import type { StockUnit } from "@/db/schema";
import { displayKgPerSack } from "@/lib/order-line-math";

export function displayStockQuantity(stockUnit: StockUnit, stockQuantity: number) {
  if (stockUnit === "Kilogram" || stockUnit === "Sack") {
    return stockQuantity / 10;
  }
  return stockQuantity;
}

export function parseStockQuantityInput(
  raw: string,
  stockUnit: StockUnit,
  opts?: { stockEntryMode?: "sacks" | "kg"; kgPerSack?: number | null },
) {
  const n = Number(raw.trim());
  if (!Number.isFinite(n) || n < 0) return null;

  if (stockUnit === "Kilogram" || stockUnit === "Sack") {
    if (opts?.stockEntryMode === "sacks" && opts.kgPerSack != null && opts.kgPerSack > 0) {
      return Math.max(0, Math.round(n * opts.kgPerSack));
    }
    return Math.max(0, Math.round(n * 10));
  }
  return Math.max(0, Math.round(n));
}

export function parseKgPerSackFromInput(raw: string) {
  const n = Number(raw.trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.max(1, Math.round(n * 10));
}

export function formatStockLabel(
  stockUnit: StockUnit,
  stockQuantity: number,
  kgPerSack?: number | null,
) {
  const n = displayStockQuantity(
    stockUnit === "Sack" ? "Kilogram" : stockUnit,
    stockQuantity,
  );
  if (stockUnit === "Kilogram" || stockUnit === "Sack") {
    const kgLabel = `${n % 1 === 0 ? n.toFixed(0) : n.toFixed(1)} kg`;
    const sackKg = displayKgPerSack(kgPerSack);
    if (sackKg != null && sackKg > 0) {
      const sacks = n / sackKg;
      const sackPart =
        sacks % 1 === 0
          ? `${sacks.toFixed(0)} sack${sacks === 1 ? "" : "s"}`
          : `~${sacks.toFixed(1)} sacks`;
      return `${kgLabel} (${sackPart})`;
    }
    return kgLabel;
  }
  if (stockUnit === "Pack") return `${n} pack${n === 1 ? "" : "s"}`;
  return String(n);
}

export function stockQtyLabel(
  stockUnit: StockUnit,
  stockEntryMode?: "sacks" | "kg",
) {
  if (stockUnit === "Kilogram" || stockUnit === "Sack") {
    return stockEntryMode === "sacks" ? "Stock (sacks)" : "Stock (kg)";
  }
  if (stockUnit === "Pack") return "Stock (packs)";
  return "Stock (pcs)";
}
