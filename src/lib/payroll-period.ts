import { phDaysInMonth, phMonthLabel, phNow } from "@/lib/ph-time";

export const PAYROLL_SEMI_MONTHLY_START = { year: 2026, month: 7 } as const;

export type PayrollPeriod = {
  year: number;
  month: number; // 1-12
  /** 0 = legacy monthly, 1 = 1st-15th, 2 = 16th-end */
  half: 0 | 1 | 2;
  label: string;
};

export function isSemiMonthlyEnabled(year: number, month: number) {
  if (year > PAYROLL_SEMI_MONTHLY_START.year) return true;
  if (year < PAYROLL_SEMI_MONTHLY_START.year) return false;
  return month >= PAYROLL_SEMI_MONTHLY_START.month;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function payrollPeriodBounds(year: number, month: number, half: 0 | 1 | 2) {
  if (half === 0) {
    // Monthly legacy mode: treat as full month.
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

export function payrollPeriodLabel(year: number, month: number, half: 0 | 1 | 2) {
  const monthLabel = phMonthLabel(year, month);
  if (half === 0) return monthLabel;
  return half === 1 ? `${monthLabel} (1–15)` : `${monthLabel} (16–30)`;
}

export function payrollPeriodKey(p: Pick<PayrollPeriod, "year" | "month" | "half">) {
  return `${p.year}-${p.month}-${p.half}`;
}

export function isCurrentPayrollPeriod(p: Pick<PayrollPeriod, "year" | "month" | "half">) {
  const now = phNow();
  if (p.year !== now.year || p.month !== now.month) return false;
  if (p.half === 0) return true;
  return p.half === 1 ? now.day <= 15 : now.day >= 16;
}

export function canLockPayrollPeriod(p: Pick<PayrollPeriod, "year" | "month" | "half">) {
  const { end } = payrollPeriodBounds(p.year, p.month, p.half);
  return Date.now() >= end.getTime();
}

export function resolvePayrollPayoutPeriod(
  yearParam?: string,
  monthParam?: string,
  halfParam?: string,
): { year: number; month: number; half: 0 | 1 | 2 } {
  const now = phNow();
  const year = yearParam ? Number(yearParam) : now.year;
  const month = monthParam ? Number(monthParam) : now.month;
  const rawHalf = halfParam ? Number(halfParam) : undefined;

  const cleanYear = Number.isFinite(year) ? year : now.year;
  const cleanMonth =
    Number.isFinite(month) && month >= 1 && month <= 12 ? month : now.month;

  const wantsSemi = isSemiMonthlyEnabled(cleanYear, cleanMonth);
  if (!wantsSemi) {
    return { year: cleanYear, month: cleanMonth, half: 0 };
  }

  const half: 0 | 1 | 2 =
    rawHalf === 1 || rawHalf === 2
      ? (rawHalf as 1 | 2)
      : now.day <= 15
        ? 1
        : 2;

  return { year: cleanYear, month: cleanMonth, half };
}

