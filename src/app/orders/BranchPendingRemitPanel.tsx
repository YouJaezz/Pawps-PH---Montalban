import { formatPhpFromCents } from "@/lib/money";
import type { BranchPendingRemitRow } from "@/db/queries/branch-remittances";

export function BranchPendingRemitPanel(props: {
  rows: BranchPendingRemitRow[];
}) {
  const totalPending = props.rows.reduce((s, r) => s + r.pendingRemitCents, 0);

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">
            Pending to remit (by branch)
          </h2>
          <p className="mt-1 text-[11px] text-zinc-500">
            Walk-in and online collections on orders not yet marked Completed.
            When status is Completed, money is treated as already remitted /
            received by accountant.
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

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
          </div>
        ))}
      </div>
    </section>
  );
}
