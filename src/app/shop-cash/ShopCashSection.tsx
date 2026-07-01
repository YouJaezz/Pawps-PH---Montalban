import Link from "next/link";
import { eq } from "drizzle-orm";

import { ShopCashPanel } from "@/app/shop-cash/ShopCashPanel";
import type { ProductSelectOption } from "@/components/ProductSelectField";
import { db } from "@/db";
import { getCashProfitReport } from "@/db/queries/cash-profit-report";
import { getInvestorCapitalDashboard } from "@/db/queries/investor-capital";
import { getShopCashDashboard } from "@/db/queries/shop-cash";
import { getSupplierCatalogRows } from "@/db/queries/suppliers";
import { investors, products } from "@/db/schema";
import { getActiveBranches } from "@/lib/branch-stock";
import type { StockUnit } from "@/db/schema";
import { catalogItemKey } from "@/lib/supplier-item-key";

export async function ShopCashSection() {
  const [
    dashboard,
    cashReport,
    investorCapital,
    productRows,
    branchRows,
    catalogData,
    investorRows,
  ] = await Promise.all([
    getShopCashDashboard(),
    getCashProfitReport(),
    getInvestorCapitalDashboard(),
    db
      .select({
        id: products.id,
        name: products.name,
        brand: products.brand,
        variant: products.variant,
        itemType: products.itemType,
        stockUnit: products.stockUnit,
        supplierId: products.supplierId,
        supplierCatalogItemId: products.supplierCatalogItemId,
        costPrice: products.costPrice,
        kgPerSack: products.kgPerSack,
        unitsPerCase: products.unitsPerCase,
      })
      .from(products)
      .where(eq(products.archived, false))
      .orderBy(products.brand, products.name),
    getActiveBranches(),
    getSupplierCatalogRows(),
    db
      .select({ id: investors.id, fullName: investors.fullName })
      .from(investors)
      .where(eq(investors.active, true))
      .orderBy(investors.fullName),
  ]);

  const { suppliersWithCounts, searchRows: catalogItems } = catalogData;

  const cashCollectedCents = cashReport.cash.cashInHandCents;
  const availableShopCashCents = cashCollectedCents - dashboard.shopCashAllTime.totalCents;

  const supplierById = new Map(suppliersWithCounts.map((s) => [s.id, s.name]));

  const restockProducts: Array<
    ProductSelectOption & {
      stockUnit: StockUnit;
      costPriceCents: number;
      kgPerSack: number | null;
      unitsPerCase: number | null;
      itemType: string | null;
    }
  > = productRows.map((p) => {
    const supplierName = p.supplierId ? supplierById.get(p.supplierId) : null;
    const metaParts = [
      supplierName,
      p.stockUnit !== "Piece" ? p.stockUnit : null,
    ].filter(Boolean);
    return {
      id: p.id,
      name: p.name,
      brand: p.brand,
      variant: p.variant,
      itemType: p.itemType,
      meta: metaParts.length ? metaParts.join(" · ") : undefined,
      stockUnit: p.stockUnit as StockUnit,
      costPriceCents: p.costPrice,
      kgPerSack: p.kgPerSack,
      unitsPerCase: p.unitsPerCase,
    };
  });

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

  const suppliersForForm = suppliersWithCounts.map((s) => ({
    id: s.id,
    name: s.name,
    itemCount: s.itemCount,
  }));

  const inventoryCatalogItemIds = productRows
    .map((p) => p.supplierCatalogItemId)
    .filter((id): id is number => id != null);

  const inventoryProductKeys = productRows.map((p) =>
    catalogItemKey({
      brand: p.brand,
      variant: p.variant,
      itemName: p.name,
    }),
  );

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Link
          href="/reports"
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-100 hover:bg-white/10"
        >
          Cash &amp; profit report →
        </Link>
      </div>
      <ShopCashPanel
        cashCollectedCents={cashCollectedCents}
        availableShopCashCents={availableShopCashCents}
        thisMonthExpenseCents={dashboard.thisMonthShopCash.expenseCents}
        thisMonthRestockCents={dashboard.thisMonthShopCash.restockCents}
        investorCapital={investorCapital}
        entries={dashboard.entries}
        restockProducts={restockProducts}
        branches={branchRows.map((b) => ({
          id: b.id,
          name: b.name,
          isDefault: b.isDefault,
        }))}
        suppliers={suppliersForForm}
        catalogItems={catalogPickItems}
        inventoryCatalogItemIds={inventoryCatalogItemIds}
        inventoryProductKeys={inventoryProductKeys}
        investors={investorRows}
      />
    </>
  );
}
