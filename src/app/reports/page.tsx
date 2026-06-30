import Link from "next/link";

import { TopProductsTable } from "@/app/reports/TopProductsTable";
import { AppShell } from "@/components/AppShell";
import { CostChangeAlertsPanel } from "@/components/CostChangeAlertsPanel";
import { StatCard } from "@/components/StatCard";
import { getCashProfitReport } from "@/db/queries/cash-profit-report";
import { getBusinessInsights } from "@/db/queries/business";
import { getRecentCostChangeAlerts } from "@/db/queries/price-alerts";
import { requireAdmin } from "@/lib/auth-guard";
import { getInvestorSummary } from "@/lib/investor-income";
import { formatPhpFromCents } from "@/lib/money";
import { rowSearchText } from "@/lib/table-filter";

export const dynamic = "force-dynamic";

function PeriodProfitRow(props: {
  label: string;
  collectedCents: number;
  cogsCents: number;
  profitCents: number;
  orderCount: number;
}) {
  return (
    <tr className="border-b border-white/5 last:border-0">
      <td className="px-3 py-2.5 pr-3 font-medium text-zinc-200">{props.label}</td>
      <td className="px-3 py-2.5 pr-3 text-right text-zinc-300">
        {formatPhpFromCents(props.collectedCents)}
      </td>
      <td className="hidden px-3 py-2.5 pr-3 text-right text-zinc-500 sm:table-cell">
        {formatPhpFromCents(props.cogsCents)}
      </td>
      <td className="px-3 py-2.5 pr-3 text-right font-semibold text-emerald-300/90">
        {formatPhpFromCents(props.profitCents)}
      </td>
      <td className="px-3 py-2.5 text-right text-[10px] text-zinc-600">
        {props.orderCount} order{props.orderCount === 1 ? "" : "s"}
      </td>
    </tr>
  );
}

