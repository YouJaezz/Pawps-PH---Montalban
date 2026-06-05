import Link from "next/link";

import { TopProductsTable } from "@/app/reports/TopProductsTable";
import { AppShell } from "@/components/AppShell";
import { StatCard } from "@/components/StatCard";
import { getBusinessInsights } from "@/db/queries/business";
import { formatPhpFromCents } from "@/lib/money";
import { rowSearchText } from "@/lib/table-filter";

export default async function ReportsPage() {
  const insights = await getBusinessInsights();

  const topProductRows = insights.topProductsLast30Days.map((p) => ({
    productId: p.productId,
    label: p.label,
    quantity: p.quantity,
    revenueCents: p.revenueCents,
    profitCents: p.profitCents,
    searchText: rowSearchText([p.label]),
  }));

  return (
    <AppShell>
      <div className="w-full px-0 py-4">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="text-sm text-zinc-400">Reports</div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">
              Business Insights
            </h1>
            <p className="mt-2 text-sm text-zinc-400">
              Cash income, on-hand stock value, and top products.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/orders"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-100 hover:bg-white/10"
            >
              Go to Orders
            </Link>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-4">
          <StatCard
            title="Income today"
            value={formatPhpFromCents(insights.incomeTodayCents)}
          />
          <StatCard
            title="Income (last 7 days)"
            value={formatPhpFromCents(insights.incomeLast7DaysCents)}
          />
          <StatCard
            title="Income (last 30 days)"
            value={formatPhpFromCents(insights.incomeLast30DaysCents)}
          />
          <StatCard
            title="Receivables"
            value={formatPhpFromCents(insights.receivablesCents)}
            subtitle="Unpaid balance across orders"
          />
        </div>

        <div className="mt-4 text-xs font-medium uppercase tracking-wide text-zinc-500">
          On-hand inventory
        </div>
        <div className="mt-2 grid grid-cols-1 gap-4 md:grid-cols-3">
          <StatCard
            title="Stock value (cost)"
            value={formatPhpFromCents(insights.stockValueCents)}
            subtitle="What you paid for existing stock"
          />
          <StatCard
            title="Potential stock income"
            value={formatPhpFromCents(insights.potentialStockIncomeCents)}
            subtitle="If all stock sells at your retail price"
          />
          <StatCard
            title="Profit potential (on hand)"
            value={formatPhpFromCents(insights.profitPotentialCents)}
            subtitle="Retail minus cost on existing qty"
          />
        </div>

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-zinc-100">
                Top products (last 30 days)
              </div>
              <div className="mt-1 text-xs text-zinc-400">
                Based on paid orders. Profit uses unit cost stored at sale time.
              </div>
            </div>
            <a
              href="/api/export/stock-levels.csv"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-100 hover:bg-white/10"
            >
              Export Stock CSV
            </a>
          </div>

          <TopProductsTable rows={topProductRows} />
        </div>
      </div>
    </AppShell>
  );
}

