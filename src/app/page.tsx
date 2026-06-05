import { StatCard } from "@/components/StatCard";
import { AppShell } from "@/components/AppShell";
import { ExpiringSoonTable } from "@/components/ExpiringSoonTable";
import { getInventoryAtAGlance } from "@/db/queries/inventory";
import { getBusinessInsights } from "@/db/queries/business";
import { formatPhpFromCents } from "@/lib/money";
import { rowSearchText } from "@/lib/table-filter";
import Link from "next/link";

function formatDateShort(d: Date) {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(d);
}

export default async function Home() {
  const [glance, insights] = await Promise.all([
    getInventoryAtAGlance({ daysUntilExpiry: 30 }),
    getBusinessInsights(),
  ]);

  const expiringRows = glance.expiringSoon.map((p) => ({
    id: p.id,
    name: p.name,
    subtitle: [p.brand, p.variant].filter(Boolean).join(" • "),
    stockQuantity: p.stockQuantity,
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

        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          <StatCard
            title="Total stock value (cost basis)"
            value={formatPhpFromCents(glance.totalStockValueCents)}
            subtitle="Sum of costPrice × stockQuantity"
          />
          <StatCard
            title="Items expiring soon"
            value={`${glance.expiringSoonCount}`}
            subtitle={`Within 30 days (by ${formatDateShort(glance.cutoff)})`}
          />
          <StatCard
            title="Income (last 30 days)"
            value={formatPhpFromCents(insights.incomeLast30DaysCents)}
            subtitle="From paid orders"
          />
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            href="/reports"
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-100 hover:bg-white/10"
          >
            View Business Insights
          </Link>
        </div>

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
