"use client";

import { useActionState } from "react";

import {
  clockIn,
  clockOut,
  type AttendanceActionResult,
} from "@/app/attendance/actions";
import { LiveShiftTimer } from "@/components/LiveShiftTimer";
import { ScrollableTable } from "@/components/ScrollableTable";
import { formatDuration } from "@/lib/time-duration";

function Banner(props: { state: AttendanceActionResult | null }) {
  if (!props.state) return null;
  if (props.state.error) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700">
        {props.state.error}
      </div>
    );
  }
  if (props.state.ok && props.state.message) {
    return (
      <div className="rounded-lg border border-brand-blue/30 bg-brand-blue/10 px-3 py-2 text-xs text-brand-cyan/80">
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
  openClockInAt: string | null;
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
  activeShifts: Array<{
    entryId: number;
    userId: number;
    clockInAt: string;
    name: string;
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
  const liveClockIn = props.openClockInAt;

  return (
    <div className="space-y-6">
      <Banner state={feedback} />

      {clockedIn && liveClockIn ? (
        <div className="rounded-xl border border-brand-cyan/40 bg-gradient-to-br from-brand-blue/15 to-transparent p-5">
          <div className="text-xs uppercase tracking-wide text-brand-cyan">
            Live shift · counting now
          </div>
          <div className="mt-2">
            <LiveShiftTimer clockInAt={liveClockIn} size="lg" />
          </div>
          <p className="mt-2 text-xs text-zinc-600">
            Started {fmtWhen(props.openEntry!.clockInAt)} · updates every second
          </p>
        </div>
      ) : null}

      <div className="rounded-xl border border-brand-blue/30 bg-gradient-to-br from-brand-blue/10 to-transparent p-5">
        <div className="text-xs uppercase tracking-wide text-brand-blue">
          {props.monthLabel} · your total
        </div>
        <div className="mt-1 text-3xl font-bold text-zinc-900">
          {formatDuration(props.monthMinutes)}
        </div>
        <div className="mt-1 text-xs text-zinc-600">
          {props.monthEntries.filter((e) => e.clockOutAt).length} completed shift(s)
          {clockedIn && liveClockIn ? (
            <span className="text-brand-cyan">
              {" "}
              · current shift not included until you clock out
            </span>
          ) : null}
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
        <div className="text-sm font-medium text-zinc-800">Time clock</div>
        {clockedIn ? (
          <>
            <p className="mt-2 text-xs text-brand-cyan/80">
              Clocked in since {fmtWhen(props.openEntry!.clockInAt)}
            </p>
            {liveClockIn ? (
              <div className="mt-2">
                <LiveShiftTimer clockInAt={liveClockIn} />
              </div>
            ) : null}
            <form action={outAction} className="mt-3">
              <button
                type="submit"
                disabled={outPending}
                className="rounded-lg bg-red-500/20 px-4 py-2 text-sm font-medium text-red-800 ring-1 ring-red-500/40 hover:bg-red-500/30 disabled:opacity-50"
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
              className="rounded-lg bg-brand-blue/20 px-4 py-2 text-sm font-medium text-brand-cyan/70 ring-1 ring-brand-blue/40 hover:bg-brand-blue/30 disabled:opacity-50"
            >
              {inPending ? "Clocking in…" : "Time in"}
            </button>
          </form>
        )}
      </div>

      {props.adminView && props.activeShifts.length > 0 ? (
        <div className="rounded-xl border border-brand-blue/20 bg-brand-blue/5 p-4">
          <div className="text-sm font-medium text-brand-cyan/90">On duty now</div>
          <p className="mt-1 text-[10px] text-brand-cyan/70/70">
            Live hours for everyone currently clocked in.
          </p>
          <ul className="mt-3 space-y-2">
            {props.activeShifts.map((s) => (
              <li
                key={s.entryId}
                className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2"
              >
                <span className="text-sm text-zinc-800">{s.name}</span>
                <LiveShiftTimer clockInAt={s.clockInAt} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {props.adminView && props.teamTotals.length > 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
          <div className="text-sm font-medium text-zinc-800">Team this month</div>
          <ScrollableTable maxHeight="max-h-64" className="mt-3">
            <table className="w-full text-xs">
              <thead className="bg-zinc-50 text-left text-[10px] text-zinc-600">
                <tr>
                  <th className="px-3 py-2">Employee</th>
                  <th className="px-3 py-2">Hours</th>
                  <th className="px-3 py-2">Shifts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {props.teamTotals.map((t) => (
                  <tr key={t.userId}>
                    <td className="px-3 py-2 text-zinc-800">{t.name}</td>
                    <td className="px-3 py-2">{formatDuration(t.minutes)}</td>
                    <td className="px-3 py-2 text-zinc-600">{t.entryCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollableTable>
        </div>
      ) : null}

      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
        <div className="text-sm font-medium text-zinc-800">
          {props.adminView ? "All time entries" : "Your shifts"} · {props.monthLabel}
        </div>
        <ScrollableTable maxHeight="max-h-[min(50vh,420px)]" className="mt-3">
          <table className="w-full text-xs">
            <thead className="bg-zinc-50 text-left text-[10px] text-zinc-600">
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
                    className="px-3 py-4 text-zinc-600"
                  >
                    No entries this month yet.
                  </td>
                </tr>
              ) : (
                props.monthEntries.map((e) => (
                  <tr key={e.id}>
                    {props.adminView ? (
                      <td className="px-3 py-2 text-zinc-700">{e.employeeName}</td>
                    ) : null}
                    <td className="px-3 py-2">{fmtWhen(e.clockInAt)}</td>
                    <td className="px-3 py-2">
                      {e.clockOutAt ? (
                        fmtWhen(e.clockOutAt)
                      ) : (
                        <span className="inline-flex items-center gap-2 text-brand-cyan">
                          On duty
                          <LiveShiftTimer
                            clockInAt={e.clockInAt.toISOString()}
                            showPulse={false}
                            size="sm"
                          />
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-medium">
                      {e.clockOutAt ? (
                        formatDuration(e.minutes)
                      ) : (
                        <LiveShiftTimer
                          clockInAt={e.clockInAt.toISOString()}
                          showPulse={false}
                          size="sm"
                        />
                      )}
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
