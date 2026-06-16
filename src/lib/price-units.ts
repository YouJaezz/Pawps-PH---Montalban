import type { PriceUnit, StockUnit } from "@/db/schema";
import { normalizeCatalogItemType, isCatLitterItemType } from "@/lib/catalog-item-types";
import { DEFAULT_UNITS_PER_CASE } from "@/db/schema";
import { formatPhpFromCents } from "@/lib/money";

export function inferPriceUnit(opts: {
  itemType?: string | null;
  packUnit?: string | null;
  packSize?: string | null;
  itemName?: string | null;
}): PriceUnit {
  const normalized = normalizeCatalogItemType(opts.itemType);
  if (normalized.includes("Dry Food") || normalized === "Cat Litter") {
    return "Sack";
  }
  if (
    normalized.includes("Can") ||
    normalized.includes("Pouch") ||
    normalized.includes("Treats") ||
    normalized === "Toys"
  ) {
    return "Piece";
  }

  const type = (opts.itemType ?? "").toLowerCase();
  const unit = (opts.packUnit ?? "").toLowerCase();
  const name = (opts.itemName ?? "").toLowerCase();

  if (
    type.includes("can") ||
    type.includes("pouch") ||
    type.includes("canned") ||
    name.includes("pouch") ||
    name.includes(" can") ||
    unit === "g" ||
    unit === "ml" ||
    unit === "pc" ||
    unit === "pcs"
  ) {
    return "Piece";
  }

  if (
    unit === "kg" ||
    type.includes("dog food") ||
    type.includes("cat food") ||
    type.includes("dry")
  ) {
    return "Sack";
  }

  return "Sack";
}

export function priceUnitShort(unit: PriceUnit | string | null | undefined) {
  switch (unit) {
    case "Piece":
      return "pc";
    case "Case":
      return "case";
    case "Sack":
    default:
      return "sack";
  }
}

export function priceUnitLabel(unit: PriceUnit | string | null | undefined) {
  switch (unit) {
    case "Piece":
      return "per pc";
    case "Case":
      return "per case";
    case "Sack":
    default:
      return "per sack";
  }
}

export function formatSupplierPrice(
  cents: number | null | undefined,
  priceUnit: PriceUnit | string | null | undefined,
) {
  if (cents == null) return "—";
  const unit = priceUnitShort(priceUnit);
  return `${formatPhpFromCents(cents)}/${unit}`;
}

export function saleUnitLabel(unit: string) {
  switch (unit) {
    case "Kilogram":
      return "Per kilo (kg)";
    case "Sack":
      return "Per sack";
    case "Case":
      return "Per case";
    case "Pack":
      return "Per pack";
    case "Piece":
    default:
      return "Per piece (pc)";
  }
}

export function isWeightProduct(opts: {
  priceUnit?: string | null;
  packUnit?: string | null;
  kgPerSack?: number | null;
  itemType?: string | null;
}) {
  if (isCatLitterItemType(opts.itemType)) return false;
  const type = normalizeCatalogItemType(opts.itemType).toLowerCase();
  if (type.includes("dry food")) return true;
  if (opts.kgPerSack != null && opts.kgPerSack > 0) return true;
  const unit = (opts.packUnit ?? "").toLowerCase();
  return unit === "kg" || opts.priceUnit === "Sack";
}

export function isPieceProduct(opts: {
  priceUnit?: string | null;
  packUnit?: string | null;
  itemType?: string | null;
}) {
  if (isCatLitterItemType(opts.itemType)) return true;
  const type = normalizeCatalogItemType(opts.itemType).toLowerCase();
  if (
    type.includes("can") ||
    type.includes("pouch") ||
    type.includes("treat") ||
    type === "toys" ||
    type.includes("medicine")
  ) {
    return true;
  }
  const unit = (opts.packUnit ?? "").toLowerCase();
  return (
    opts.priceUnit === "Piece" ||
    unit === "g" ||
    unit === "ml" ||
    unit === "pc" ||
    unit === "pcs"
  );
}

export function retailUnitSuffix(itemType: string | null | undefined, stockUnit: StockUnit) {
  if (isCatLitterItemType(itemType)) return "/sack";
  if (stockUnit === "Kilogram" || stockUnit === "Sack") return "/kg";
  return "/pc";
}

export function stockPieceLabel(itemType: string | null | undefined) {
  return isCatLitterItemType(itemType) ? "sack" : "pc";
}

export function defaultUnitsPerCase(priceUnit: PriceUnit | string | null | undefined) {
  return priceUnit === "Case" ? DEFAULT_UNITS_PER_CASE : DEFAULT_UNITS_PER_CASE;
}
