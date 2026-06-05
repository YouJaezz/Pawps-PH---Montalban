import type { StockUnit } from "@/db/schema";
import {
  parseQuantityInput,
  type SaleUnit,
} from "@/lib/order-line-math";

export const EXCESS_QTY_PRESETS = [
  "¼ sack surplus",
  "½ sack surplus",
  "¼ kg surplus",
  "½ kg surplus",
  "Custom",
] as const;

export type ExcessQtyPreset = (typeof EXCESS_QTY_PRESETS)[number];

export function isSurplusExcessPreset(preset: string) {
  return (
    preset !== "Custom" &&
    (EXCESS_QTY_PRESETS as readonly string[]).includes(preset)
  );
}

function normalizeFractionText(raw: string) {
  return raw
    .trim()
    .replace(/¼/g, "0.25")
    .replace(/½/g, "0.5")
    .replace(/¾/g, "0.75");
}

export type ParsedCustomSale = {
  saleUnit: SaleUnit;
  quantity: number;
  quantityTenths: number | null;
  displayLabel: string;
};

export function parseCustomSaleLabel(
  label: string,
  product: {
    stockUnit: StockUnit;
    kgPerSack: number | null;
    unitsPerCase: number | null;
  },
): ParsedCustomSale | null {
  const raw = label.trim();
  if (!raw) return null;

  const normalized = normalizeFractionText(raw);

  const kgMatch = normalized.match(/^(\d+(?:\.\d+)?)\s*(?:kg|kilo?s?|kilograms?)$/i);
  if (kgMatch) {
    const n = Number(kgMatch[1]);
    const parsed = parseQuantityInput(String(n), "Kilogram");
    if (!parsed) return null;
    return {
      saleUnit: "Kilogram",
      quantity: parsed.quantity,
      quantityTenths: parsed.quantityTenths,
      displayLabel: `${n % 1 === 0 ? n.toFixed(0) : n} kg`,
    };
  }

  const sackMatch = normalized.match(/^(\d+(?:\.\d+)?)\s*(?:sack|sacks|bag|bags)$/i);
  if (sackMatch) {
    const n = Number(sackMatch[1]);
    if (n > 0 && n < 1 && product.kgPerSack != null && product.kgPerSack > 0) {
      const kg = (product.kgPerSack / 10) * n;
      const parsed = parseQuantityInput(String(kg), "Kilogram");
      if (!parsed) return null;
      return {
        saleUnit: "Kilogram",
        quantity: parsed.quantity,
        quantityTenths: parsed.quantityTenths,
        displayLabel: raw,
      };
    }
    const parsed = parseQuantityInput(String(n), "Sack");
    if (!parsed) return null;
    return {
      saleUnit: "Sack",
      quantity: parsed.quantity,
      quantityTenths: parsed.quantityTenths,
      displayLabel: `${n % 1 === 0 ? n.toFixed(0) : n} sack${n === 1 ? "" : "s"}`,
    };
  }

  const caseMatch = normalized.match(/^(\d+(?:\.\d+)?)\s*(?:case|cases|cs)$/i);
  if (caseMatch) {
    const n = Number(caseMatch[1]);
    const parsed = parseQuantityInput(String(n), "Case");
    if (!parsed) return null;
    return {
      saleUnit: "Case",
      quantity: parsed.quantity,
      quantityTenths: parsed.quantityTenths,
      displayLabel: `${n % 1 === 0 ? n.toFixed(0) : n} case${n === 1 ? "" : "s"}`,
    };
  }

  const packMatch = normalized.match(/^(\d+(?:\.\d+)?)\s*(?:pack|packs)$/i);
  if (packMatch) {
    const n = Number(packMatch[1]);
    const parsed = parseQuantityInput(String(n), "Pack");
    if (!parsed) return null;
    return {
      saleUnit: "Pack",
      quantity: parsed.quantity,
      quantityTenths: parsed.quantityTenths,
      displayLabel: `${n % 1 === 0 ? n.toFixed(0) : n} pack${n === 1 ? "" : "s"}`,
    };
  }

  const pieceMatch = normalized.match(
    /^(\d+(?:\.\d+)?)\s*(?:pc|pcs|piece|pieces|unit|units)?$/i,
  );
  if (pieceMatch) {
    const n = Number(pieceMatch[1]);
    const parsed = parseQuantityInput(String(n), "Piece");
    if (!parsed) return null;
    return {
      saleUnit: "Piece",
      quantity: parsed.quantity,
      quantityTenths: parsed.quantityTenths,
      displayLabel: `${n % 1 === 0 ? n.toFixed(0) : n} pc${n === 1 ? "" : "s"}`,
    };
  }

  const plain = Number(normalized);
  if (Number.isFinite(plain) && plain > 0) {
    if (
      product.stockUnit === "Kilogram" ||
      product.stockUnit === "Sack" ||
      product.kgPerSack != null
    ) {
      const parsed = parseQuantityInput(String(plain), "Kilogram");
      if (!parsed) return null;
      return {
        saleUnit: "Kilogram",
        quantity: parsed.quantity,
        quantityTenths: parsed.quantityTenths,
        displayLabel: `${plain % 1 === 0 ? plain.toFixed(0) : plain} kg`,
      };
    }

    const parsed = parseQuantityInput(String(plain), "Piece");
    if (!parsed) return null;
    return {
      saleUnit: "Piece",
      quantity: parsed.quantity,
      quantityTenths: parsed.quantityTenths,
      displayLabel: `${plain % 1 === 0 ? plain.toFixed(0) : plain} pc${plain === 1 ? "" : "s"}`,
    };
  }

  return null;
}

export function buildCustomSaleLineNote(
  displayLabel: string,
  extraNote?: string | null,
) {
  const base = `Custom sale — ${displayLabel}`;
  const extra = extraNote?.trim();
  return extra ? `${base} · ${extra}` : base;
}

export function buildExcessLineNote(qtyLabel: string, extraNote?: string | null) {
  const base = `Excess/bonus stock — ${qtyLabel} — no inventory deduction · 100% profit`;
  const extra = extraNote?.trim();
  return extra ? `${base} · ${extra}` : base;
}

export function excessLineLabel(productName: string, qtyLabel: string) {
  return `${productName} (${qtyLabel})`;
}
