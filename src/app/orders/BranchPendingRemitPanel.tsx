"use client";

import { useActionState } from "react";

import { ActionMessage } from "@/app/shop-cash/ShopCashActionMessage";
import type {
  BranchPendingRemitRow,
  BranchRemittanceLedgerRow,
} from "@/db/queries/branch-remittances";
import { formatPhpFromCents } from "@/lib/money";

import {
  recordBranchRemittance,
  type BranchRemitActionResult,
} from "./branch-remit-actions";

function dateInputValue(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value ?? "1970";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

export function BranchPendingRemitPanel(props: {
  rows: BranchPendingRemitRow[];
  recent: BranchRemittanceLedgerRow[];
  adminMode: boolean;
}) {
  const [state, action, pending] = useActionState<
    BranchRemitActionResult,
    FormData
  >(recordBranchRemittance, {});

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">
            Pending to remit (by branch)
          </h2>
          <p className="mt-1 text-[11px] text-zinc-500">
            Walk-in cash collected − recorded remittances. This helps when
            branches remit days later.
          </p>
        </div>
        <div className="min-w-[260px]">
          <ActionMessage result={state} />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
        {props.rows.map((r) => (
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
                  Last remit: {r.lastRemittedAt ?? "—"}
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
                  Cash collected
                </div>
                <div className="mt-1 text-sm font-medium text-zinc-200">
                  {formatPhpFromCents(r.cashCollectedCents)}
                </div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                <div className="text-[10px] uppercase tracking-wide text-zinc-500">
                  Remitted
                </div>
                <div className="mt-1 text-sm font-medium text-zinc-200">
                  {formatPhpFromCents(r.remittedCents)}
                </div>
              </div>
            </div>

            {props.adminMode ? (
              <form
                action={action}
                className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-4"
              >
                <input type="hidden" name="branchId" value={String(r.branchId)} />
                <label className="block text-[10px] text-zinc-400 sm:col-span-2">
                  Amount remitted (PHP)
                  <input
                    name="amount"
                    inputMode="decimal"
                    placeholder="0"
                    className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100"
                    disabled={pending}
                    required
                  />
                </label>
                <label className="block text-[10px] text-zinc-400">
                  Remit date
                  <input
                    name="remittedAt"
                    type="date"
                    defaultValue={dateInputValue(new Date())}
                    className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100"
                    disabled={pending}
                  />
                </label>
                <button
                  type="submit"
                  className="mt-5 h-[38px] rounded-md bg-brand-blue px-3 text-sm font-medium text-white hover:bg-brand-blue/90 disabled:opacity-60"
                  disabled={pending}
                >
                  Record remit
                </button>
                <label className="block text-[10px] text-zinc-400 sm:col-span-4">
                  Note (optional)
                  <input
                    name="note"
                    placeholder="e.g. via GCash / pickup / deposit slip #"
                    className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100"
                    disabled={pending}
                  />
                </label>
              </form>
            ) : null}
          </div>
        ))}
      </div>

      {props.recent.length ? (
        <div className="mt-5">
          <h3 className="text-xs font-medium text-zinc-200">
            Recent remittances
          </h3>
          <div className="mt-2 overflow-x-auto rounded-xl border border-white/10">
            <table className="min-w-full text-[11px]">
              <thead className="bg-white/5 text-left text-[10px] text-zinc-500">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Branch</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2">Note</th>
                </tr>
              </thead>
              <tbody>
                {props.recent.map((e) => (
                  <tr key={e.id} className="border-t border-white/5">
                    <td className="px-3 py-2 text-zinc-300">
                      {e.remittedAt || "—"}
                    </td>
                    <td className="px-3 py-2 text-zinc-300">{e.branchName}</td>
                    <td className="px-3 py-2 text-right font-medium text-zinc-100">
                      {formatPhpFromCents(e.amountCents)}
                    </td>
                    <td className="px-3 py-2 text-zinc-500">{e.note ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}
