import type { StockUnit } from "@/db/schema";
import { catalogItemKey } from "@/lib/supplier-item-key";

export type CatalogProductFields = {
  id: number;
  name: string;
  brand: string;
  variant: string | null;
};

/** Stable identity for the same sellable item across supplier-linked inventory rows. */
export function productCatalogKey(p: {
  brand: string;
  variant?: string | null;
  name: string;
}) {
  return catalogItemKey({
    brand: p.brand,
    variant: p.variant,
    itemName: p.name,
  });
}

export function buildCatalogSiblingMap(
  products: CatalogProductFields[],
): Map<number, number[]> {
  const byKey = new Map<string, number[]>();
  for (const p of products) {
    const key = productCatalogKey(p);
    const list = byKey.get(key) ?? [];
    list.push(p.id);
    byKey.set(key, list);
  }

  const result = new Map<number, number[]>();
  for (const ids of byKey.values()) {
    const sorted = [...ids].sort((a, b) => a - b);
    for (const id of sorted) {
      result.set(id, sorted);
    }
  }
  return result;
}

export type MergeableSaleProduct = {
  id: number;
  name: string;
  brand: string;
  variant: string | null;
  itemType: string | null;
  retailPrice: number;
  bulkPrice: number;
  stockQuantity: number;
  stockUnit: StockUnit;
  kgPerSack: number | null;
  unitsPerCase: number | null;
  stockByBranch?: Record<number, number>;
};

export type MergedSaleProduct = MergeableSaleProduct & {
  /** All inventory product ids merged into this row (for stock allocation). */
  sourceProductIds: number[];
};

function pickPrimaryByStock<T extends { id: number; stockQuantity: number }>(
  group: T[],
): T {
  return [...group].sort((a, b) => {
    if (b.stockQuantity !== a.stockQuantity) {
      return b.stockQuantity - a.stockQuantity;
    }
    return a.id - b.id;
  })[0]!;
}

function mergeStockByBranch(group: MergeableSaleProduct[]) {
  const stockByBranch: Record<number, number> = {};
  for (const p of group) {
    if (!p.stockByBranch) continue;
    for (const [branchIdStr, qty] of Object.entries(p.stockByBranch)) {
      const branchId = Number(branchIdStr);
      if (!Number.isFinite(branchId)) continue;
      stockByBranch[branchId] = (stockByBranch[branchId] ?? 0) + qty;
    }
  }
  return stockByBranch;
}

/** One sellable row per catalog item — stock totals combine all supplier inventory rows. */
export function mergeProductsForSales<T extends MergeableSaleProduct>(
  products: T[],
): (T & { sourceProductIds: number[] })[] {
  const groups = new Map<string, T[]>();
  for (const p of products) {
    const key = productCatalogKey(p);
    const list = groups.get(key) ?? [];
    list.push(p);
    groups.set(key, list);
  }

  const merged: (T & { sourceProductIds: number[] })[] = [];

  for (const group of groups.values()) {
    if (group.length === 1) {
      merged.push({ ...group[0]!, sourceProductIds: [group[0]!.id] });
      continue;
    }

    const primary = pickPrimaryByStock(group);
    const stockByBranch = mergeStockByBranch(group);
    const totalStock = group.reduce((sum, p) => sum + p.stockQuantity, 0);

    merged.push({
      ...primary,
      stockQuantity: totalStock,
      stockByBranch:
        Object.keys(stockByBranch).length > 0
          ? stockByBranch
          : primary.stockByBranch,
      sourceProductIds: group.map((p) => p.id).sort((a, b) => a - b),
    });
  }

  return merged.sort((a, b) => a.name.localeCompare(b.name));
}

export type MergeableInventoryRow = CatalogProductFields & {
  itemType: string | null;
  stockUnit: StockUnit;
  stockQuantity: number;
  kgPerSack: number | null;
  unitsPerCase: number | null;
  expiryDate?: Date | null;
  costPrice?: number;
  retailPrice?: number;
};

/** Merge inventory rows for dashboard alerts / expiry — sums stock, keeps earliest expiry. */
export function mergeInventoryRowsByCatalog<T extends MergeableInventoryRow>(
  products: T[],
): T[] {
  const groups = new Map<string, T[]>();
  for (const p of products) {
    const key = productCatalogKey(p);
    const list = groups.get(key) ?? [];
    list.push(p);
    groups.set(key, list);
  }

  const merged: T[] = [];
  for (const group of groups.values()) {
    if (group.length === 1) {
      merged.push(group[0]!);
      continue;
    }

    const primary = pickPrimaryByStock(group);
    const totalStock = group.reduce((sum, p) => sum + p.stockQuantity, 0);
    const earliestExpiry = group
      .map((p) => p.expiryDate)
      .filter((d): d is Date => d != null)
      .sort((a, b) => a.getTime() - b.getTime())[0];

    merged.push({
      ...primary,
      stockQuantity: totalStock,
      expiryDate: earliestExpiry ?? primary.expiryDate ?? null,
    });
  }

  return merged;
}
