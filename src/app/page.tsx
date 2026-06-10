import { StatCard } from "@/components/StatCard";
import { AppShell } from "@/components/AppShell";
import { ExpiringSoonTable } from "@/components/ExpiringSoonTable";
import { getInventoryAtAGlance, getStockAlerts } from "@/db/queries/inventory";
import { getBusinessInsights } from "@/db/queries/business";
import { getInvestorSummary } from "@/lib/investor-income";
import { formatPhpFromCents } from "@/lib/money";
import { rowSearchText } from "@/lib/table-filter";
import { formatStockLabel } from "@/lib/product-stock";
import type { StockUnit } from "@/db/schema";
import { StockAlertsTable } from "@/components/StockAlertsTable";
import Link from "next/link";

function formatDateShort(d: Date) {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(d);
}

export const dynamic = "force-dynamic";

export default async function Home() {
  const [glance, insights, investor, stockAlerts] = await Promise.all([
    getInventoryAtAGlance({ daysUntilExpiry: 30 }),
    getBusinessInsights(),
    getInvestorSummary(),
    getStockAlerts(),
  ]);

  const expiringRows = glance.expiringSoon.map((p) => ({
    id: p.id,
    name: p.name,
    subtitle: [p.brand, p.variant].filter(Boolean).join(" • "),
    stockQuantity: formatStockLabel(
      p.stockUnit as StockUnit,
      p.stockQuantity,
      p.kgPerSack,
      p.unitsPerCase,
    ),
    expiryLabel: p.expiryDate ? formatDateShort(p.expiryDate) : "—",
    searchText: rowSearchText([p.name, p.brand, p.variant]),
  }));

  return (
    <AppShell>
      <div className="w-full px-0 py-4">
        <div className="flex flex-col gap-2">
          <div className="text-sm text-zinc-400">Dashboard</div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Inventory Dashboard
          </h1>
          <p className="text-sm text-zinc-400">
            At-a-glance stock health and expiry risk.
          </p>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            href="/products"
            className="rounded-xl bg-zinc-50 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white"
          >
            Add / Manage Products
          </Link>
          <Link
            href="/orders"
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-100 hover:bg-white/10"
          >
            Sales & Orders
          </Link>
          <div className="text-xs text-zinc-400">
            (Quick Sell modal will be on this dashboard next.)
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard
            title="Total stock value (cost basis)"
            value={formatPhpFromCents(glance.totalStockValueCents)}
            subtitle="Cost × on-hand qty (kg, pcs, cases adjusted)"
          />
          <StatCard
            title="Items expiring soon"
            value={`${glance.expiringSoonCount}`}
            subtitle={`Within 30 days (by ${formatDateShort(glance.cutoff)})`}
          />
          <StatCard
            title="Out of stock"
            value={`${stockAlerts.empty.length}`}
            subtitle="Items at zero — restock needed"
          />
          <StatCard
            title="Low stock"
            value={`${stockAlerts.low.length}`}
            subtitle="Running low — check Inventory"
          />
          <StatCard
            title="Income (last 30 days)"
            value={formatPhpFromCents(insights.incomeLast30DaysCents)}
            subtitle="Cash collected from orders"
          />
          {investor?.hasSetup ? (
            <StatCard
              title={`Investor share (${investor.sharePercent}%)`}
              value={formatPhpFromCents(investor.currentShareCents)}
              subtitle={`${investor.investorName} · ${investor.currentMonthLabel} (projected)`}
            />
          ) : investor ? (
            <StatCard
              title="Investor share"
              value="Setup needed"
              subtitle={
                <Link href="/investors" className="text-[#e8a44a] underline">
                  Complete agreement →
                </Link>
              }
            />
          ) : (
            <StatCard
              title="Investor share"
              value="—"
              subtitle={
                <Link href="/investors" className="text-zinc-400 underline">
                  Add investor →
                </Link>
              }
            />
          )}
        </div>

        {investor?.hasSetup ? (
          <div className="mt-4 rounded-xl border border-[#e8a44a]/20 bg-[#e8a44a]/5 px-4 py-3 text-sm">
            <span className="text-zinc-300">{investor.investorName}</span>
            <span className="text-zinc-500"> · </span>
            <span className="text-[#e8a44a]">
              {formatPhpFromCents(investor.currentShareCents)} this month
            </span>
            <span className="text-zinc-500"> · </span>
            <span className="text-zinc-400">
              Paid YTD {formatPhpFromCents(investor.paidOutYtdCents)}
            </span>
            {investor.accruedUnpaidCents > 0 ? (
              <>
                <span className="text-zinc-500"> · </span>
                <span className="text-amber-300">
                  Accrued {formatPhpFromCents(investor.accruedUnpaidCents)}
                </span>
              </>
            ) : null}
            <Link
              href="/investors"
              className="ml-3 text-xs text-zinc-400 underline hover:text-zinc-200"
            >
              Investor tab →
            </Link>
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            href="/reports"
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-100 hover:bg-white/10"
          >
            View Business Insights
          </Link>
        </div>

        {stockAlerts.all.length > 0 ? (
          <div className="mt-8 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6">
            <div className="text-sm text-zinc-300">Stock alerts</div>
            <div className="mt-1 text-xs text-zinc-400">
              Items that are out of stock or running low.
            </div>
            <StockAlertsTable rows={stockAlerts.all} showLink />
          </div>
        ) : null}

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm text-zinc-300">Expiring soon</div>
              <div className="mt-1 text-xs text-zinc-400">
                Showing up to 8 products with an expiry date in the next 30 days.
              </div>
            </div>
            <div className="text-xs text-zinc-400">
              (Quick Sell + Bulk Tools next)
            </div>
          </div>

          <ExpiringSoonTable rows={expiringRows} />
        </div>
      </div>
    </AppShell>
  );
}
