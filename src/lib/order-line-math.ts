export const SALE_UNITS = ["Piece", "Kilogram", "Pack"] as const;
export type SaleUnit = (typeof SALE_UNITS)[number];

export function isSaleUnit(value: string): value is SaleUnit {
  return (SALE_UNITS as readonly string[]).includes(value);
}

export function parseQuantityInput(value: string, saleUnit: SaleUnit) {
  const n = Number(value.trim());
  if (!Number.isFinite(n) || n <= 0) return null;

  if (saleUnit === "Kilogram") {
    const quantityTenths = Math.round(n * 10);
    return {
      quantity: Math.max(1, Math.round(n)),
      quantityTenths,
    };
  }

  const quantity = Math.round(n);
  if (quantity <= 0) return null;
  return { quantity, quantityTenths: null as number | null };
}

export function effectiveQuantity(
  quantity: number,
  saleUnit: SaleUnit,
  quantityTenths: number | null | undefined,
) {
  if (saleUnit === "Kilogram" && quantityTenths != null) {
    return quantityTenths / 10;
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
) {
  if (saleUnit === "Kilogram" && quantityTenths != null) {
    return Math.max(1, Math.round(quantityTenths / 10));
  }
  return quantity;
}

export function formatQuantityLabel(
  saleUnit: SaleUnit,
  quantity: number,
  quantityTenths: number | null | undefined,
) {
  if (saleUnit === "Kilogram" && quantityTenths != null) {
    const kg = quantityTenths / 10;
    return `${kg % 1 === 0 ? kg.toFixed(0) : kg.toFixed(1)} kg`;
  }
  if (saleUnit === "Pack") return `${quantity} pack${quantity === 1 ? "" : "s"}`;
  return `${quantity} pc${quantity === 1 ? "" : "s"}`;
}
