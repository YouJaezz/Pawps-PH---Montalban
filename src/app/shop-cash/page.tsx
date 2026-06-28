import Link from "next/link";

import { ShopCashPanel } from "@/app/shop-cash/ShopCashPanel";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { getCashProfitReport } from "@/db/queries/cash-profit-report";
import { getActiveInventoryProducts } from "@/db/queries/inventory-products";
import { getShopCashDashboard } from "@/db/queries/shop-cash";
import { requireAdmin } from "@/lib/auth-guard";
import { getActiveBranches } from "@/lib/branch-stock";
import { db } from "@/db";
import { suppliers } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function ShopCashPage() {
  await requireAdmin();

  const [dashboard, cashReport, inventoryProducts, branchRows, supplierRows] =
    await Promise.all([
      getShopCashDashboard(),
      getCashProfitReport(),
      getActiveInventoryProducts(),
      getActiveBranches(),
      db.select({ id: suppliers.id, name: suppliers.name }).from(suppliers).orderBy(suppliers.name),
    ]);

  const cashCollectedCents = cashReport.cash.cashInHandCents;
  const allTimeOutflowsCents = dashboard.allTime.totalCents;
  const availableShopCashCents = cashCollectedCents - allTimeOutflowsCents;

  const products = inventoryProducts
    .map((p) => ({
      id: p.id,
      label: `${p.name}${p.variant ? ` (${p.variant})` : ""}`,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return (
    <AppShell>
      <div className="w-full px-0 py-4">
        <PageHeader
          eyebrow="Admin"
          title="Shop cash"
          description="Track money leaving the shop — bills, rent, and inventory restocks paid from on-hand sales cash. Available shop cash updates automatically in Reports."
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
            thisMonthExpenseCents={dashboard.thisMonth.expenseCents}
            thisMonthRestockCents={dashboard.thisMonth.restockCents}
            entries={dashboard.entries}
            products={products}
            branches={branchRows.map((b) => ({ id: b.id, name: b.name }))}
            suppliers={supplierRows}
          />
        </div>
      </div>
    </AppShell>
  );
}
