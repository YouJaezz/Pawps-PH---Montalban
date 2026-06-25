"use client";

import { useMemo, useState } from "react";

import { PayrollPanel } from "@/app/payroll/PayrollPanel";
import { PayrollPayModal } from "@/app/payroll/PayrollPayModal";
import { formatPhpFromCents } from "@/lib/money";
import { formatDuration } from "@/lib/time-duration";
import {
  payrollRowToPayModal,
  type PayrollPayModalRow,
} from "@/lib/payroll-pay-modal";
import type { PaySchedule } from "@/lib/payroll-period";

type PayrollRow = {
  userId: number;
  employeeName: string;
  year: number;
  month: number;
  half: 0 | 1 | 2;
  periodDay: number;
  paySchedule: PaySchedule;
  label: string;
  minutesWorked: number;
  hourlyRateCents: number;
  grossPayCents: number;
  payoutId: number | null;
  status: "Open" | "Projected" | "Accrued" | "Paid";
  canGenerate: boolean;
  paidAt: string | null;
  paymentMethod: string | null;
  paymentReference: string | null;
  paymentNotes: string | null;
};

function PaymentSummaryCards(props: {
  awaitingCount: number;
  awaitingTotalCents: number;
  paidCount: number;
  paidTotalCents: number;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
        <div className="text-[10px] font-medium uppercase tracking-wide text-amber-200/70">
          Awaiting payment
        </div>
        <div className="mt-1 text-lg font-semibold text-amber-100">
          {formatPhpFromCents(props.awaitingTotalCents)}
        </div>
        <div className="mt-0.5 text-[10px] text-amber-200/60">
          {props.awaitingCount} locked period{props.awaitingCount === 1 ? "" : "s"}
        </div>
      </div>
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
        <div className="text-[10px] font-medium uppercase tracking-wide text-emerald-200/70">
          Recorded as paid
        </div>
        <div className="mt-1 text-lg font-semibold text-emerald-100">
          {formatPhpFromCents(props.paidTotalCents)}
        </div>
        <div className="mt-0.5 text-[10px] text-emerald-200/60">
          {props.paidCount} payment{props.paidCount === 1 ? "" : "s"} in view
        </div>
      </div>
    </div>
  );
}

export function PayrollWorkspace(props: {
  employees: Array<{
    id: number;
    name: string | null;
    email: string;
    hourlyRateCents: number;
    paySchedule: PaySchedule;
    role: string;
  }>;
  semiMonthlyRows: PayrollRow[];
  dailyRows: PayrollRow[];
  paymentSummary: {
    awaitingCount: number;
    awaitingTotalCents: number;
    paidCount: number;
    paidTotalCents: number;
  };
  reportYear?: number;
  reportMonth?: number;
}) {
  const [payRow, setPayRow] = useState<PayrollPayModalRow | null>(null);

  const allRows = useMemo(
    () => [...props.semiMonthlyRows, ...props.dailyRows],
    [props.semiMonthlyRows, props.dailyRows],
  );

  const payableRows = useMemo(
    () =>
      allRows
        .map((row) => ({ row, pay: payrollRowToPayModal(row) }))
        .filter((entry): entry is { row: PayrollRow; pay: PayrollPayModalRow } =>
          entry.pay != null,
        ),
    [allRows],
  );

  const awaitingRows = payableRows.filter((e) => e.row.status === "Accrued");
  const readyRows = payableRows.filter((e) => e.row.canGenerate);

  return (
    <>
      <div className="rounded-xl border border-brand-cyan/25 bg-brand-blue/10 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-zinc-100">Pay employees</div>
            <p className="mt-1 max-w-xl text-[11px] text-zinc-400">
              Click <span className="font-medium text-emerald-300">Pay now</span>{" "}
              when you have disbursed salary. Completed periods with hours appear
              below — no need to hunt through the full payroll tables.
            </p>
          </div>
        </div>

        <div className="mt-4">
          <PaymentSummaryCards {...props.paymentSummary} />
        </div>

        {payableRows.length === 0 ? (
          <div className="mt-4 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-[11px] text-zinc-400">
            <p className="font-medium text-zinc-300">Nothing ready to pay yet.</p>
            <ul className="mt-2 list-inside list-disc space-y-1">
              <li>Employees need an hourly rate set under Pay settings.</li>
              <li>They must have Time In/Out hours for a finished period.</li>
              <li>
                Semi-monthly: period must end (after the 15th or end of month).
                Daily: the shift day must be over.
              </li>
            </ul>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {awaitingRows.length > 0 ? (
              <div>
                <div className="text-[10px] font-medium uppercase tracking-wide text-amber-200/70">
                  Locked — pay these now
                </div>
                <div className="mt-2 space-y-2">
                  {awaitingRows.map(({ row, pay }) => (
                    <div
                      key={`await-${row.userId}-${row.year}-${row.month}-${row.half}-${row.periodDay}`}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5"
                    >
                      <div className="min-w-0 text-xs">
                        <div className="font-medium text-zinc-100">
                          {row.employeeName}
                        </div>
                        <div className="text-zinc-400">
                          {row.label} · {formatDuration(row.minutesWorked)}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-brand-cyan/90">
                          {formatPhpFromCents(row.grossPayCents)}
                        </span>
                        <button
                          type="button"
                          onClick={() => setPayRow(pay)}
                          className="rounded-lg bg-emerald-400 px-4 py-2 text-xs font-semibold text-zinc-900"
                        >
                          Pay now
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {readyRows.length > 0 ? (
              <div>
                <div className="text-[10px] font-medium uppercase tracking-wide text-brand-cyan/70">
                  Ready to pay (lock + record in one step)
                </div>
                <div className="mt-2 space-y-2">
                  {readyRows.slice(0, 8).map(({ row, pay }) => (
                    <div
                      key={`ready-${row.userId}-${row.year}-${row.month}-${row.half}-${row.periodDay}`}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5"
                    >
                      <div className="min-w-0 text-xs">
                        <div className="font-medium text-zinc-100">
                          {row.employeeName}
                        </div>
                        <div className="text-zinc-400">
                          {row.label} · {formatDuration(row.minutesWorked)}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-brand-cyan/90">
                          {formatPhpFromCents(row.grossPayCents)}
                        </span>
                        <button
                          type="button"
                          onClick={() => setPayRow(pay)}
                          className="rounded-lg bg-emerald-400 px-4 py-2 text-xs font-semibold text-zinc-900"
                        >
                          Pay now
                        </button>
                      </div>
                    </div>
                  ))}
                  {readyRows.length > 8 ? (
                    <p className="text-[10px] text-zinc-500">
                      +{readyRows.length - 8} more in the payroll tables below
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      <PayrollPayModal row={payRow} onClose={() => setPayRow(null)} />

      <PayrollPanel
        employees={props.employees}
        semiMonthlyRows={props.semiMonthlyRows}
        dailyRows={props.dailyRows}
        reportYear={props.reportYear}
        reportMonth={props.reportMonth}
        onPayRow={setPayRow}
      />
    </>
  );
}
