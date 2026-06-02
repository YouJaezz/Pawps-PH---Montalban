import { StatCard } from "@/components/StatCard";
import { AppShell } from "@/components/AppShell";
import { ScrollableTable } from "@/components/ScrollableTable";
import { getInventoryAtAGlance } from "@/db/queries/inventory";
import { getBusinessInsights } from "@/db/queries/business";
import { formatPhpFromCents } from "@/lib/money";
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

          <ScrollableTable maxHeight="max-h-[min(50vh,400px)]">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-left text-zinc-300">
                <tr>
                  <th className="px-4 py-3 font-medium">Product</th>
                  <th className="px-4 py-3 font-medium">Stock</th>
                  <th className="px-4 py-3 font-medium">Expiry</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {glance.expiringSoon.length === 0 ? (
                  <tr>
                    <td className="px-4 py-4 text-zinc-400" colSpan={3}>
                      No expiring items found (or no products yet).
                    </td>
                  </tr>
                ) : (
                  glance.expiringSoon.map((p) => (
                    <tr key={p.id} className="hover:bg-white/5">
                      <td className="px-4 py-3">
                        <div className="font-medium text-zinc-50">
                          {p.name}
                        </div>
                        <div className="text-xs text-zinc-400">
                          {[p.brand, p.variant].filter(Boolean).join(" • ")}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-zinc-200">
                        {p.stockQuantity}
                      </td>
                      <td className="px-4 py-3 text-zinc-200">
                        {p.expiryDate ? formatDateShort(p.expiryDate) : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </ScrollableTable>
        </div>
      </div>
    </AppShell>
  );
}