export default async function ReportsPage() {
  await requireAdmin();
  const [report, insights, investor, priceAlerts] = await Promise.all([
    getCashProfitReport(),
    getBusinessInsights(),
    getInvestorSummary(),
    getRecentCostChangeAlerts(15),
  ]);

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
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-sm text-zinc-400">Reports</div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">
              Cash &amp; profit
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-zinc-400">
              Money collected from sales, what customers still owe, and gross profit
              after the cost of goods sold. Inventory capital is tracked separately —
              it stays in stock until you sell it.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/shop-cash"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-100 hover:bg-white/10"
            >
              Shop cash
            </Link>
            <Link
              href="/orders?tab=daily-sales"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-100 hover:bg-white/10"
            >
              Daily sales
            </Link>
            <Link
              href="/orders"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-100 hover:bg-white/10"
            >
              Orders
            </Link>
          </div>
        </div>

        <section className="mt-8 rounded-2xl border border-brand-cyan/20 bg-brand-blue/5 p-5">
          <h2 className="text-sm font-semibold text-zinc-100">Cash from sales</h2>
          <p className="mt-1 text-[11px] text-zinc-500">
            All orders except cancelled · full database, not the orders table limit
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              accent
              compact
              title="Cash in hand"
              value={formatPhpFromCents(report.cash.cashInHandCents)}
              subtitle="Total payments recorded from customers"
            />
            <StatCard
              compact
              title="Available shop cash"
              value={formatPhpFromCents(report.cash.availableShopCashCents)}
              subtitle="Sales cash minus shop-cash outflows only"
            />
            <StatCard
              compact
              title="Investor capital"
              value={formatPhpFromCents(report.cash.investorCapitalBalanceCents)}
              subtitle="Pool for equipment & non-sales expenses"
            />
            <StatCard
              compact
              title="Still to collect"
              value={formatPhpFromCents(report.cash.receivablesCents)}
              subtitle="Unpaid balance on open orders"
            />
            <StatCard
              compact
              title="Total billed"
              value={formatPhpFromCents(report.cash.totalBilledCents)}
              subtitle={`${report.cash.activeOrderCount} active order(s)`}
            />
          </div>
          <p className="mt-3 text-[10px] text-zinc-600">
            Available shop cash = cash in hand − shop-cash outflows only (
            {formatPhpFromCents(report.cash.shopOutflowsAllTimeCents)} total).
            Investor pool: {formatPhpFromCents(report.cash.investorCapitalBalanceCents)}{" "}
            available ({formatPhpFromCents(report.cash.investorCapitalContributedCents)}{" "}
            contributed, {formatPhpFromCents(report.cash.investorCapitalSpentCents)} spent).
            This month shop outflows:{" "}
            {formatPhpFromCents(report.cash.shopOutflowsThisMonthCents)} (
            {formatPhpFromCents(report.cash.shopExpensesThisMonthCents)} expenses,{" "}
            {formatPhpFromCents(report.cash.shopRestockThisMonthCents)} restock).{" "}
            <Link href="/shop-cash" className="underline hover:text-zinc-400">
              Record expenses &amp; restock →
            </Link>
          </p>
          <p className="mt-1 text-[10px] text-zinc-600">
            Cash in hand + still to collect = total billed. Use Daily sales for
            payments on a specific date.
          </p>
        </section>

        <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-sm font-semibold text-zinc-100">Gross profit</h2>
          <p className="mt-1 text-[11px] text-zinc-500">
            Collected cash minus cost of goods sold (COGS) for items that left the
            shelf. Does not subtract inventory still on hand.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard
              compact
              title={`Collected · ${report.monthLabel}`}
              value={formatPhpFromCents(report.thisMonth.grossRevenueCents)}
              subtitle={`${report.thisMonth.orderCount} order(s) with payment`}
            />
            <StatCard
              compact
              title="COGS (sold goods)"
              value={formatPhpFromCents(report.thisMonth.cogsCents)}
              subtitle="Cost at time of sale"
            />
            <StatCard
              compact
              title="Gross profit"
              value={formatPhpFromCents(report.thisMonth.netIncomeCents)}
              subtitle="Collected − COGS this month"
            />
          </div>

          <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[420px] text-xs">
              <thead className="bg-white/5 text-left text-[10px] text-zinc-500">
                <tr>
                  <th className="px-3 py-2">Period</th>
                  <th className="px-3 py-2 text-right">Collected</th>
                  <th className="hidden px-3 py-2 text-right sm:table-cell">
                    COGS
                  </th>
                  <th className="px-3 py-2 text-right">Gross profit</th>
                  <th className="px-3 py-2 text-right">Orders</th>
                </tr>
              </thead>
              <tbody>
                {report.periods.map((p) => (
                  <PeriodProfitRow
                    key={p.label}
                    label={p.label}
                    collectedCents={p.grossRevenueCents}
                    cogsCents={p.cogsCents}
                    profitCents={p.netIncomeCents}
                    orderCount={p.orderCount}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
          <h2 className="text-sm font-semibold text-zinc-100">Cost price changes</h2>
          <p className="mt-1 text-[11px] text-zinc-500">
            Detected from restock payments and supplier pricelist uploads. Updated unit
            costs flow into COGS on future sales.
          </p>
          <div className="mt-4">
            <CostChangeAlertsPanel alerts={priceAlerts.alerts} />
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-sm font-semibold text-zinc-100">
            Inventory capital
          </h2>
          <p className="mt-1 text-[11px] text-zinc-500">
            Money tied up in stock on your shelf — not an expense until sold. When
            you sell, COGS moves from here into the profit calculation above.
          </p>
          <div className="mt-4 max-w-sm">
            <StatCard
              compact
              title="Stock on hand (at cost)"
              value={formatPhpFromCents(report.inventoryCapitalCents)}
              subtitle="Working capital in inventory · separate from profit"
            />
          </div>
        </section>

        {investor?.hasSetup ? (
          <div className="mt-6 rounded-xl border border-brand-blue/20 bg-brand-blue/5 px-4 py-3 text-sm text-zinc-300">
            <span className="font-medium text-zinc-100">{investor.investorName}</span>
            <span className="text-zinc-500"> · </span>
            <span>
              {investor.sharePercent}% of {report.monthLabel} gross profit ={" "}
              <span className="text-brand-cyan">
                {formatPhpFromCents(investor.currentShareCents)}
              </span>
            </span>
            <Link
              href="/investors"
              className="ml-2 text-xs text-zinc-400 underline hover:text-zinc-200"
            >
              Investor details →
            </Link>
          </div>
        ) : null}

        <section className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-zinc-100">
                Top products (last 30 days)
              </div>
              <div className="mt-1 text-xs text-zinc-400">
                Revenue and profit per product from orders with payment.
              </div>
            </div>
            <a
              href="/api/export/stock-levels.csv"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-100 hover:bg-white/10"
            >
              Export stock CSV
            </a>
          </div>
          <TopProductsTable rows={topProductRows} />
        </section>
      </div>
    </AppShell>
  );
}
