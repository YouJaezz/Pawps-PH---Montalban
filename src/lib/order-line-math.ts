import { isCatLitterItemType } from "@/lib/catalog-item-types";

export const SALE_UNITS = ["Piece", "Kilogram", "Pack", "Sack", "Case"] as const;
export type SaleUnit = (typeof SALE_UNITS)[number];

export function isSaleUnit(value: string): value is SaleUnit {
  return (SALE_UNITS as readonly string[]).includes(value);
}

export function parseKgPerSackInput(raw: string) {
  const n = Number(raw.trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.max(1, Math.round(n * 10));
}

export function displayKgPerSack(tenths: number | null | undefined) {
  if (tenths == null || tenths <= 0) return null;
  return tenths / 10;
}

export function parseQuantityInput(value: string, saleUnit: SaleUnit) {
  const n = Number(value.trim());
  if (!Number.isFinite(n) || n <= 0) return null;

  if (saleUnit === "Kilogram") {
    const rounded = Math.round(n * 100) / 100;
    const quantityTenths = Math.round(rounded * 100);
    if (quantityTenths <= 0) return null;
    return {
      quantity: Math.max(1, Math.ceil(rounded)),
      quantityTenths,
    };
  }

  const quantity = Math.round(n);
  if (quantity <= 0) return null;
  return { quantity, quantityTenths: null as number | null };
}

/** Snap manual kg entry to common retail fractions (¼, ½, ¾, etc.). */
export function normalizeKgInput(value: string) {
  const n = Number(value.trim());
  if (!Number.isFinite(n) || n <= 0) return value;
  const snapped = Math.round(n * 4) / 4;
  if (snapped <= 0) return value;
  return snapped % 1 === 0 ? String(snapped) : snapped.toFixed(2).replace(/0$/, "");
}

export function effectiveQuantity(
  quantity: number,
  saleUnit: SaleUnit,
  quantityTenths: number | null | undefined,
) {
  if (saleUnit === "Kilogram" && quantityTenths != null) {
    return quantityTenths / 100;
  }
  return quantity;
}

export function lineTotalCents(
  unitPrice: number,
  saleUnit: SaleUnit,
  quantity: number,
  quantityTenths: number | null | undefined,
) {
  const qty = effectiveQuantity(quantity, saleUnit, quantityTenths);
  return Math.round(unitPrice * qty);
}

export function stockDeductQuantity(
  saleUnit: SaleUnit,
  quantity: number,
  quantityTenths: number | null | undefined,
  kgPerSack: number | null | undefined,
  unitsPerCase?: number | null | undefined,
) {
  if (saleUnit === "Kilogram" && quantityTenths != null) {
    return Math.max(0, Math.round(quantityTenths / 10));
  }
  if (saleUnit === "Sack" && kgPerSack != null && kgPerSack > 0) {
    return quantity * kgPerSack;
  }
  if (saleUnit === "Case" && unitsPerCase != null && unitsPerCase > 0) {
    return quantity * unitsPerCase;
  }
  return quantity;
}

export function stockRestockQuantity(
  saleUnit: SaleUnit,
  quantity: number,
  quantityTenths: number | null | undefined,
  kgPerSack: number | null | undefined,
  unitsPerCase?: number | null | undefined,
) {
  return stockDeductQuantity(
    saleUnit,
    quantity,
    quantityTenths,
    kgPerSack,
    unitsPerCase,
  );
}

export function formatQuantityLabel(
  saleUnit: SaleUnit,
  quantity: number,
  quantityTenths: number | null | undefined,
) {
  if (saleUnit === "Kilogram" && quantityTenths != null) {
    const kg = quantityTenths / 100;
    if (kg < 1) {
      const text = kg.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
      return `${text} kg`;
    }
    return `${kg % 1 === 0 ? kg.toFixed(0) : kg.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")} kg`;
  }
  if (saleUnit === "Sack") {
    return `${quantity} sack${quantity === 1 ? "" : "s"}`;
  }
  if (saleUnit === "Case") {
    return `${quantity} case${quantity === 1 ? "" : "s"}`;
  }
  if (saleUnit === "Pack") return `${quantity} pack${quantity === 1 ? "" : "s"}`;
  return `${quantity} pc${quantity === 1 ? "" : "s"}`;
}

export function unitPriceForSale(
  saleUnit: SaleUnit,
  priceTier: "Retail" | "Bulk",
  retailCents: number,
  bulkCents: number,
  kgPerSack: number | null | undefined,
  unitsPerCase?: number | null | undefined,
) {
  const perUnit = priceTier === "Bulk" ? bulkCents : retailCents;
  if (saleUnit === "Sack" && kgPerSack != null && kgPerSack > 0) {
    return Math.round(perUnit * (kgPerSack / 10));
  }
  if (saleUnit === "Case" && unitsPerCase != null && unitsPerCase > 0) {
    return Math.round(perUnit * unitsPerCase);
  }
  return perUnit;
}

export function saleUnitsForProduct(opts: {
  stockUnit: string;
  kgPerSack: number | null | undefined;
  unitsPerCase?: number | null | undefined;
  itemType?: string | null;
}) {
  const units: SaleUnit[] = [];

  if (isCatLitterItemType(opts.itemType)) {
    return ["Piece"] as SaleUnit[];
  }

  if (opts.stockUnit === "Kilogram" || opts.kgPerSack != null) {
    units.push("Kilogram");
    if (opts.kgPerSack != null && opts.kgPerSack > 0) {
      units.push("Sack");
    }
  } else {
    units.push("Piece");
    const caseSize = opts.unitsPerCase ?? 24;
    if (caseSize > 1) {
      units.push("Case");
    }
  }

  if (opts.stockUnit === "Pack") {
    units.push("Pack");
  }

  return [...new Set(units)];
}
