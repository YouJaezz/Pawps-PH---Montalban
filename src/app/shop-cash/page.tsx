import Link from "next/link";
import { eq } from "drizzle-orm";

import { ShopCashPanel } from "@/app/shop-cash/ShopCashPanel";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import type { ProductSelectOption } from "@/components/ProductSelectField";
import { db } from "@/db";
import { getCashProfitReport } from "@/db/queries/cash-profit-report";
import { getInvestorCapitalDashboard } from "@/db/queries/investor-capital";
import { getShopCashDashboard } from "@/db/queries/shop-cash";
import { investors, products, suppliers } from "@/db/schema";
import { requireAdmin } from "@/lib/auth-guard";
import { getActiveBranches } from "@/lib/branch-stock";
import type { StockUnit } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function ShopCashPage() {
  await requireAdmin();

  const [dashboard, cashReport, investorCapital, productRows, branchRows, supplierRows, investorRows] =
    await Promise.all([
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
          costPrice: products.costPrice,
        })
        .from(products)
        .where(eq(products.archived, false))
        .orderBy(products.brand, products.name),
      getActiveBranches(),
      db.select({ id: suppliers.id, name: suppliers.name }).from(suppliers).orderBy(suppliers.name),
      db
        .select({ id: investors.id, fullName: investors.fullName })
        .from(investors)
        .where(eq(investors.active, true))
        .orderBy(investors.fullName),
    ]);

  const cashCollectedCents = cashReport.cash.cashInHandCents;
  const availableShopCashCents = cashCollectedCents - dashboard.shopCashAllTime.totalCents;

  const supplierById = new Map(supplierRows.map((s) => [s.id, s.name]));

  const restockProducts: Array<
    ProductSelectOption & { stockUnit: StockUnit; costPriceCents: number }
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
    };
  });

  return (
    <AppShell>
      <div className="w-full px-0 py-4">
        <PageHeader
          eyebrow="Admin"
          title="Shop cash"
          description="Track money leaving the shop — from sales cash or investor capital. Restock payments auto-update unit costs when prices change."
          actions={
            <Link
              href="/reports"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-100 hover:bg-white/10"
            >
              Cash &amp; profit report →
            </Link>
          }
        />

        <div className="mt-6">
          <ShopCashPanel
            cashCollectedCents={cashCollectedCents}
            availableShopCashCents={availableShopCashCents}
            thisMonthExpenseCents={dashboard.thisMonthShopCash.expenseCents}
            thisMonthRestockCents={dashboard.thisMonthShopCash.restockCents}
            investorCapital={investorCapital}
            entries={dashboard.entries}
            restockProducts={restockProducts}
            branches={branchRows.map((b) => ({ id: b.id, name: b.name }))}
            suppliers={supplierRows}
            investors={investorRows}
          />
        </div>
      </div>
    </AppShell>
  );
}
