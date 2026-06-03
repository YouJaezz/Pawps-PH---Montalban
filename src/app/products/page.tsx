import Link from "next/link";

import { ProductForm } from "@/app/products/ProductForm";
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
  formatMoneyOrDash,
} from "@/lib/catalog-item-display";
import { formatPhpFromCents } from "@/lib/money";
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
        costPrice: products.costPrice,
        retailPrice: products.retailPrice,
        bulkPrice: products.bulkPrice,
        stockQuantity: products.stockQuantity,
        purchaseTier: products.purchaseTier,
        supplierId: products.supplierId,
        supplierRetailPrice: products.supplierRetailPrice,
        supplierBulkPrice: products.supplierBulkPrice,
      })
      .from(products)
      .where(eq(products.archived, false))
      .orderBy(products.name),
  ]);

  const { suppliersWithCounts, searchRows: catalogItems } = catalogData;

  const catalogPickItems = catalogItems.map((c) => ({
    id: c.id,
    supplierId: c.supplierId,
    itemName: c.itemName,
    brand: c.brand,
    variant: c.variant,
    unitCost: c.unitCost,
    retailPrice: c.retailPrice,
  }));

  const suppliersForForm = supplierRows.map((s) => ({
    id: s.id,
    name: s.name,
    itemCount: suppliersWithCounts.find((c) => c.id === s.id)?.itemCount ?? 0,
  }));

  const supplierById = new Map(supplierRows.map((s) => [s.id, s.name]));

  const totalUnits = rows.reduce((acc, p) => acc + p.stockQuantity, 0);
  const totalCostValueCents = rows.reduce(
    (acc, p) => acc + p.costPrice * p.stockQuantity,
    0,
  );
  const totalPotentialProfitCents = rows.reduce(
    (acc, p) =>
      acc + Math.max(0, p.retailPrice - p.costPrice) * p.stockQuantity,
    0,
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
          <div className="flex gap-2">
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

        <div className="mt-4 grid grid-cols-3 gap-2 text-center sm:max-w-lg">
          <div className="rounded-lg border border-white/10 bg-white/5 px-2 py-2">
            <div className="text-[10px] text-zinc-500">Units</div>
            <div className="text-sm font-semibold">{totalUnits}</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-2 py-2">
            <div className="text-[10px] text-zinc-500">Stock value</div>
            <div className="text-sm font-semibold">
              {formatPhpFromCents(totalCostValueCents)}
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-2 py-2">
            <div className="text-[10px] text-zinc-500">Profit potential</div>
            <div className="text-sm font-semibold text-emerald-300">
              {formatPhpFromCents(totalPotentialProfitCents)}
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-5">
          <div className="xl:col-span-1 xl:max-w-[280px]">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm font-medium text-zinc-100">Add item</div>
              <div className="mt-3">
                <ProductForm
                  suppliers={suppliersForForm}
                  catalogItems={catalogPickItems}
                />
              </div>
            </div>
          </div>

          <div className="xl:col-span-4">
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
                      <th className="hidden px-2 py-2 md:table-cell">Supplier</th>
                      <th className="hidden px-2 py-2 lg:table-cell">Sup. retail</th>
                      <th className="hidden px-2 py-2 lg:table-cell">Sup. wholesale</th>
                      <th className="px-2 py-2">Total cost</th>
                      <th className="hidden px-2 py-2 sm:table-cell">Unit cost</th>
                      <th className="hidden px-2 py-2 md:table-cell">Bought as</th>
                      <th className="hidden px-2 py-2 sm:table-cell">Retail</th>
                      <th className="hidden px-2 py-2 sm:table-cell">Bulk</th>
                      <th className="px-2 py-2">Stock</th>
                      <th className="hidden px-2 py-2 xl:table-cell">Profit</th>
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
                        const profit =
                          Math.max(0, p.retailPrice - p.costPrice) *
                          p.stockQuantity;
                        const totalCost = p.costPrice * p.stockQuantity;

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
                              {p.supplierId
                                ? (supplierById.get(p.supplierId) ?? "—")
                                : "—"}
                            </td>
                            <td className="hidden px-2 py-2 text-zinc-400 lg:table-cell">
                              {formatMoneyOrDash(p.supplierRetailPrice)}
                            </td>
                            <td className="hidden px-2 py-2 text-zinc-400 lg:table-cell">
                              {formatMoneyOrDash(p.supplierBulkPrice)}
                            </td>
                            <td className="px-2 py-2 font-medium text-amber-100">
                              {formatPhpFromCents(totalCost)}
                            </td>
                            <td className="hidden px-2 py-2 text-zinc-400 sm:table-cell">
                              {formatPhpFromCents(p.costPrice)}
                            </td>
                            <td className="hidden px-2 py-2 text-zinc-400 md:table-cell">
                              {p.purchaseTier}
                            </td>
                            <td className="hidden px-2 py-2 text-zinc-200 sm:table-cell">
                              {formatPhpFromCents(p.retailPrice)}
                            </td>
                            <td className="hidden px-2 py-2 text-zinc-200 sm:table-cell">
                              {formatPhpFromCents(p.bulkPrice)}
                            </td>
                            <td className="px-2 py-2 font-medium">{p.stockQuantity}</td>
                            <td className="hidden px-2 py-2 text-emerald-400/90 xl:table-cell">
                              +{formatPhpFromCents(profit)}
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
      </div>
    </AppShell>
  );
}
