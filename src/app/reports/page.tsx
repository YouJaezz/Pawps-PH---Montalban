import Link from "next/link";

import { AppShell } from "@/components/AppShell";
import { StatCard } from "@/components/StatCard";
import { ScrollableTable } from "@/components/ScrollableTable";
import { getBusinessInsights } from "@/db/queries/business";
import { formatPhpFromCents } from "@/lib/money";

export default async function ReportsPage() {
  const insights = await getBusinessInsights();

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
              Income, receivables, and top products.
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

          <ScrollableTable maxHeight="max-h-[min(55vh,480px)]">
            <table className="w-full table-fixed text-sm">
              <thead className="bg-white/5 text-left text-zinc-300">
                <tr>
                  <th className="px-4 py-3 font-medium">Product</th>
                  <th className="w-20 px-4 py-3 font-medium">Qty</th>
                  <th className="w-28 px-4 py-3 font-medium">Revenue</th>
                  <th className="hidden w-28 px-4 py-3 font-medium sm:table-cell">
                    Profit
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {insights.topProductsLast30Days.length === 0 ? (
                  <tr>
                    <td className="px-4 py-4 text-zinc-400" colSpan={3}>
                      No paid sales yet — use Quick Sell to record sales.
                    </td>
                  </tr>
                ) : (
                  insights.topProductsLast30Days.map((p) => (
                    <tr key={p.productId} className="hover:bg-white/5">
                      <td className="px-4 py-3 font-medium text-zinc-50">
                        <div className="truncate">{p.label}</div>
                        <div className="mt-1 text-xs text-zinc-400 sm:hidden">
                          Profit: {formatPhpFromCents(p.profitCents)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-zinc-200">{p.quantity}</td>
                      <td className="px-4 py-3 text-zinc-200">
                        {formatPhpFromCents(p.revenueCents)}
                      </td>
                      <td className="hidden px-4 py-3 text-zinc-200 sm:table-cell">
                        {formatPhpFromCents(p.profitCents)}
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

