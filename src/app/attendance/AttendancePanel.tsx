"use client";

import { useActionState } from "react";

import {
  clockIn,
  clockOut,
  type AttendanceActionResult,
} from "@/app/attendance/actions";
import { AttendanceSettingsPanel } from "@/app/attendance/AttendanceSettingsPanel";
import { TimeEntryEditButton } from "@/app/attendance/TimeEntryEditButton";
import { LiveShiftTimer } from "@/components/LiveShiftTimer";
import { ScrollableTable } from "@/components/ScrollableTable";
import type { AttendanceSettings } from "@/db/queries/attendance-settings";
import { formatCutoffLabel, nextAttendanceUnlockLabel } from "@/lib/attendance-cutoff";
import { PH_TIMEZONE } from "@/lib/ph-time";
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
    timeZone: PH_TIMEZONE,
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
  settings: AttendanceSettings;
  staffLocked: boolean;
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
  const cutoffLabel = formatCutoffLabel(props.settings);
  const unlockLabel = nextAttendanceUnlockLabel();

  return (
    <div className="space-y-6">
      {props.adminView ? (
        <AttendanceSettingsPanel settings={props.settings} />
      ) : null}

      <Banner state={feedback} />

      {props.staffLocked ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <div className="font-medium">Time clock closed for today</div>
          <p className="mt-1 text-xs text-amber-100/80">
            Everyone was auto timed-out at {cutoffLabel} (Philippines time). Time
            in and time out will be available again from {unlockLabel}.
          </p>
        </div>
      ) : null}

      {clockedIn && liveClockIn ? (
        <div className="rounded-xl border border-brand-cyan/40 bg-gradient-to-br from-brand-blue/15 to-transparent p-5">
          <div className="text-xs uppercase tracking-wide text-brand-cyan">
            Live shift · counting now
          </div>
          <div className="mt-2">
            <LiveShiftTimer clockInAt={liveClockIn} size="lg" />
          </div>
          <p className="mt-2 text-xs text-zinc-400">
            Started {fmtWhen(props.openEntry!.clockInAt)} · updates every second
          </p>
        </div>
      ) : null}

      <div className="rounded-xl border border-brand-blue/30 bg-gradient-to-br from-brand-blue/10 to-transparent p-5">
        <div className="text-xs uppercase tracking-wide text-brand-blue">
          {props.monthLabel} · your total
        </div>
        <div className="mt-1 text-3xl font-bold text-zinc-50">
          {formatDuration(props.monthMinutes)}
        </div>
        <div className="mt-1 text-xs text-zinc-400">
          {props.monthEntries.filter((e) => e.clockOutAt).length} completed shift(s)
          {clockedIn && liveClockIn ? (
            <span className="text-brand-cyan">
              {" "}
              · current shift not included until you clock out
            </span>
          ) : null}
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="text-sm font-medium text-zinc-100">Time clock</div>
        {props.settings.autoCutoffEnabled ? (
          <p className="mt-1 text-[10px] text-zinc-500">
            Auto time-out daily at {cutoffLabel} PH
            {props.adminView ? " · you can change this above" : ""}
          </p>
        ) : null}
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
                disabled={outPending || props.staffLocked}
                className="rounded-lg bg-red-500/20 px-4 py-2 text-sm font-medium text-red-200 ring-1 ring-red-500/40 hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {outPending ? "Clocking out…" : "Time out"}
              </button>
            </form>
          </>
        ) : (
          <form action={inAction} className="mt-3">
            <button
              type="submit"
              disabled={inPending || props.staffLocked}
              className="rounded-lg bg-brand-blue/20 px-4 py-2 text-sm font-medium text-brand-cyan/70 ring-1 ring-brand-blue/40 hover:bg-brand-blue/30 disabled:cursor-not-allowed disabled:opacity-50"
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
                className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2"
              >
                <span className="text-sm text-zinc-200">{s.name}</span>
                <LiveShiftTimer clockInAt={s.clockInAt} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

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
                {props.adminView ? <th className="px-3 py-2 w-16" /> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {props.monthEntries.length === 0 ? (
                <tr>
                  <td
                    colSpan={props.adminView ? 5 : 3}
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
                    {props.adminView ? (
                      <td className="px-3 py-2">
                        <TimeEntryEditButton
                          entryId={e.id}
                          employeeName={e.employeeName}
                          clockInAt={e.clockInAt}
                          clockOutAt={e.clockOutAt}
                        />
                      </td>
                    ) : null}
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
