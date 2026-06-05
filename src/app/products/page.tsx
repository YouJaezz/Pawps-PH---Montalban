import Link from "next/link";

import { ProductAddButton } from "@/app/products/ProductAddButton";
import { ProductEditButton } from "@/app/products/ProductEditButton";
import { deleteProduct } from "@/app/products/delete-actions";
import { restockProduct } from "@/app/products/actions";
import { AppShell } from "@/components/AppShell";
import { ScrollableTable } from "@/components/ScrollableTable";
import { db } from "@/db";
import { getSupplierCatalogRows } from "@/db/queries/suppliers";
import { products, suppliers } from "@/db/schema";
import {
  displayCatalogFlavor,
  displayCatalogItem,
} from "@/lib/catalog-item-display";
import { formatPhpFromCents } from "@/lib/money";
import { computeInventoryValuation } from "@/lib/inventory-valuation";
import { formatDualStock } from "@/lib/product-stock";
import { displayCatalogItemType } from "@/lib/catalog-item-types";
import { formatSupplierPrice } from "@/lib/price-units";
import type { StockUnit } from "@/db/schema";
import { eq } from "drizzle-orm";

export default async function ProductsPage() {
  const [supplierRows, catalogData, rows] = await Promise.all([
    db
      .select({ id: suppliers.id, name: suppliers.name })
      .from(suppliers)
      .orderBy(suppliers.name),
    getSupplierCatalogRows(),
    db
      .select({
        id: products.id,
        name: products.name,
        brand: products.brand,
        variant: products.variant,
        itemType: products.itemType,
        packSize: products.packSize,
        stockUnit: products.stockUnit,
        kgPerSack: products.kgPerSack,
        unitsPerCase: products.unitsPerCase,
        costPrice: products.costPrice,
        retailPrice: products.retailPrice,
        bulkPrice: products.bulkPrice,
        stockQuantity: products.stockQuantity,
        purchaseTier: products.purchaseTier,
        supplierId: products.supplierId,
        supplierCatalogItemId: products.supplierCatalogItemId,
      })
      .from(products)
      .where(eq(products.archived, false))
      .orderBy(products.name),
  ]);

  const { suppliersWithCounts, searchRows: catalogItems } = catalogData;

  const catalogById = new Map(catalogItems.map((c) => [c.id, c]));

  const catalogPickItems = catalogItems.map((c) => ({
    id: c.id,
    supplierId: c.supplierId,
    itemName: c.itemName,
    brand: c.brand,
    variant: c.variant,
    unitCost: c.unitCost,
    retailPrice: c.retailPrice,
    perKiloPrice: c.perKiloPrice,
    packSize: c.packSize,
    packUnit: c.packUnit,
    priceUnit: c.priceUnit,
    unitsPerCase: c.unitsPerCase,
    itemType: c.itemType,
  }));

  const suppliersForForm = supplierRows.map((s) => ({
    id: s.id,
    name: s.name,
    itemCount: suppliersWithCounts.find((c) => c.id === s.id)?.itemCount ?? 0,
  }));

  const supplierById = new Map(supplierRows.map((s) => [s.id, s.name]));

  const valuation = computeInventoryValuation(
    rows.map((p) => ({
      costPrice: p.costPrice,
      retailPrice: p.retailPrice,
      stockQuantity: p.stockQuantity,
      stockUnit: p.stockUnit as StockUnit,
    })),
  );

  return (
    <AppShell>
      <div className="w-full px-0 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm text-zinc-400">Inventory</div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Stock &amp; pricing
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ProductAddButton
              suppliers={suppliersForForm}
              catalogItems={catalogPickItems}
            />
            <Link
              href="/suppliers"
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-200 hover:bg-white/5"
            >
              Suppliers
            </Link>
            <a
              href="/api/export/stock-levels.csv"
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-200 hover:bg-white/5"
            >
              Export
            </a>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center sm:max-w-2xl">
          <div className="rounded-lg border border-white/10 bg-white/5 px-2 py-2">
            <div className="text-[10px] text-zinc-500">Stock value</div>
            <div className="text-sm font-semibold">
              {formatPhpFromCents(valuation.stockValueCents)}
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-2 py-2">
            <div className="text-[10px] text-zinc-500">Potential income</div>
            <div className="text-sm font-semibold">
              {formatPhpFromCents(valuation.potentialIncomeCents)}
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-2 py-2">
            <div className="text-[10px] text-zinc-500">Profit potential</div>
            <div className="text-sm font-semibold text-emerald-300">
              {formatPhpFromCents(valuation.profitPotentialCents)}
            </div>
          </div>
        </div>

        <div className="mt-5">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="mb-3 text-sm font-medium text-zinc-100">
              Inventory ({rows.length})
            </div>

            <ScrollableTable maxHeight="max-h-[min(75vh,800px)]">
              <table className="w-full table-auto text-xs">
                <thead className="bg-white/5 text-left text-[10px] text-zinc-500">
                  <tr>
                    <th className="px-2 py-2">Item</th>
                    <th className="hidden px-2 py-2 sm:table-cell">Brand</th>
                      <th className="px-2 py-2">Flavor</th>
                      <th className="hidden px-2 py-2 md:table-cell">Type</th>
                      <th className="hidden px-2 py-2 md:table-cell">Supplier</th>
                    <th className="hidden px-2 py-2 lg:table-cell">Sup. retail</th>
                    <th className="hidden px-2 py-2 lg:table-cell">Sup. WS</th>
                    <th className="hidden px-2 py-2 md:table-cell">Bought as</th>
                    <th className="hidden px-2 py-2 sm:table-cell">Our retail</th>
                    <th className="hidden px-2 py-2 sm:table-cell">Our WS</th>
                    <th className="px-2 py-2">Stock</th>
                    <th className="hidden px-2 py-2 xl:table-cell">Profit</th>
                    <th className="w-20 px-2 py-2">Edit</th>
                    <th className="w-24 px-2 py-2">Restock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {rows.length === 0 ? (
                    <tr>
                      <td className="px-3 py-5 text-zinc-400" colSpan={14}>
                        No inventory — pick a supplier catalog item to add.
                      </td>
                    </tr>
                  ) : (
                    rows.map((p) => {
                      const item = displayCatalogItem(null, p.name);
                      const brand = p.brand
                        ? displayCatalogItem(null, p.brand)
                        : "—";
                      const flavor =
                        p.variant?.trim()
                          ? displayCatalogFlavor(p.variant, p.name)
                          : "—";
                      const catalog = p.supplierCatalogItemId
                        ? catalogById.get(p.supplierCatalogItemId)
                        : undefined;
                      const itemType =
                        p.itemType ?? catalog?.itemType ?? null;
                      const priceUnit = catalog?.priceUnit ?? "Sack";
                      const stock = formatDualStock(
                        p.stockUnit as StockUnit,
                        p.stockQuantity,
                        {
                          kgPerSack: p.kgPerSack,
                          unitsPerCase: p.unitsPerCase,
                        },
                      );
                      const retailProfit = Math.max(0, p.retailPrice - p.costPrice);
                      const bulkProfit =
                        p.bulkPrice > 0
                          ? Math.max(0, p.bulkPrice - p.costPrice)
                          : null;
                      const isWeight =
                        p.stockUnit === "Kilogram" || p.kgPerSack != null;
                      const unitSuffix = isWeight ? "/kg" : "/pc";

                      return (
                        <tr key={p.id} className="hover:bg-white/5">
                          <td className="px-2 py-2 font-medium text-zinc-50">
                            {item}
                          </td>
                          <td className="hidden px-2 py-2 text-zinc-300 sm:table-cell">
                            {brand}
                          </td>
                            <td className="px-2 py-2 text-zinc-300">{flavor}</td>
                            <td className="hidden px-2 py-2 text-zinc-400 md:table-cell">
                              {displayCatalogItemType(itemType)}
                            </td>
                            <td className="hidden px-2 py-2 text-zinc-400 md:table-cell">
                            {p.supplierId
                              ? (supplierById.get(p.supplierId) ?? "—")
                              : "—"}
                          </td>
                          <td className="hidden px-2 py-2 text-zinc-400 lg:table-cell">
                            {formatSupplierPrice(catalog?.retailPrice, priceUnit)}
                          </td>
                          <td className="hidden px-2 py-2 text-zinc-400 lg:table-cell">
                            {formatSupplierPrice(catalog?.unitCost, priceUnit)}
                          </td>
                          <td className="hidden px-2 py-2 text-zinc-400 md:table-cell">
                            {p.purchaseTier}
                          </td>
                          <td className="hidden px-2 py-2 text-zinc-200 sm:table-cell">
                            {formatPhpFromCents(p.retailPrice)}
                            <span className="text-[9px] text-zinc-600">
                              {unitSuffix}
                            </span>
                          </td>
                          <td className="hidden px-2 py-2 text-zinc-200 sm:table-cell">
                            {p.bulkPrice > 0 ? (
                              <>
                                {formatPhpFromCents(p.bulkPrice)}
                                <span className="text-[9px] text-zinc-600">
                                  {unitSuffix}
                                </span>
                              </>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-2 py-2 font-medium">
                            <div>{stock.primary}</div>
                            {stock.secondary !== "—" ? (
                              <div className="text-[9px] font-normal text-zinc-500">
                                {stock.secondary}
                              </div>
                            ) : null}
                          </td>
                          <td className="hidden px-2 py-2 text-emerald-400/90 xl:table-cell">
                            <div>
                              R: +{formatPhpFromCents(retailProfit)}
                              {unitSuffix}
                            </div>
                            {bulkProfit != null ? (
                              <div className="text-[10px] text-emerald-500/80">
                                W: +{formatPhpFromCents(bulkProfit)}
                                {unitSuffix}
                              </div>
                            ) : null}
                          </td>
                          <td className="px-2 py-2 align-top">
                            <ProductEditButton
                              product={{
                                id: p.id,
                                name: p.name,
                                brand: p.brand,
                                variant: p.variant,
                                itemType: p.itemType,
                                packSize: p.packSize,
                                stockUnit: p.stockUnit as StockUnit,
                                stockQuantity: p.stockQuantity,
                                kgPerSack: p.kgPerSack,
                                unitsPerCase: p.unitsPerCase,
                                retailPrice: p.retailPrice,
                                bulkPrice: p.bulkPrice,
                              }}
                            />
                          </td>
                          <td className="px-2 py-2">
                            <div className="flex flex-col gap-1">
                              <form action={restockProduct} className="flex gap-1">
                                <input type="hidden" name="productId" value={p.id} />
                                <input
                                  name="quantity"
                                  type="number"
                                  min={1}
                                  placeholder="+"
                                  className="w-10 rounded border border-white/10 bg-black/30 px-1 py-0.5 text-center text-xs outline-none"
                                />
                                <button
                                  type="submit"
                                  className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-200"
                                >
                                  Add
                                </button>
                              </form>
                              <form action={deleteProduct}>
                                <input type="hidden" name="productId" value={p.id} />
                                <button
                                  type="submit"
                                  className="text-[10px] text-red-400/80 hover:text-red-300"
                                >
                                  Remove
                                </button>
                              </form>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </ScrollableTable>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
