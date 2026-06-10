"use client";

import { useActionState, useState } from "react";

import {
  generatePayrollPayout,
  markPayrollPaid,
  resetPayrollPayout,
  updateEmployeeHourlyRate,
  type PayrollActionResult,
} from "@/app/payroll/actions";
import { EditModal, modalFieldClass } from "@/components/EditModal";
import { ScrollableTable } from "@/components/ScrollableTable";
import { formatDuration } from "@/lib/time-duration";
import { formatPhpFromCents } from "@/lib/money";

function Banner(props: { state: PayrollActionResult | null }) {
  if (!props.state) return null;
  if (props.state.error) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
        {props.state.error}
      </div>
    );
  }
  if (props.state.ok && props.state.message) {
    return (
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
        {props.state.message}
      </div>
    );
  }
  return null;
}

export function PayrollPanel(props: {
  employees: Array<{
    id: number;
    name: string | null;
    email: string;
    hourlyRateCents: number;
    role: string;
  }>;
  rows: Array<{
    userId: number;
    employeeName: string;
    year: number;
    month: number;
    label: string;
    minutesWorked: number;
    hourlyRateCents: number;
    grossPayCents: number;
    payoutId: number | null;
    status: "Open" | "Projected" | "Accrued" | "Paid";
    canGenerate: boolean;
  }>;
}) {
  const [rateState, rateAction, ratePending] = useActionState<
    PayrollActionResult | null,
    FormData
  >(updateEmployeeHourlyRate, null);
  const [genState, genAction, genPending] = useActionState<
    PayrollActionResult | null,
    FormData
  >(generatePayrollPayout, null);
  const [paidState, paidAction, paidPending] = useActionState<
    PayrollActionResult | null,
    FormData
  >(markPayrollPaid, null);
  const [resetState, resetAction, resetPending] = useActionState<
    PayrollActionResult | null,
    FormData
  >(resetPayrollPayout, null);

  const [rateEditId, setRateEditId] = useState<number | null>(null);
  const feedback = rateState ?? genState ?? paidState ?? resetState;
  const pending = ratePending || genPending || paidPending || resetPending;

  const rateEmployee = props.employees.find((e) => e.id === rateEditId);

  return (
    <div className="space-y-6">
      <Banner state={feedback} />

      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="text-sm font-medium text-zinc-100">Employee hourly rates</div>
        <ScrollableTable maxHeight="max-h-48" className="mt-3">
          <table className="w-full text-xs">
            <thead className="bg-white/5 text-left text-[10px] text-zinc-500">
              <tr>
                <th className="px-3 py-2">Employee</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Hourly rate</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {props.employees.map((e) => (
                <tr key={e.id}>
                  <td className="px-3 py-2 text-zinc-200">{e.name ?? e.email}</td>
                  <td className="px-3 py-2 capitalize text-zinc-500">{e.role}</td>
                  <td className="px-3 py-2">
                    {e.hourlyRateCents > 0
                      ? formatPhpFromCents(e.hourlyRateCents)
                      : "—"}
                    /hr
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => setRateEditId(e.id)}
                      className="text-[10px] text-[#e8a44a] underline"
                    >
                      Edit rate
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollableTable>
      </div>

      <EditModal
        open={rateEditId != null && !!rateEmployee}
        onClose={() => setRateEditId(null)}
        title="Edit hourly rate"
        subtitle={rateEmployee?.name ?? rateEmployee?.email}
      >
        {rateEmployee ? (
          <form action={rateAction} className="space-y-3">
            <input type="hidden" name="userId" value={rateEmployee.id} />
            <label className="block space-y-1">
              <span className="text-[11px] text-zinc-400">Hourly rate (₱)</span>
              <input
                name="hourlyRate"
                inputMode="decimal"
                required
                defaultValue={
                  rateEmployee.hourlyRateCents > 0
                    ? (rateEmployee.hourlyRateCents / 100).toFixed(0)
                    : ""
                }
                className={modalFieldClass}
              />
            </label>
            <button
              type="submit"
              disabled={ratePending}
              className="rounded-lg bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-900"
            >
              {ratePending ? "Saving…" : "Save rate"}
            </button>
          </form>
        ) : null}
      </EditModal>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="text-sm font-medium text-zinc-100">Monthly payroll</div>
        <p className="mt-1 text-[11px] text-zinc-500">
          Based on Time In/Out hours × hourly rate. Lock month after it ends, then mark
          paid when disbursed.
        </p>
        <ScrollableTable maxHeight="max-h-[min(60vh,480px)]" className="mt-3">
          <table className="w-full text-xs">
            <thead className="bg-white/5 text-left text-[10px] text-zinc-500">
              <tr>
                <th className="px-3 py-2">Employee</th>
                <th className="px-3 py-2">Period</th>
                <th className="px-3 py-2">Hours</th>
                <th className="px-3 py-2">Gross pay</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {props.rows.map((row) => (
                <tr key={`${row.userId}-${row.year}-${row.month}`}>
                  <td className="px-3 py-2 text-zinc-200">{row.employeeName}</td>
                  <td className="px-3 py-2">{row.label}</td>
                  <td className="px-3 py-2">{formatDuration(row.minutesWorked)}</td>
                  <td className="px-3 py-2 font-medium text-emerald-300">
                    {formatPhpFromCents(row.grossPayCents)}
                  </td>
                  <td className="px-3 py-2 text-zinc-400">{row.status}</td>
                  <td className="px-3 py-2">
                    {row.canGenerate ? (
                      <form action={genAction} className="inline">
                        <input type="hidden" name="userId" value={row.userId} />
                        <input type="hidden" name="year" value={row.year} />
                        <input type="hidden" name="month" value={row.month} />
                        <button
                          type="submit"
                          disabled={pending}
                          className="text-[10px] text-zinc-300 underline disabled:opacity-50"
                        >
                          Lock payroll
                        </button>
                      </form>
                    ) : null}
                    {row.status === "Accrued" && row.payoutId ? (
                      <div className="flex flex-col gap-0.5">
                        <form action={paidAction}>
                          <input type="hidden" name="payoutId" value={row.payoutId} />
                          <button
                            type="submit"
                            disabled={pending}
                            className="text-[10px] text-emerald-300 underline"
                          >
                            Mark paid
                          </button>
                        </form>
                        <form action={resetAction}>
                          <input type="hidden" name="payoutId" value={row.payoutId} />
                          <button
                            type="submit"
                            disabled={pending}
                            className="text-[10px] text-red-300/80 underline"
                          >
                            Reset
                          </button>
                        </form>
                      </div>
                    ) : null}
                    {row.status === "Paid" && row.payoutId ? (
                      <form action={resetAction}>
                        <input type="hidden" name="payoutId" value={row.payoutId} />
                        <button
                          type="submit"
                          disabled={pending}
                          className="text-[10px] text-red-300/80 underline"
                        >
                          Reset
                        </button>
                      </form>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollableTable>
      </div>
    </div>
  );
}
