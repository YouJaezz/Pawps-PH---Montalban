import {
  phCalendarParts,
  phDayBounds,
  phDayLabel,
  phDaysInMonth,
  phMonthLabel,
  phNow,
} from "@/lib/ph-time";

export const PAY_SCHEDULES = ["semi_monthly", "daily"] as const;
export type PaySchedule = (typeof PAY_SCHEDULES)[number];

export const PAYROLL_SEMI_MONTHLY_START = { year: 2026, month: 7 } as const;

export type PayrollPeriod = {
  year: number;
  month: number; // 1-12
  /** 0 = legacy monthly or daily, 1 = 1st-15th, 2 = 16th-end */
  half: 0 | 1 | 2;
  /** 1-31 for daily pay rows; 0 for semi-monthly */
  periodDay: number;
  label: string;
};

export function payScheduleLabel(schedule: PaySchedule) {
  return schedule === "daily" ? "Daily pay" : "Semi-monthly (15th & 30th)";
}

export function normalizePaySchedule(raw: string | null | undefined): PaySchedule {
  return raw === "daily" ? "daily" : "semi_monthly";
}

export function isDailyPayPeriod(periodDay: number) {
  return periodDay > 0;
}

export function isSemiMonthlyEnabled(year: number, month: number) {
  if (year > PAYROLL_SEMI_MONTHLY_START.year) return true;
  if (year < PAYROLL_SEMI_MONTHLY_START.year) return false;
  return month >= PAYROLL_SEMI_MONTHLY_START.month;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function payrollPeriodBounds(
  year: number,
  month: number,
  half: 0 | 1 | 2,
  periodDay = 0,
) {
  if (periodDay > 0) {
    return phDayBounds(year, month, periodDay);
  }

  if (half === 0) {
    const start = new Date(`${year}-${pad2(month)}-01T00:00:00+08:00`);
    const nextYear = month === 12 ? year + 1 : year;
    const nextMonth = month === 12 ? 1 : month + 1;
    const end = new Date(`${nextYear}-${pad2(nextMonth)}-01T00:00:00+08:00`);
    return { start, end };
  }

  if (half === 1) {
    return {
      start: new Date(`${year}-${pad2(month)}-01T00:00:00+08:00`),
      end: new Date(`${year}-${pad2(month)}-16T00:00:00+08:00`),
    };
  }

  const lastDay = phDaysInMonth(year, month);
  return {
    start: new Date(`${year}-${pad2(month)}-16T00:00:00+08:00`),
    end: new Date(`${year}-${pad2(month)}-${pad2(lastDay)}T24:00:00+08:00`),
  };
}

export function payrollPeriodLabel(
  year: number,
  month: number,
  half: 0 | 1 | 2,
  periodDay = 0,
) {
  if (periodDay > 0) {
    return `${phDayLabel(year, month, periodDay)} · daily`;
  }
  const monthLabel = phMonthLabel(year, month);
  if (half === 0) return monthLabel;
  return half === 1 ? `${monthLabel} (1–15)` : `${monthLabel} (16–30)`;
}

export function payrollPeriodKey(p: {
  year: number;
  month: number;
  half: 0 | 1 | 2;
  periodDay?: number;
}) {
  const day = p.periodDay ?? 0;
  if (day > 0) return `${p.year}-${p.month}-d${day}`;
  return `${p.year}-${p.month}-${p.half}`;
}

export function isCurrentPayrollPeriod(
  p: Pick<PayrollPeriod, "year" | "month" | "half" | "periodDay">,
) {
  if (isDailyPayPeriod(p.periodDay)) {
    const now = phNow();
    return (
      p.year === now.year && p.month === now.month && p.periodDay === now.day
    );
  }

  const now = phNow();
  if (p.year !== now.year || p.month !== now.month) return false;
  if (p.half === 0) return true;
  return p.half === 1 ? now.day <= 15 : now.day >= 16;
}

export function canLockPayrollPeriod(
  p: Pick<PayrollPeriod, "year" | "month" | "half" | "periodDay">,
) {
  const { end } = payrollPeriodBounds(p.year, p.month, p.half, p.periodDay);
  return Date.now() >= end.getTime();
}

export function resolvePayrollPayoutPeriod(
  yearParam?: string,
  monthParam?: string,
  halfParam?: string,
  dayParam?: string,
): { year: number; month: number; half: 0 | 1 | 2; periodDay: number } {
  const now = phNow();
  const dayRaw = dayParam ? Number(dayParam) : 0;
  if (Number.isFinite(dayRaw) && dayRaw >= 1 && dayRaw <= 31) {
    const year = yearParam ? Number(yearParam) : now.year;
    const month = monthParam ? Number(monthParam) : now.month;
    const cleanYear = Number.isFinite(year) ? year : now.year;
    const cleanMonth =
      Number.isFinite(month) && month >= 1 && month <= 12 ? month : now.month;
    return {
      year: cleanYear,
      month: cleanMonth,
      half: 0,
      periodDay: dayRaw,
    };
  }

  const year = yearParam ? Number(yearParam) : now.year;
  const month = monthParam ? Number(monthParam) : now.month;
  const rawHalf = halfParam ? Number(halfParam) : undefined;

  const cleanYear = Number.isFinite(year) ? year : now.year;
  const cleanMonth =
    Number.isFinite(month) && month >= 1 && month <= 12 ? month : now.month;

  const wantsSemi = isSemiMonthlyEnabled(cleanYear, cleanMonth);
  if (!wantsSemi) {
    return { year: cleanYear, month: cleanMonth, half: 0, periodDay: 0 };
  }

  const half: 0 | 1 | 2 =
    rawHalf === 1 || rawHalf === 2
      ? (rawHalf as 1 | 2)
      : now.day <= 15
        ? 1
        : 2;

  return { year: cleanYear, month: cleanMonth, half, periodDay: 0 };
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

function currentSemiMonthlyPeriod(): PayrollPeriod {
  const now = phNow();
  if (!isSemiMonthlyEnabled(now.year, now.month)) {
    return {
      year: now.year,
      month: now.month,
      half: 0,
      periodDay: 0,
      label: payrollPeriodLabel(now.year, now.month, 0),
    };
  }
  const half: 1 | 2 = now.day <= 15 ? 1 : 2;
  return {
    year: now.year,
    month: now.month,
    half,
    periodDay: 0,
    label: payrollPeriodLabel(now.year, now.month, half),
  };
}

export function semiMonthlyPeriods(count: number): PayrollPeriod[] {
  const start = currentSemiMonthlyPeriod();
  const periods: PayrollPeriod[] = [start];
  while (periods.length < count) {
    const cur = periods[periods.length - 1]!;
    if (cur.half === 2) {
      periods.push({
        year: cur.year,
        month: cur.month,
        half: 1,
        periodDay: 0,
        label: payrollPeriodLabel(cur.year, cur.month, 1),
      });
      continue;
    }
    if (cur.half === 1) {
      const prevMonth = shiftMonth(cur.year, cur.month, -1);
      const prevHalf: 0 | 2 = isSemiMonthlyEnabled(prevMonth.year, prevMonth.month)
        ? 2
        : 0;
      periods.push({
        year: prevMonth.year,
        month: prevMonth.month,
        half: prevHalf,
        periodDay: 0,
        label: payrollPeriodLabel(prevMonth.year, prevMonth.month, prevHalf),
      });
      continue;
    }
    const prevMonth = shiftMonth(cur.year, cur.month, -1);
    periods.push({
      year: prevMonth.year,
      month: prevMonth.month,
      half: 0,
      periodDay: 0,
      label: payrollPeriodLabel(prevMonth.year, prevMonth.month, 0),
    });
  }
  return periods;
}

/** Recent calendar days for daily-paid staff (today first). */
export function dailyPayPeriods(count: number): PayrollPeriod[] {
  const now = phNow();
  const anchor = new Date(
    `${now.year}-${pad2(now.month)}-${pad2(now.day)}T12:00:00+08:00`,
  );
  const periods: PayrollPeriod[] = [];

  for (let i = 0; i < count; i++) {
    const d = new Date(anchor.getTime() - i * 86_400_000);
    const { year, month, day } = phCalendarParts(d);
    periods.push({
      year,
      month,
      half: 0,
      periodDay: day,
      label: payrollPeriodLabel(year, month, 0, day),
    });
  }

  return periods;
}

export function clockInPeriodForDate(
  date: Date,
  schedule: PaySchedule,
): Pick<PayrollPeriod, "year" | "month" | "half" | "periodDay"> {
  const { year, month, day } = phCalendarParts(date);
  if (schedule === "daily") {
    return { year, month, half: 0, periodDay: day };
  }
  const half: 0 | 1 | 2 = isSemiMonthlyEnabled(year, month)
    ? day <= 15
      ? 1
      : 2
    : 0;
  return { year, month, half, periodDay: 0 };
}

export function formatPayDayHint(schedule: PaySchedule) {
  if (schedule === "daily") {
    return "Paid per day worked — lock after each shift day ends.";
  }
  return "Paid every 15th and end of month (1–15 and 16–30 periods).";
}
