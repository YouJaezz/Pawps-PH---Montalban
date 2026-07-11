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

export function parseStockEntryMode(
  raw: FormDataEntryValue | null | undefined,
): "sacks" | "kg" | "cases" | "pcs" {
  const v = String(raw ?? "").trim();
  if (v === "sacks" || v === "cases" || v === "pcs") return v;
  return "kg";
}

/** Pull the first number from inputs like "5", "5 kg", or "1.5 sacks". */
export function extractLeadingNumber(raw: string): number | null {
  const match = raw.trim().replace(/,/g, "").match(/^(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function detectQuantityEntryMode(
  raw: string,
  fallback: "sacks" | "kg" | "cases" | "pcs",
): "sacks" | "kg" | "cases" | "pcs" {
  const lower = raw.trim().toLowerCase();
  if (/\bkg\b|kilogram/.test(lower)) return "kg";
  if (/\bsack/.test(lower)) return "sacks";
  if (/\bcase/.test(lower)) return "cases";
  if (/\bpc|piece|pack/.test(lower)) return "pcs";
  return fallback;
}

/** Parse transfer/adjust qty — understands suffixes like "5 kg" or "2 sacks". */
export function parseTransferQuantityInput(
  raw: string,
  stockUnit: StockUnit,
  opts?: {
    stockEntryMode?: "sacks" | "kg" | "cases" | "pcs";
    kgPerSack?: number | null;
    unitsPerCase?: number | null;
    itemType?: string | null;
  },
): number | null {
  const n = extractLeadingNumber(raw);
  if (n == null || n <= 0) return null;

  const entryMode = detectQuantityEntryMode(
    raw,
    opts?.stockEntryMode ?? "pcs",
  );

  if (isCatLitterItemType(opts?.itemType)) {
    return Math.max(0, Math.round(n));
  }

  if (stockUnit === "Kilogram" || stockUnit === "Sack") {
    if (entryMode === "sacks" && opts?.kgPerSack != null && opts.kgPerSack > 0) {
      return Math.max(0, Math.round(n * opts.kgPerSack));
    }
    return Math.max(0, Math.round(n * 10));
  }

  if (entryMode === "cases") {
    const caseSize = opts?.unitsPerCase ?? DEFAULT_UNITS_PER_CASE;
    return Math.max(0, Math.round(n * caseSize));
  }

  return Math.max(0, Math.round(n));
}

export function parseStockQuantityInput(
  raw: string,
  stockUnit: StockUnit,
  opts?: {
    stockEntryMode?: "sacks" | "kg" | "cases" | "pcs";
    kgPerSack?: number | null;
    unitsPerCase?: number | null;
    itemType?: string | null;
  },
) {
  const n = extractLeadingNumber(raw);
  // Allow 0 for branch stock edits / recounts (transfer parser rejects 0).
  if (n == null || n < 0) return null;
  if (n === 0) return 0;

  return parseTransferQuantityInput(raw, stockUnit, opts);
}

/** Format stored qty in the unit the user picked (kg, sacks, cases, or pcs). */
export function formatStockInEntryMode(
  storedQty: number,
  stockUnit: StockUnit,
  entryMode: "sacks" | "kg" | "cases" | "pcs",
  opts?: {
    kgPerSack?: number | null;
    unitsPerCase?: number | null;
    itemType?: string | null;
  },
): string {
  if (isCatLitterItemType(opts?.itemType)) {
    const n = Math.max(0, Math.round(storedQty));
    return `${n} ${n === 1 ? "sack" : "sacks"}`;
  }

  if (stockUnit === "Kilogram" || stockUnit === "Sack") {
    if (
      entryMode === "sacks" &&
      opts?.kgPerSack != null &&
      opts.kgPerSack > 0
    ) {
      const sacks = storedQty / opts.kgPerSack;
      const label = sacks % 1 === 0 ? sacks.toFixed(0) : sacks.toFixed(1);
      return `${label} ${sacks === 1 ? "sack" : "sacks"}`;
    }
    const kg = displayStockQuantity("Kilogram", storedQty);
    const label = kg % 1 === 0 ? kg.toFixed(0) : kg.toFixed(1);
    return `${label} kg`;
  }

  if (
    entryMode === "cases" &&
    opts?.unitsPerCase != null &&
    opts.unitsPerCase > 1
  ) {
    const cases = storedQty / opts.unitsPerCase;
    const label = cases % 1 === 0 ? cases.toFixed(0) : cases.toFixed(1);
    return `${label} ${cases === 1 ? "case" : "cases"}`;
  }

  const pcs = Math.max(0, Math.round(storedQty));
  return `${pcs} ${pcs === 1 ? "pc" : "pcs"}`;
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

export function isWeightStockUnit(stockUnit: StockUnit) {
  return stockUnit === "Kilogram" || stockUnit === "Sack";
}

export function defaultRestockEntryMode(
  stockUnit: StockUnit,
  opts?: { unitsPerCase?: number | null; itemType?: string | null },
): "sacks" | "kg" | "cases" | "pcs" {
  if (isWeightStockUnit(stockUnit)) return "kg";
  if (
    stockUnit === "Piece" &&
    opts?.unitsPerCase != null &&
    opts.unitsPerCase > 1 &&
    !isCatLitterItemType(opts.itemType)
  ) {
    return "pcs";
  }
  return "pcs";
}

/** Convert restock form input to stored branch-stock units + divisor for unit-cost math. */
export function parseRestockStockInput(
  raw: string,
  stockUnit: StockUnit,
  opts: {
    stockEntryMode: "sacks" | "kg" | "cases" | "pcs";
    kgPerSack?: number | null;
    unitsPerCase?: number | null;
  },
): { rawDelta: number; costDivisor: number } | null {
  const unitForParse = isWeightStockUnit(stockUnit) ? "Kilogram" : stockUnit;
  const rawDelta = parseStockQuantityInput(raw, unitForParse, opts);
  if (rawDelta == null || rawDelta <= 0) return null;

  const costDivisor = isWeightStockUnit(stockUnit)
    ? displayStockQuantity("Kilogram", rawDelta)
    : rawDelta;

  return { rawDelta, costDivisor };
}

export function restockQtyFieldLabel(
  stockUnit: StockUnit,
  stockEntryMode: "sacks" | "kg" | "cases" | "pcs",
  itemType?: string | null,
) {
  if (isWeightStockUnit(stockUnit)) {
    return stockEntryMode === "sacks" ? "Quantity (sacks)" : "Quantity (kg)";
  }
  if (stockEntryMode === "cases") return "Quantity (cases)";
  if (stockUnit === "Pack") return "Quantity (packs)";
  if (isCatLitterItemType(itemType)) return "Quantity (sacks)";
  return "Quantity (pcs)";
}

export function formatRestockQtyDelta(
  stockUnit: StockUnit,
  rawDelta: number,
  opts?: {
    kgPerSack?: number | null;
    unitsPerCase?: number | null;
    itemType?: string | null;
  },
): string {
  const dual = formatDualStock(stockUnit, rawDelta, opts);
  return dual.secondary !== "—" ? `${dual.primary} · ${dual.secondary}` : dual.primary;
}
