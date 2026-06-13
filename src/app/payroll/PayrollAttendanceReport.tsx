"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { LiveShiftTimer } from "@/components/LiveShiftTimer";
import { PayrollPrintSlipLink } from "@/components/PayrollPrintSlipLink";
import { ScrollableTable } from "@/components/ScrollableTable";
import type { PayrollAttendanceReport } from "@/db/queries/payroll-attendance";
import { formatPhpFromCents } from "@/lib/money";
import { formatDuration } from "@/lib/time-duration";

function fmtPunch(d: Date | string) {
  return new Date(d).toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function fmtTimeOnly(d: Date | string) {
  return new Date(d).toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function TerminalClock() {
  const [now, setNow] = useState("");

  useEffect(() => {
    const tick = () => {
      setNow(
        new Date().toLocaleString("en-PH", {
          timeZone: "Asia/Manila",
          weekday: "short",
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }),
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="font-mono text-[11px] tracking-wide text-emerald-300/90">
      {now || "—"}
    </div>
  );
}

function shiftMonth(year: number, month: number, delta: number) {
  let y = year;
  let m = month + delta;
  while (m <= 0) {
    m += 12;
    y -= 1;
  }
  while (m > 12) {
    m -= 12;
    y += 1;
  }
  return { year: y, month: m };
}

function StatusBadge(props: { status: "Complete" | "On duty" }) {
  if (props.status === "Complete") {
    return (
      <span className="rounded border border-emerald-500/40 bg-emerald-500/15 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-emerald-300">
        OK
      </span>
    );
  }
  return (
    <span className="rounded border border-amber-500/40 bg-amber-500/15 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-amber-300">
      Active
    </span>
  );
}

export function PayrollAttendanceReport(props: {
  report: PayrollAttendanceReport;
}) {
  const router = useRouter();
  const { report } = props;
  const { year, month } = report;

  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);

  const exportUrl = `/api/export/attendance-hours.csv?year=${year}&month=${month}`;

  const monthOptions = useMemo(() => {
    const opts: Array<{ year: number; month: number; label: string }> = [];
    let y = year;
    let m = month;
    for (let i = 0; i < 12; i++) {
      opts.push({
        year: y,
        month: m,
        label: new Date(
          `${y}-${String(m).padStart(2, "0")}-15T12:00:00+08:00`,
        ).toLocaleDateString("en-PH", {
          month: "long",
          year: "numeric",
          timeZone: "Asia/Manila",
        }),
      });
      const s = shiftMonth(y, m, -1);
      y = s.year;
      m = s.month;
    }
    return opts.reverse();
  }, [year, month]);

  return (
    <div className="overflow-hidden rounded-xl border border-emerald-500/25 bg-gradient-to-b from-[#0a1410] to-[#0c1014] shadow-[inset_0_1px_0_rgba(52,211,153,0.08)]">
      {/* Terminal header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-500/20 bg-emerald-950/40 px-4 py-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-400">
              Time &amp; Attendance Terminal
            </span>
          </div>
          <h2 className="mt-1 text-lg font-semibold text-zinc-50">
            Staff hours report
          </h2>
          <p className="text-[11px] text-zinc-500">
            Biometric-style punch log from Time In / Out · {report.monthLabel}
          </p>
        </div>
        <div className="text-right">
          <TerminalClock />
          <div className="mt-1 font-mono text-[9px] text-zinc-600">
            Asia/Manila · Web clock
          </div>
        </div>
      </div>

      {/* Period controls */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white/5 px-4 py-3">
        <Link
          href={`/payroll?year=${prev.year}&month=${prev.month}`}
          className="rounded border border-white/10 px-2 py-1 font-mono text-[10px] text-zinc-400 hover:bg-white/5"
        >
          ← Prev
        </Link>
        <select
          value={`${year}-${month}`}
          onChange={(e) => {
            const [y, m] = e.target.value.split("-").map(Number);
            router.push(`/payroll?year=${y}&month=${m}`);
          }}
          className="rounded border border-emerald-500/30 bg-black/40 px-2 py-1 font-mono text-[11px] text-emerald-100"
        >
          {monthOptions.map((o, i) => (
            <option key={`${o.year}-${o.month}-${i}`} value={`${o.year}-${o.month}`}>
              {new Date(`${o.year}-${String(o.month).padStart(2, "0")}-15T12:00:00+08:00`).toLocaleDateString(
                "en-PH",
                { month: "long", year: "numeric", timeZone: "Asia/Manila" },
              )}
            </option>
          ))}
        </select>
        <Link
          href={`/payroll?year=${next.year}&month=${next.month}`}
          className="rounded border border-white/10 px-2 py-1 font-mono text-[10px] text-zinc-400 hover:bg-white/5"
        >
          Next →
        </Link>
        <a
          href={exportUrl}
          className="ml-auto rounded border border-[#e8a44a]/40 bg-[#e8a44a]/10 px-3 py-1 font-mono text-[10px] uppercase tracking-wide text-[#e8a44a] hover:bg-[#e8a44a]/20"
        >
          Export CSV
        </a>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-px border-b border-white/5 bg-white/5 sm:grid-cols-4">
        {[
          {
            label: "Total staff hours",
            value: formatDuration(report.summary.totalMinutes),
            sub: `${report.summary.staffWithHours} of ${report.summary.staffCount} staff`,
          },
          {
            label: "Total punches",
            value: String(report.summary.totalShifts),
            sub: "Time in/out records",
          },
          {
            label: "On duty now",
            value: String(report.summary.onDutyCount),
            sub: report.isCurrentMonth ? "Live clock-ins" : "Current month only",
          },
          {
            label: "Avg per employee",
            value: formatDuration(report.summary.avgMinutesPerStaff),
            sub: report.monthLabel,
          },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-[#0c1014] px-4 py-3">
            <div className="font-mono text-[9px] uppercase tracking-wider text-zinc-600">
              {kpi.label}
            </div>
            <div className="mt-1 font-mono text-xl font-bold text-emerald-300">
              {kpi.value}
            </div>
            <div className="mt-0.5 text-[10px] text-zinc-500">{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* On duty strip */}
      {report.onDutyNow.length > 0 && report.isCurrentMonth ? (
        <div className="border-b border-amber-500/20 bg-amber-500/5 px-4 py-3">
          <div className="font-mono text-[9px] uppercase tracking-wider text-amber-400/80">
            Currently clocked in
          </div>
          <ul className="mt-2 flex flex-wrap gap-2">
            {report.onDutyNow.map((s) => (
              <li
                key={s.userId}
                className="flex items-center gap-2 rounded-lg border border-amber-500/25 bg-black/30 px-3 py-1.5"
              >
                <span className="font-mono text-[10px] text-amber-200/70">
                  {s.employeeCode}
                </span>
                <span className="text-xs text-zinc-200">{s.employeeName}</span>
                <LiveShiftTimer clockInAt={s.clockInAt} size="sm" showPulse={false} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="space-y-4 p-4">
        {/* Staff summary */}
        <section>
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
              Monthly employee summary
            </h3>
            <span className="font-mono text-[9px] text-zinc-600">
              Report ID · {year}-{String(month).padStart(2, "0")}
            </span>
          </div>
          <ScrollableTable maxHeight="max-h-64" className="mt-2">
            <table className="w-full text-xs">
              <thead className="bg-emerald-950/50 text-left font-mono text-[9px] uppercase tracking-wider text-emerald-500/80">
                <tr>
                  <th className="px-3 py-2">ID</th>
                  <th className="px-3 py-2">Employee</th>
                  <th className="px-3 py-2">Total hours</th>
                  <th className="px-3 py-2">Shifts</th>
                  <th className="px-3 py-2">Days</th>
                  <th className="px-3 py-2">Rate</th>
                  <th className="px-3 py-2">Gross</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Print</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono">
                {report.staffSummaries.map((s) => (
                  <tr key={s.userId} className="hover:bg-white/[0.02]">
                    <td className="px-3 py-2 text-emerald-400/70">{s.employeeCode}</td>
                    <td className="px-3 py-2 font-sans text-zinc-200">
                      {s.employeeName}
                    </td>
                    <td className="px-3 py-2 text-emerald-300">
                      {formatDuration(s.minutesWorked)}
                    </td>
                    <td className="px-3 py-2 text-zinc-400">{s.shiftCount}</td>
                    <td className="px-3 py-2 text-zinc-400">{s.daysWorked}</td>
                    <td className="px-3 py-2 text-zinc-400">
                      {s.hourlyRateCents > 0
                        ? `${formatPhpFromCents(s.hourlyRateCents)}/hr`
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-[#e8a44a]">
                      {s.grossPayCents > 0
                        ? formatPhpFromCents(s.grossPayCents)
                        : "—"}
                    </td>
                    <td className="px-3 py-2">
                      {s.onDuty && report.isCurrentMonth ? (
                        <span className="text-amber-300">ON DUTY</span>
                      ) : s.minutesWorked > 0 ? (
                        <span className="text-emerald-400/80">LOGGED</span>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <PayrollPrintSlipLink
                        userId={s.userId}
                        year={report.year}
                        month={report.month}
                        compact
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollableTable>
        </section>

        {/* Daily timesheet grid */}
        <section>
          <h3 className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
            Daily timesheet (hours per day)
          </h3>
          <ScrollableTable maxHeight="max-h-72" className="mt-2">
            <table className="w-full text-[10px]">
              <thead className="sticky top-0 z-10 bg-[#0c1014] text-left font-mono text-[9px] uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-2 py-2">Date</th>
                  {report.employees.map((e) => (
                    <th
                      key={e.id}
                      className="px-2 py-2 text-center"
                      title={e.name}
                    >
                      {e.code.replace("EMP-", "")}
                    </th>
                  ))}
                  <th className="px-2 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono">
                {report.dailyGrid.map((row) => (
                  <tr
                    key={row.dateKey}
                    className={row.dayTotal > 0 ? "text-zinc-300" : "text-zinc-700"}
                  >
                    <td className="whitespace-nowrap px-2 py-1.5 text-zinc-400">
                      {row.dateLabel}
                    </td>
                    {row.cells.map((cell) => (
                      <td
                        key={cell.userId}
                        className="px-2 py-1.5 text-center"
                      >
                        {cell.minutes > 0
                          ? formatDuration(cell.minutes)
                          : "·"}
                      </td>
                    ))}
                    <td className="px-2 py-1.5 text-right text-emerald-400/80">
                      {row.dayTotal > 0 ? formatDuration(row.dayTotal) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollableTable>
          <p className="mt-1 font-mono text-[9px] text-zinc-600">
            Column headers = employee ID · hover for full name
          </p>
        </section>

        {/* Punch audit log */}
        <section>
          <h3 className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
            Punch audit log
          </h3>
          <ScrollableTable maxHeight="max-h-[min(50vh,420px)]" className="mt-2">
            <table className="w-full text-xs">
              <thead className="bg-emerald-950/50 text-left font-mono text-[9px] uppercase tracking-wider text-emerald-500/80">
                <tr>
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">ID</th>
                  <th className="px-3 py-2">Employee</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Time in</th>
                  <th className="px-3 py-2">Time out</th>
                  <th className="px-3 py-2">Duration</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {report.punches.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-zinc-600">
                      No punch records for this period.
                    </td>
                  </tr>
                ) : (
                  report.punches.map((p, idx) => (
                    <tr key={p.id} className="font-mono hover:bg-white/[0.02]">
                      <td className="px-3 py-2 text-zinc-600">
                        {String(report.punches.length - idx).padStart(3, "0")}
                      </td>
                      <td className="px-3 py-2 text-emerald-400/70">
                        {p.employeeCode}
                      </td>
                      <td className="px-3 py-2 font-sans text-zinc-200">
                        {p.employeeName}
                      </td>
                      <td className="px-3 py-2 text-zinc-400">{p.dateKey}</td>
                      <td className="px-3 py-2 text-zinc-300">
                        {fmtTimeOnly(p.clockInAt)}
                      </td>
                      <td className="px-3 py-2">
                        {p.clockOutAt ? (
                          fmtTimeOnly(p.clockOutAt)
                        ) : report.isCurrentMonth ? (
                          <span className="inline-flex items-center gap-1 text-amber-300">
                            —
                            <LiveShiftTimer
                              clockInAt={p.clockInAt.toISOString()}
                              size="sm"
                              showPulse={false}
                            />
                          </span>
                        ) : (
                          <span className="text-red-400/80">Missing</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-emerald-300">
                        {p.clockOutAt ? (
                          formatDuration(p.minutes)
                        ) : report.isCurrentMonth ? (
                          <LiveShiftTimer
                            clockInAt={p.clockInAt.toISOString()}
                            size="sm"
                            showPulse={false}
                          />
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge status={p.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </ScrollableTable>
        </section>
      </div>

      <div className="border-t border-white/5 px-4 py-2 font-mono text-[9px] text-zinc-600">
        Generated {fmtPunch(report.generatedAt)} · Source: Pawps PH Time Clock
      </div>
    </div>
  );
}
