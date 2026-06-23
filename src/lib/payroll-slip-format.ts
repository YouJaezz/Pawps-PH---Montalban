import { PH_TIMEZONE } from "@/lib/ph-time";
import { formatDuration } from "@/lib/time-duration";

export type PayrollSlipPunch = {
  dateKey: string;
  clockIn: string;
  clockOut: string | null;
  minutes: number;
};

export type PayrollSlipDaySummary = {
  dateKey: string;
  weekday: string;
  dayLabel: string;
  totalMinutes: number;
  shiftCount: number;
  /** e.g. 7:02a–5:30p or 7:02a–12:00p · 1:00p–5:30p */
  scheduleCompact: string;
  /** grossPayFromMinutes(totalMinutes, hourlyRate) */
  dayPayCents: number;
};

/** Compact clock time for slip rows — 7:02a, 5:30p */
export function fmtPayrollTimeShort(iso: string) {
  const raw = new Date(iso).toLocaleString("en-PH", {
    timeZone: PH_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return raw.replace(/\s/g, "").toLowerCase();
}

/** Shorter duration for dense tables — 8:28 instead of 8h 28m */
export function formatDurationTable(minutes: number) {
  if (minutes <= 0) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}:${String(m).padStart(2, "0")}`;
}

function formatPair(inIso: string, outIso: string | null) {
  const start = fmtPayrollTimeShort(inIso);
  if (!outIso) return `${start}–…`;
  return `${start}–${fmtPayrollTimeShort(outIso)}`;
}

export function buildPayrollSlipDaySummaries(
  punches: PayrollSlipPunch[],
  hourlyRateCents = 0,
): PayrollSlipDaySummary[] {
  const byDay = new Map<string, PayrollSlipPunch[]>();
  for (const punch of punches) {
    const list = byDay.get(punch.dateKey) ?? [];
    list.push(punch);
    byDay.set(punch.dateKey, list);
  }

  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, dayPunches]) => {
      const sample = new Date(`${dateKey}T12:00:00+08:00`);
      const weekday = sample.toLocaleDateString("en-PH", {
        timeZone: PH_TIMEZONE,
        weekday: "short",
      });
      const dayLabel = sample.toLocaleDateString("en-PH", {
        timeZone: PH_TIMEZONE,
        month: "short",
        day: "numeric",
      });

      const totalMinutes = dayPunches.reduce((sum, p) => sum + p.minutes, 0);
      const scheduleCompact = dayPunches
        .map((p) => formatPair(p.clockIn, p.clockOut))
        .join(" · ");

      return {
        dateKey,
        weekday,
        dayLabel,
        totalMinutes,
        shiftCount: dayPunches.length,
        scheduleCompact,
        dayPayCents: Math.round((totalMinutes * hourlyRateCents) / 60),
      };
    });
}

export function splitDaySummariesForPrint<T>(items: T[]): [T[], T[]] {
  if (items.length <= 18) return [items, []];
  const mid = Math.ceil(items.length / 2);
  return [items.slice(0, mid), items.slice(mid)];
}

export function formatDurationLong(minutes: number) {
  return formatDuration(minutes);
}
