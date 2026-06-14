"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import type { DailySalesReport } from "@/db/queries/daily-sales";
import { ScrollableTable } from "@/components/ScrollableTable";
import { StatCard } from "@/components/StatCard";
import {
  normalizeOrderStatus,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_STYLES,
} from "@/lib/order-status";
import { formatPhpFromCents } from "@/lib/money";
import { formatOrderWhen } from "@/lib/order-timestamp";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function DailySalesPanel(props: {
  report: DailySalesReport;
  adminMode?: boolean;
  todayOnly?: boolean;
}) {
  const router = useRouter();
  const { report } = props;
  const dateInputValue = report.dateKey;
  const showDateNav = props.adminMode && !props.todayOnly;

  const prevDate = (() => {
    const d = new Date(
      `${report.year}-${pad2(report.month)}-${pad2(report.day)}T12:00:00+08:00`,
    );
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  })();
  const nextDate = (() => {
    const d = new Date(
      `${report.year}-${pad2(report.month)}-${pad2(report.day)}T12:00:00+08:00`,
    );
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  })();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-50">Daily sales</h2>
          <p className="text-[11px] text-zinc-500">
            {props.todayOnly ? "Today only · " : ""}
            {report.dateLabel}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {showDateNav ? (
            <>
              <Link
                href={`/orders?tab=daily-sales&date=${prevDate}`}
                className="rounded-md border border-white/10 px-2 py-1 text-[10px] text-zinc-400 hover:bg-white/5"
              >
                ← Prev
              </Link>
              <input
                type="date"
                value={dateInputValue}
                onChange={(e) => {
                  if (!e.target.value) return;
                  router.push(`/orders?tab=daily-sales&date=${e.target.value}`);
                }}
                className="app-select rounded-md border border-white/10 px-2 py-1 text-[11px]"
              />
              <Link
                href={`/orders?tab=daily-sales&date=${nextDate}`}
                className="rounded-md border border-white/10 px-2 py-1 text-[10px] text-zinc-400 hover:bg-white/5"
              >
                Next →
              </Link>
            </>
          ) : null}
          {props.adminMode ? (
            <a
              href={`/api/export/daily-sales.csv?date=${dateInputValue}`}
              className="rounded-md border border-brand-blue/30 bg-brand-blue/10 px-3 py-1 text-[10px] text-brand-blue"
            >
              Export CSV
            </a>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatCard
          accent
          compact
          title="Total existing balance"
          value={formatPhpFromCents(report.summary.totalExistingBalanceCents)}
          subtitle={`${report.summary.unpaidOrderCount} order(s) with balance`}
        />
        <StatCard
          compact
          title="Collected today"
          value={formatPhpFromCents(report.summary.collectedTodayCents)}
          subtitle={`${report.summary.paymentCount} payment(s) on this date`}
        />
      </div>

      <section className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h3 className="text-sm font-medium text-zinc-100">Existing unpaid balances</h3>
        <p className="mt-1 text-[10px] text-zinc-500">
          Amounts still owed on orders that are not fully paid. Payments recorded on{" "}
          {report.dateLabel} appear in the last column when the order was created that
          day.
        </p>
        <ScrollableTable maxHeight="max-h-72" className="mt-3">
          <table className="w-full text-[11px]">
            <thead className="bg-white/5 text-left text-[10px] text-zinc-500">
              <tr>
                <th className="px-2 py-2">Customer</th>
                <th className="px-2 py-2">Order date</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Days</th>
                <th className="px-2 py-2">Charges</th>
                <th className="px-2 py-2">Paid</th>
                <th className="px-2 py-2">Balance</th>
                <th className="px-2 py-2">Collected today</th>
                <th className="px-2 py-2">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {report.unpaidRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-2 py-4 text-zinc-500">
                    No unpaid balances — all caught up.
                  </td>
                </tr>
              ) : (
                report.unpaidRows.map((row) => {
                  const status = normalizeOrderStatus(row.status);
                  return (
                    <tr key={row.id} className="align-top hover:bg-white/[0.02]">
                      <td className="px-2 py-2 font-medium text-zinc-100">
                        {row.customerName}
                      </td>
                      <td className="px-2 py-2 text-zinc-400">{row.orderDateLabel}</td>
                      <td className="px-2 py-2">
                        <span
                          className={`inline-block rounded-full border px-2 py-0.5 text-[10px] ${ORDER_STATUS_STYLES[status]}`}
                        >
                          {ORDER_STATUS_LABELS[status]}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-zinc-400">{row.daysOutstanding}</td>
                      <td className="px-2 py-2">{formatPhpFromCents(row.chargesCents)}</td>
                      <td className="px-2 py-2">{formatPhpFromCents(row.paidCents)}</td>
                      <td className="px-2 py-2 font-medium text-red-300">
                        {formatPhpFromCents(row.balanceCents)}
                      </td>
                      <td className="px-2 py-2">
                        {row.collectedTodayCents > 0
                          ? formatPhpFromCents(row.collectedTodayCents)
                          : "—"}
                      </td>
                      <td className="px-2 py-2">
                        <Link
                          href={`/orders/receipt/${row.id}`}
                          target="_blank"
                          className="inline-flex items-center gap-1 rounded border border-white/10 px-2 py-0.5 text-[10px] text-zinc-300 hover:bg-white/5"
                        >
                          Open ↗
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </ScrollableTable>
      </section>

      <section className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h3 className="text-sm font-medium text-zinc-100">
          Orders cancelled on this date
        </h3>
        <p className="mt-1 text-[10px] text-zinc-500">
          Cancelled on {report.dateLabel}. These amounts are excluded from daily
          collections below.
        </p>
        {report.cancelledOnDate.length === 0 ? (
          <div className="mt-3 rounded-lg border border-dashed border-white/10 px-3 py-4 text-[11px] text-zinc-500">
            No orders were cancelled on this date.
          </div>
        ) : (
          <ScrollableTable maxHeight="max-h-40" className="mt-3">
            <table className="w-full text-[11px]">
              <thead className="bg-white/5 text-left text-[10px] text-zinc-500">
                <tr>
                  <th className="px-2 py-2">Customer</th>
                  <th className="px-2 py-2">Charges</th>
                  <th className="px-2 py-2">Paid</th>
                  <th className="px-2 py-2">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {report.cancelledOnDate.map((row) => (
                  <tr key={row.id}>
                    <td className="px-2 py-2">{row.customerName}</td>
                    <td className="px-2 py-2">{formatPhpFromCents(row.chargesCents)}</td>
                    <td className="px-2 py-2">{formatPhpFromCents(row.paidCents)}</td>
                    <td className="px-2 py-2">
                      <Link
                        href={`/orders/receipt/${row.id}`}
                        target="_blank"
                        className="text-[10px] text-zinc-400 underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollableTable>
        )}
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-medium text-zinc-100">Daily collections</h3>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            accent
            compact
            title="Total collected"
            value={formatPhpFromCents(report.collections.totalCollectedCents)}
            subtitle={`${report.collections.paymentsReceived.length} payment(s)`}
          />
          {report.collections.methodBreakdown.map((m) => (
            <StatCard
              key={m.method}
              compact
              title={m.method}
              value={formatPhpFromCents(m.amountCents)}
              subtitle={`${m.count} payment(s)`}
            />
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard
            compact
            title="Order charges (this date)"
            value={formatPhpFromCents(report.collections.totalChargesCents)}
            subtitle={`${report.collections.visitCount} order(s) · ${report.collections.walkInOrderCount} walk-in · ${report.collections.onlineOrderCount} online`}
          />
          <StatCard
            compact
            title="Paid (on these orders)"
            value={formatPhpFromCents(report.collections.totalPaidCents)}
            subtitle="Amount collected on these orders"
          />
          <StatCard
            compact
            title="Outstanding balance"
            value={formatPhpFromCents(report.collections.outstandingCents)}
            subtitle="Charges minus payments on these orders"
          />
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h4 className="text-xs font-medium text-zinc-300">Orders on this date</h4>
          <ScrollableTable maxHeight="max-h-64" className="mt-3">
            <table className="w-full text-[11px]">
              <thead className="bg-white/5 text-left text-[10px] text-zinc-500">
                <tr>
                  <th className="px-2 py-2">Customer</th>
                  <th className="px-2 py-2">Charges</th>
                  <th className="px-2 py-2">Paid</th>
                  <th className="px-2 py-2">Balance</th>
                  <th className="px-2 py-2">Collected today</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {report.collections.visitsTable.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-2 py-4 text-zinc-500">
                      No orders on this date.
                    </td>
                  </tr>
                ) : (
                  report.collections.visitsTable.map((row) => (
                    <tr key={row.id}>
                      <td className="px-2 py-2 font-medium text-zinc-100">
                        {row.customerName}
                      </td>
                      <td className="px-2 py-2">
                        {formatPhpFromCents(row.chargesCents)}
                      </td>
                      <td className="px-2 py-2">
                        {formatPhpFromCents(row.paidCents)}
                      </td>
                      <td className="px-2 py-2">
                        {row.balanceCents > 0 ? (
                          <span className="text-red-300">
                            {formatPhpFromCents(row.balanceCents)}
                          </span>
                        ) : (
                          formatPhpFromCents(0)
                        )}
                      </td>
                      <td className="px-2 py-2">
                        {row.collectedTodayCents > 0
                          ? formatPhpFromCents(row.collectedTodayCents)
                          : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </ScrollableTable>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h4 className="text-xs font-medium text-zinc-300">Payments received</h4>
          <ScrollableTable maxHeight="max-h-64" className="mt-3">
            <table className="w-full text-[11px]">
              <thead className="bg-white/5 text-left text-[10px] text-zinc-500">
                <tr>
                  <th className="px-2 py-2">Time</th>
                  <th className="px-2 py-2">Customer</th>
                  <th className="px-2 py-2">Method</th>
                  <th className="px-2 py-2">Cashier</th>
                  <th className="px-2 py-2">Amount</th>
                  <th className="px-2 py-2">Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {report.collections.paymentsReceived.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-2 py-4 text-zinc-500">
                      No payments recorded on this date.
                    </td>
                  </tr>
                ) : (
                  report.collections.paymentsReceived.map((p) => (
                    <tr key={`${p.orderId}-${p.time}`}>
                      <td className="px-2 py-2 text-zinc-400">
                        {formatOrderWhen(p.time)}
                      </td>
                      <td className="px-2 py-2">{p.customerName}</td>
                      <td className="px-2 py-2">{p.method}</td>
                      <td className="px-2 py-2 text-zinc-400">
                        {p.cashierName ?? "—"}
                      </td>
                      <td className="px-2 py-2 font-medium text-brand-cyan/80">
                        {formatPhpFromCents(p.amountCents)}
                      </td>
                      <td className="px-2 py-2">
                        <Link
                          href={`/orders/receipt/${p.orderId}`}
                          target="_blank"
                          className="text-zinc-400 underline"
                        >
                          {p.reference}
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </ScrollableTable>
        </div>
      </section>
    </div>
  );
}
