"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { markOrdersCollected } from "@/app/orders/actions";
import type {
  BranchPendingRemitRow,
  PendingRemitOrderRow,
} from "@/db/queries/branch-remittances";
import { formatPhpFromCents } from "@/lib/money";
import { ORDER_STATUS_LABELS } from "@/lib/order-status";

function formatWhen(d: Date | string | null) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function BranchPendingRemitPanel(props: {
  rows: BranchPendingRemitRow[];
  pendingOrders: PendingRemitOrderRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [expandedBranchId, setExpandedBranchId] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const totalPending = props.rows.reduce((s, r) => s + r.pendingRemitCents, 0);

  const ordersByBranch = useMemo(() => {
    const map = new Map<number, PendingRemitOrderRow[]>();
    for (const order of props.pendingOrders) {
      const list = map.get(order.branchId) ?? [];
      list.push(order);
      map.set(order.branchId, list);
    }
    return map;
  }, [props.pendingOrders]);

  const orderById = useMemo(() => {
    const map = new Map<number, PendingRemitOrderRow>();
    for (const order of props.pendingOrders) map.set(order.id, order);
    return map;
  }, [props.pendingOrders]);

  const selectedOrders = useMemo(
    () =>
      [...selected]
        .map((id) => orderById.get(id))
        .filter((o): o is PendingRemitOrderRow => Boolean(o)),
    [selected, orderById],
  );

  const selectedCents = selectedOrders.reduce((s, o) => s + o.amountPaid, 0);

  function toggleOrder(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectBranchOrders(branchId: number, on: boolean) {
    const ids = (ordersByBranch.get(branchId) ?? []).map((o) => o.id);
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  function runCollect(orderIds: number[]) {
    if (orderIds.length === 0) {
      setError("Select at least one order that was remitted.");
      return;
    }
    setError(null);
    setMessage(null);
    const fd = new FormData();
    for (const id of orderIds) fd.append("orderId", String(id));
    startTransition(async () => {
      const result = await markOrdersCollected(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSelected(new Set());
      setMessage(
        `Marked ${result.completedCount} order${result.completedCount === 1 ? "" : "s"} collected · ${formatPhpFromCents(result.collectedCents)} remitted.`,
      );
      router.refresh();
    });
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">
            Pending to remit (by branch)
          </h2>
          <p className="mt-1 text-[11px] text-zinc-500">
            Open a branch, tick the orders the collector / accountant actually
            received, then mark them Collected. Partial remits are supported —
            leave uncollected orders unchecked.
          </p>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wide text-zinc-500">
            All branches pending
          </div>
          <div className="mt-1 text-lg font-semibold text-amber-100">
            {formatPhpFromCents(totalPending)}
          </div>
        </div>
      </div>

      {selected.size > 0 ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-cyan/25 bg-brand-blue/10 px-3 py-2.5">
          <div className="text-xs text-zinc-300">
            <span className="font-medium text-brand-cyan/90">
              {selected.size} selected
            </span>
            <span className="text-zinc-500"> · </span>
            <span className="font-semibold text-zinc-100">
              {formatPhpFromCents(selectedCents)}
            </span>
            <span className="text-zinc-500"> to mark collected</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => setSelected(new Set())}
              className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] text-zinc-300 hover:bg-white/5 disabled:opacity-50"
            >
              Clear
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => runCollect([...selected])}
              className="rounded-lg border border-brand-cyan/40 bg-brand-blue/20 px-3 py-1.5 text-[11px] font-medium text-brand-cyan/90 hover:bg-brand-blue/30 disabled:opacity-50"
            >
              {pending ? "Collecting…" : "Mark selected collected"}
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="mt-3 rounded-lg border border-brand-cyan/30 bg-brand-blue/10 px-3 py-2 text-xs text-brand-cyan/90">
          {message}
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {props.rows.map((r) => {
          const branchOrders = ordersByBranch.get(r.branchId) ?? [];
          const expanded = expandedBranchId === r.branchId;
          const branchSelectedCount = branchOrders.filter((o) =>
            selected.has(o.id),
          ).length;
          const allSelected =
            branchOrders.length > 0 &&
            branchSelectedCount === branchOrders.length;

          return (
            <div
              key={r.branchId}
              className="rounded-xl border border-white/10 bg-black/20 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-zinc-100">
                    {r.branchName}
                  </div>
                  <div className="mt-0.5 text-[10px] text-zinc-500">
                    {r.pendingOrderCount} open order
                    {r.pendingOrderCount === 1 ? "" : "s"} with payment
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wide text-zinc-500">
                    Pending to remit
                  </div>
                  <div className="mt-1 text-lg font-semibold text-amber-100">
                    {formatPhpFromCents(r.pendingRemitCents)}
                  </div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-zinc-500">
                    Already remitted
                  </div>
                  <div className="mt-1 text-sm font-medium text-zinc-200">
                    {formatPhpFromCents(r.remittedCents)}
                  </div>
                  <div className="mt-0.5 text-[10px] text-zinc-600">
                    Completed orders
                  </div>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-zinc-500">
                    All collections
                  </div>
                  <div className="mt-1 text-sm font-medium text-zinc-200">
                    {formatPhpFromCents(r.cashCollectedCents)}
                  </div>
                  <div className="mt-0.5 text-[10px] text-zinc-600">
                    Walk-in + online
                  </div>
                </div>
              </div>

              {r.pendingOrderCount > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedBranchId(expanded ? null : r.branchId)
                    }
                    className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] text-zinc-300 hover:bg-white/5"
                  >
                    {expanded ? "Hide orders" : "Select orders"}
                    {branchSelectedCount > 0
                      ? ` (${branchSelectedCount})`
                      : ""}
                  </button>
                  <button
                    type="button"
                    disabled={pending || branchOrders.length === 0}
                    onClick={() => {
                      if (
                        !window.confirm(
                          `Mark all ${branchOrders.length} pending order${branchOrders.length === 1 ? "" : "s"} for ${r.branchName} as collected (${formatPhpFromCents(r.pendingRemitCents)})?`,
                        )
                      ) {
                        return;
                      }
                      runCollect(branchOrders.map((o) => o.id));
                    }}
                    className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] font-medium text-amber-100 hover:bg-amber-500/15 disabled:opacity-50"
                  >
                    Collect all
                  </button>
                </div>
              ) : (
                <p className="mt-3 text-[11px] text-zinc-600">
                  Nothing pending for this branch.
                </p>
              )}

              {expanded && branchOrders.length > 0 ? (
                <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
                  <label className="flex items-center gap-2 text-[11px] text-zinc-400">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={(e) =>
                        selectBranchOrders(r.branchId, e.target.checked)
                      }
                      className="size-3.5 accent-white"
                    />
                    Select all for {r.branchName}
                  </label>
                  <ul className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
                    {branchOrders.map((order) => {
                      const checked = selected.has(order.id);
                      return (
                        <li key={order.id}>
                          <label
                            className={`flex cursor-pointer items-start gap-2 rounded-lg border px-2.5 py-2 text-[11px] ${
                              checked
                                ? "border-brand-cyan/30 bg-brand-blue/10"
                                : "border-white/10 bg-black/20 hover:bg-white/5"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleOrder(order.id)}
                              className="mt-0.5 size-3.5 shrink-0 accent-white"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                                <span className="font-medium text-zinc-100">
                                  #{order.id} · {order.customerName}
                                </span>
                                <span className="font-semibold text-amber-100">
                                  {formatPhpFromCents(order.amountPaid)}
                                </span>
                              </span>
                              <span className="mt-0.5 block text-zinc-500">
                                {order.storeType} ·{" "}
                                {ORDER_STATUS_LABELS[order.orderStatus] ??
                                  order.orderStatus}{" "}
                                · {formatWhen(order.createdAt)}
                                {order.cashierName
                                  ? ` · ${order.cashierName}`
                                  : ""}
                              </span>
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                  {branchSelectedCount > 0 ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        runCollect(
                          branchOrders
                            .filter((o) => selected.has(o.id))
                            .map((o) => o.id),
                        )
                      }
                      className="w-full rounded-lg border border-brand-cyan/40 bg-brand-blue/20 px-3 py-2 text-[11px] font-medium text-brand-cyan/90 hover:bg-brand-blue/30 disabled:opacity-50"
                    >
                      {pending
                        ? "Collecting…"
                        : `Mark ${branchSelectedCount} collected · ${formatPhpFromCents(
                            branchOrders
                              .filter((o) => selected.has(o.id))
                              .reduce((s, o) => s + o.amountPaid, 0),
                          )}`}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
