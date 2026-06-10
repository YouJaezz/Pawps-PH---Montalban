"use client";

import { useActionState } from "react";

import {
  clockIn,
  clockOut,
  type AttendanceActionResult,
} from "@/app/attendance/actions";
import { ScrollableTable } from "@/components/ScrollableTable";
import { formatDuration } from "@/lib/time-duration";

function Banner(props: { state: AttendanceActionResult | null }) {
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

function fmtWhen(d: Date) {
  return new Date(d).toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function AttendancePanel(props: {
  adminView: boolean;
  monthLabel: string;
  monthMinutes: number;
  openEntry: { id: number; clockInAt: Date } | null;
  monthEntries: Array<{
    id: number;
    userId: number;
    clockInAt: Date;
    clockOutAt: Date | null;
    minutes: number;
    employeeName: string;
  }>;
  teamTotals: Array<{
    userId: number;
    name: string;
    minutes: number;
    entryCount: number;
    hourlyRateCents: number;
  }>;
}) {
  const [inState, inAction, inPending] = useActionState<
    AttendanceActionResult | null,
    FormData
  >(clockIn, null);
  const [outState, outAction, outPending] = useActionState<
    AttendanceActionResult | null,
    FormData
  >(clockOut, null);

  const feedback = inState ?? outState;
  const clockedIn = !!props.openEntry;

  return (
    <div className="space-y-6">
      <Banner state={feedback} />

      <div className="rounded-xl border border-[#e8a44a]/30 bg-gradient-to-br from-[#e8a44a]/10 to-transparent p-5">
        <div className="text-xs uppercase tracking-wide text-[#e8a44a]">
          {props.monthLabel} · your total
        </div>
        <div className="mt-1 text-3xl font-bold text-zinc-50">
          {formatDuration(props.monthMinutes)}
        </div>
        <div className="mt-1 text-xs text-zinc-400">
          {props.monthEntries.filter((e) => e.clockOutAt).length} completed shift(s)
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="text-sm font-medium text-zinc-100">Time clock</div>
        {clockedIn ? (
          <>
            <p className="mt-2 text-xs text-emerald-300">
              Clocked in since {fmtWhen(props.openEntry!.clockInAt)}
            </p>
            <form action={outAction} className="mt-3">
              <button
                type="submit"
                disabled={outPending}
                className="rounded-lg bg-red-500/20 px-4 py-2 text-sm font-medium text-red-200 ring-1 ring-red-500/40 hover:bg-red-500/30 disabled:opacity-50"
              >
                {outPending ? "Clocking out…" : "Time out"}
              </button>
            </form>
          </>
        ) : (
          <form action={inAction} className="mt-3">
            <button
              type="submit"
              disabled={inPending}
              className="rounded-lg bg-emerald-500/20 px-4 py-2 text-sm font-medium text-emerald-200 ring-1 ring-emerald-500/40 hover:bg-emerald-500/30 disabled:opacity-50"
            >
              {inPending ? "Clocking in…" : "Time in"}
            </button>
          </form>
        )}
      </div>

      {props.adminView && props.teamTotals.length > 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm font-medium text-zinc-100">Team this month</div>
          <ScrollableTable maxHeight="max-h-64" className="mt-3">
            <table className="w-full text-xs">
              <thead className="bg-white/5 text-left text-[10px] text-zinc-500">
                <tr>
                  <th className="px-3 py-2">Employee</th>
                  <th className="px-3 py-2">Hours</th>
                  <th className="px-3 py-2">Shifts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {props.teamTotals.map((t) => (
                  <tr key={t.userId}>
                    <td className="px-3 py-2 text-zinc-200">{t.name}</td>
                    <td className="px-3 py-2">{formatDuration(t.minutes)}</td>
                    <td className="px-3 py-2 text-zinc-400">{t.entryCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollableTable>
        </div>
      ) : null}

      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="text-sm font-medium text-zinc-100">
          {props.adminView ? "All time entries" : "Your shifts"} · {props.monthLabel}
        </div>
        <ScrollableTable maxHeight="max-h-[min(50vh,420px)]" className="mt-3">
          <table className="w-full text-xs">
            <thead className="bg-white/5 text-left text-[10px] text-zinc-500">
              <tr>
                {props.adminView ? <th className="px-3 py-2">Employee</th> : null}
                <th className="px-3 py-2">Time in</th>
                <th className="px-3 py-2">Time out</th>
                <th className="px-3 py-2">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {props.monthEntries.length === 0 ? (
                <tr>
                  <td
                    colSpan={props.adminView ? 4 : 3}
                    className="px-3 py-4 text-zinc-500"
                  >
                    No entries this month yet.
                  </td>
                </tr>
              ) : (
                props.monthEntries.map((e) => (
                  <tr key={e.id}>
                    {props.adminView ? (
                      <td className="px-3 py-2 text-zinc-300">{e.employeeName}</td>
                    ) : null}
                    <td className="px-3 py-2">{fmtWhen(e.clockInAt)}</td>
                    <td className="px-3 py-2">
                      {e.clockOutAt ? fmtWhen(e.clockOutAt) : (
                        <span className="text-emerald-400">On duty</span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-medium">
                      {e.clockOutAt ? formatDuration(e.minutes) : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </ScrollableTable>
      </div>
    </div>
  );
}
