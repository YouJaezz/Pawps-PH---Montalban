import { db } from "@/db";
import { supplierCatalogItems, suppliers } from "@/db/schema";
import {
  displayCatalogFlavor,
  displayCatalogItem,
} from "@/lib/catalog-item-display";
import { catalogItemKey } from "@/lib/supplier-item-key";

export type SupplierPriceOffer = {
  supplierId: number;
  supplierName: string;
  wholesaleCents: number | null;
  retailCents: number | null;
};

export type PriceComparisonRow = {
  itemKey: string;
  itemLabel: string;
  flavor: string;
  offers: SupplierPriceOffer[];
  bestWholesale: number | null;
  bestRetail: number | null;
  worstWholesale: number | null;
  sortPrice: number;
};

export async function getSupplierPriceComparison(): Promise<PriceComparisonRow[]> {
  const supplierRows = await db
    .select({ id: suppliers.id, name: suppliers.name })
    .from(suppliers);
  const supplierById = new Map(supplierRows.map((s) => [s.id, s.name]));

  const catalogRows = await db
    .select({
      supplierId: supplierCatalogItems.supplierId,
      itemName: supplierCatalogItems.itemName,
      brand: supplierCatalogItems.brand,
      variant: supplierCatalogItems.variant,
      unitCost: supplierCatalogItems.unitCost,
      retailPrice: supplierCatalogItems.retailPrice,
    })
    .from(supplierCatalogItems);

  const grouped = new Map<string, SupplierPriceOffer[]>();

  for (const row of catalogRows) {
    const key = catalogItemKey(row);
    const offers = grouped.get(key) ?? [];
    offers.push({
      supplierId: row.supplierId,
      supplierName: supplierById.get(row.supplierId) ?? "Unknown",
      wholesaleCents: row.unitCost,
      retailCents: row.retailPrice,
    });
    grouped.set(key, offers);
  }

  const rows: PriceComparisonRow[] = [];

  for (const [itemKey, offers] of grouped) {
    if (offers.length < 2) continue;

    const sample = catalogRows.find((r) => catalogItemKey(r) === itemKey);
    if (!sample) continue;

    const wholesalePrices = offers
      .map((o) => o.wholesaleCents)
      .filter((p): p is number => p != null && p > 0);
    const retailPrices = offers
      .map((o) => o.retailCents)
      .filter((p): p is number => p != null && p > 0);

    const bestWholesale =
      wholesalePrices.length > 0 ? Math.min(...wholesalePrices) : null;
    const worstWholesale =
      wholesalePrices.length > 0 ? Math.max(...wholesalePrices) : null;
    const bestRetail =
      retailPrices.length > 0 ? Math.min(...retailPrices) : null;

    const sortPrice = worstWholesale ?? bestRetail ?? 0;

    rows.push({
      itemKey,
      itemLabel: displayCatalogItem(sample.brand, sample.itemName),
      flavor: displayCatalogFlavor(sample.variant, sample.itemName),
      offers: offers.sort((a, b) => a.supplierName.localeCompare(b.supplierName)),
      bestWholesale,
      bestRetail,
      worstWholesale,
      sortPrice,
    });
  }

  return rows.sort((a, b) => b.sortPrice - a.sortPrice);
}
