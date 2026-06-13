import Link from "next/link";

import { CustomerPricelistExport } from "@/app/products/CustomerPricelistExport";
import {
  InventoryTable,
  type InventoryTableRow,
} from "@/app/products/InventoryTable";
import { ProductAddButton } from "@/app/products/ProductAddButton";
import { AppShell } from "@/components/AppShell";
import { db } from "@/db";
import { getSupplierCatalogRows } from "@/db/queries/suppliers";
import { products, suppliers } from "@/db/schema";
import { getSession } from "@/lib/session";
import { isAdmin } from "@/lib/roles";
import {
  resolveInventoryLabels,
} from "@/lib/catalog-item-display";
import { computeInventoryValuation } from "@/lib/inventory-valuation";
import { formatPhpFromCents } from "@/lib/money";
import { formatDualStock } from "@/lib/product-stock";
import { displayCatalogItemType } from "@/lib/catalog-item-types";
import { repairInventoryLabelsFromCatalog } from "@/lib/inventory-catalog-sync";
import { formatSupplierPrice } from "@/lib/price-units";
import { rowSearchText } from "@/lib/table-filter";
import type { StockUnit } from "@/db/schema";
import { eq } from "drizzle-orm";

export default async function ProductsPage() {
  const session = await getSession();
  const admin = isAdmin(session?.role);

  const [supplierRows, catalogData] = await Promise.all([
    db
      .select({ id: suppliers.id, name: suppliers.name })
      .from(suppliers)
      .orderBy(suppliers.name),
    getSupplierCatalogRows(),
  ]);

  const { suppliersWithCounts, searchRows: catalogItems } = catalogData;
  const catalogById = new Map(catalogItems.map((c) => [c.id, c]));

  let rows = await db
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
    .orderBy(products.name);

  const repaired = await repairInventoryLabelsFromCatalog(rows, catalogById);
  if (repaired) {
    rows = await db
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
      .orderBy(products.name);
  }

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

  const inventoryTableRows: InventoryTableRow[] = rows.map((p) => {
    const catalog = p.supplierCatalogItemId
      ? catalogById.get(p.supplierCatalogItemId)
      : undefined;
    const labels = resolveInventoryLabels(
      {
        name: p.name,
        brand: p.brand,
        variant: p.variant,
      },
      catalog,
    );
    const item = labels.item;
    const brand = labels.brand;
    const flavor = labels.flavor;
    const itemType = p.itemType ?? catalog?.itemType ?? null;
    const itemTypeLabel = displayCatalogItemType(itemType);
    const priceUnit = catalog?.priceUnit ?? "Sack";
    const supplierName = p.supplierId
      ? (supplierById.get(p.supplierId) ?? "—")
      : "—";
    const stock = formatDualStock(p.stockUnit as StockUnit, p.stockQuantity, {
      kgPerSack: p.kgPerSack,
      unitsPerCase: p.unitsPerCase,
    });
    const retailProfit = Math.max(0, p.retailPrice - p.costPrice);
    const bulkProfit =
      p.bulkPrice > 0 ? Math.max(0, p.bulkPrice - p.costPrice) : null;
    const isWeight = p.stockUnit === "Kilogram" || p.kgPerSack != null;
    const unitSuffix = isWeight ? "/kg" : "/pc";

    return {
      id: p.id,
      item,
      brand,
      flavor,
      itemTypeLabel,
      supplierName,
      supplierId: p.supplierId,
      supplierRetail: formatSupplierPrice(catalog?.retailPrice, priceUnit),
      supplierWs: formatSupplierPrice(catalog?.unitCost, priceUnit),
      purchaseTier: p.purchaseTier,
      ourRetail: formatPhpFromCents(p.retailPrice),
      ourWs:
        p.bulkPrice > 0 ? formatPhpFromCents(p.bulkPrice) : "—",
      stockPrimary: stock.primary,
      stockSecondary: stock.secondary,
      profitRetail: formatPhpFromCents(retailProfit),
      profitBulk: bulkProfit != null ? formatPhpFromCents(bulkProfit) : null,
      unitSuffix,
      stockQuantity: p.stockQuantity,
      searchText: rowSearchText([
        item,
        brand,
        flavor,
        itemTypeLabel,
        supplierName,
        p.purchaseTier,
      ]),
      productEdit: {
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
      },
    };
  });

  const inventorySuppliers = supplierRows
    .filter((s) => inventoryTableRows.some((r) => r.supplierId === s.id))
    .map((s) => ({ id: s.id, name: s.name }));

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
            {admin ? (
              <>
                <Link
                  href="/suppliers"
                  className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-200 hover:bg-white/5"
                >
                  Suppliers
                </Link>
                <CustomerPricelistExport />
                <a
                  href="/api/export/stock-levels.csv"
                  className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-200 hover:bg-white/5"
                  title="Internal stock export with costs and quantities"
                >
                  Stock CSV
                </a>
              </>
            ) : null}
          </div>
        </div>

        {admin ? (
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
            <div className="text-sm font-semibold text-brand-cyan/80">
              {formatPhpFromCents(valuation.profitPotentialCents)}
            </div>
          </div>
        </div>
        ) : null}

        <div className="mt-5">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="mb-3 text-sm font-medium text-zinc-100">
              Inventory ({rows.length})
            </div>

            <InventoryTable
              rows={inventoryTableRows}
              suppliers={inventorySuppliers}
              limitedView={!admin}
            />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
