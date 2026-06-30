"use client";

import { useActionState } from "react";

import {
  recordInvestorFundEntry,
  type InvestorFundsActionResult,
} from "@/app/investor-funds/actions";
import type { InvestorFundsRow } from "@/db/queries/investor-funds";
import { INVESTOR_FUND_TYPES } from "@/db/schema";
import { formatPhpFromCents } from "@/lib/money";
import { shopCashDateInputValue } from "@/lib/shop-cash";

const inputClass =
  "w-full rounded-lg border border-white/10 bg-black/30 px-2.5 py-2 text-sm text-zinc-50 outline-none focus:border-white/20";

function typeLabel(type: string) {
  switch (type) {
    case "contribution":
      return "Contribution (money in)";
    case "leftover":
      return "Leftover returned to pool (money in)";
    case "return":
      return "Returned to investor (money out)";
    default:
      return type;
  }
}

function ResultBanner(props: { state: InvestorFundsActionResult | null }) {
  if (!props.state) return null;
  if (props.state.error) {
    return (
      <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-300">
        {props.state.error}
      </div>
    );
  }
  if (props.state.ok && props.state.message) {
    return (
      <div className="mt-3 rounded-lg border border-brand-cyan/30 bg-brand-blue/10 px-3 py-2 text-[11px] text-brand-cyan/80">
        {props.state.message}
      </div>
    );
  }
  return null;
}

export function InvestorFundsPanel(props: {
  allTime: { inCents: number; outCents: number; balanceCents: number };
  thisMonth: { inCents: number; outCents: number; netCents: number };
  entries: InvestorFundsRow[];
}) {
  const [state, action, pending] = useActionState(recordInvestorFundEntry, null);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-brand-blue/30 bg-brand-blue/10 px-4 py-3">
          <div className="text-[10px] font-medium uppercase tracking-wide text-brand-blue/80">
            Investor funds balance
          </div>
          <div className="mt-1 text-lg font-semibold text-zinc-50">
            {formatPhpFromCents(props.allTime.balanceCents)}
          </div>
          <div className="mt-0.5 text-[10px] text-zinc-500">
            Total in − total out
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
          <div className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
            Total in (all time)
          </div>
          <div className="mt-1 text-lg font-semibold text-zinc-100">
            {formatPhpFromCents(props.allTime.inCents)}
          </div>
          <div className="mt-0.5 text-[10px] text-zinc-600">
            Contributions + leftovers
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
          <div className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
            Total out (all time)
          </div>
          <div className="mt-1 text-lg font-semibold text-zinc-100">
            {formatPhpFromCents(props.allTime.outCents)}
          </div>
          <div className="mt-0.5 text-[10px] text-zinc-600">
            Returned to investor
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
          <div className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
            Net this month
          </div>
          <div className="mt-1 text-lg font-semibold text-zinc-100">
            {formatPhpFromCents(props.thisMonth.netCents)}
          </div>
          <div className="mt-0.5 text-[10px] text-zinc-600">
            In − out this month
          </div>
        </div>
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="text-sm font-semibold text-zinc-100">Add entry</h2>
        <p className="mt-1 text-[11px] text-zinc-500">
          Log investor contributions, leftover money returned to the pool, or money
          returned back to an investor.
        </p>

        <form action={action} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-zinc-400">
            Investor name
            <input
              name="investorName"
              required
              className={inputClass}
              placeholder="e.g. John Doe"
            />
          </label>
          <label className="block text-xs text-zinc-400">
            Amount (₱)
            <input
              name="amount"
              type="number"
              min="0"
              step="0.01"
              required
              className={inputClass}
            />
          </label>
          <label className="block text-xs text-zinc-400">
            Type
            <select name="type" className={inputClass} defaultValue="contribution">
              {INVESTOR_FUND_TYPES.map((t) => (
                <option key={t} value={t}>
                  {typeLabel(t)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-zinc-400">
            Date
            <input
              name="date"
              type="date"
              required
              defaultValue={shopCashDateInputValue()}
              className={inputClass}
            />
          </label>
          <label className="block text-xs text-zinc-400 sm:col-span-2">
            Notes (optional)
            <input name="notes" className={inputClass} />
          </label>

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-xl bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue/90 disabled:opacity-50"
            >
              {pending ? "Saving…" : "Record entry"}
            </button>
            <ResultBanner state={state} />
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="text-sm font-semibold text-zinc-100">Ledger</h2>
        <p className="mt-1 text-[11px] text-zinc-500">
          Recent entries · {props.entries.length} shown
        </p>

        {props.entries.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">No entries yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[640px] text-xs">
              <thead className="bg-white/5 text-left text-[10px] text-zinc-500">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Investor</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2">Notes</th>
                </tr>
              </thead>
              <tbody>
                {props.entries.map((e) => {
                  const date = new Date(e.date).toLocaleDateString("en-PH", {
                    timeZone: "Asia/Manila",
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  });
                  const isOut = e.type === "return";
                  return (
                    <tr key={e.id} className="border-t border-white/5">
                      <td className="px-3 py-2.5 text-zinc-400">{date}</td>
                      <td className="px-3 py-2.5 text-zinc-200">{e.investorName}</td>
                      <td className="px-3 py-2.5 text-zinc-300">{typeLabel(e.type)}</td>
                      <td
                        className={`px-3 py-2.5 text-right font-semibold ${
                          isOut ? "text-red-300/90" : "text-emerald-300/90"
                        }`}
                      >
                        {isOut ? "−" : "+"}
                        {formatPhpFromCents(e.amountCents)}
                      </td>
                      <td className="px-3 py-2.5 text-zinc-500">{e.notes ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

