import type { StockUnit } from "@/db/schema";
import { DEFAULT_UNITS_PER_CASE } from "@/db/schema";
import { displayKgPerSack } from "@/lib/order-line-math";
import { isCatLitterItemType } from "@/lib/catalog-item-types";

export function displayStockQuantity(stockUnit: StockUnit, stockQuantity: number) {
  if (stockUnit === "Kilogram" || stockUnit === "Sack") {
    return stockQuantity / 10;
  }
  return stockQuantity;
}

export function parseStockQuantityInput(
  raw: string,
  stockUnit: StockUnit,
  opts?: {
    stockEntryMode?: "sacks" | "kg" | "cases" | "pcs";
    kgPerSack?: number | null;
    unitsPerCase?: number | null;
  },
) {
  const n = Number(raw.trim());
  if (!Number.isFinite(n) || n < 0) return null;

  if (stockUnit === "Kilogram" || stockUnit === "Sack") {
    if (opts?.stockEntryMode === "sacks" && opts.kgPerSack != null && opts.kgPerSack > 0) {
      return Math.max(0, Math.round(n * opts.kgPerSack));
    }
    return Math.max(0, Math.round(n * 10));
  }

  if (opts?.stockEntryMode === "cases") {
    const caseSize = opts.unitsPerCase ?? DEFAULT_UNITS_PER_CASE;
    return Math.max(0, Math.round(n * caseSize));
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
  unitsPerCase?: number | null,
) {
  const dual = formatDualStock(stockUnit, stockQuantity, {
    kgPerSack,
    unitsPerCase,
  });
  if (dual.secondary === "—") return dual.primary;
  return `${dual.primary} · ${dual.secondary}`;
}

export type DualStockDisplay = {
  primary: string;
  secondary: string;
};

/** Two-line stock: kg + sacks, or pcs + cases. */
export function formatDualStock(
  stockUnit: StockUnit,
  stockQuantity: number,
  opts?: {
    kgPerSack?: number | null;
    unitsPerCase?: number | null;
    itemType?: string | null;
  },
): DualStockDisplay {
  if (stockUnit === "Kilogram" || stockUnit === "Sack") {
    const kg = displayStockQuantity("Kilogram", stockQuantity);
    const sackKg = displayKgPerSack(opts?.kgPerSack);
    const kgLabel = `${kg % 1 === 0 ? kg.toFixed(0) : kg.toFixed(1)} kg`;

    if (sackKg != null && sackKg > 0) {
      const fullSacks = Math.floor(kg / sackKg + 1e-9);
      const looseKg = Math.round((kg - fullSacks * sackKg) * 10) / 10;
      const sackLabel =
        looseKg > 0
          ? `${fullSacks} sack${fullSacks === 1 ? "" : "s"} · ${looseKg} kg open`
          : `${fullSacks} sack${fullSacks === 1 ? "" : "s"}`;
      return { primary: kgLabel, secondary: sackLabel };
    }

    return { primary: kgLabel, secondary: "—" };
  }

  const pcs = stockQuantity;
  const caseSize = opts?.unitsPerCase ?? DEFAULT_UNITS_PER_CASE;
  const pieceWord = isCatLitterItemType(opts?.itemType) ? "sack" : "pc";
  const pieceWordPlural = isCatLitterItemType(opts?.itemType) ? "sacks" : "pcs";
  const fullCases = Math.floor(pcs / caseSize);
  const loosePcs = pcs % caseSize;

  if (caseSize > 1 && !isCatLitterItemType(opts?.itemType)) {
    const caseLabel =
      loosePcs > 0
        ? `${fullCases} case${fullCases === 1 ? "" : "s"} · ${loosePcs} pcs open`
        : `${fullCases} case${fullCases === 1 ? "" : "s"}`;
    return { primary: `${pcs} pcs`, secondary: caseLabel };
  }

  return {
    primary: `${pcs} ${pcs === 1 ? pieceWord : pieceWordPlural}`,
    secondary: "—",
  };
}

export function stockQtyLabel(
  stockUnit: StockUnit,
  stockEntryMode?: "sacks" | "kg" | "cases" | "pcs",
) {
  if (stockUnit === "Kilogram" || stockUnit === "Sack") {
    return stockEntryMode === "sacks" ? "Stock (sacks)" : "Stock (kg)";
  }
  if (stockEntryMode === "cases") return "Stock (cases)";
  if (stockUnit === "Pack") return "Stock (packs)";
  return "Stock (pcs)";
}
