import { cache } from "react";
import { and, desc, eq, gte, lt } from "drizzle-orm";

import { db } from "@/db";
import { payrollPayouts, timeEntries, users } from "@/db/schema";
import { employeeCode } from "@/db/queries/payroll-attendance";
import { entryMinutes } from "@/db/queries/time-attendance";
import type { PayrollSlipData } from "@/lib/payroll-slip";
import { buildPayrollSlipDaySummaries } from "@/lib/payroll-slip-format";
import { phDayBounds, phNow } from "@/lib/ph-time";
import {
  canLockPayrollPeriod,
  clockInPeriodForDate,
  dailyPayPeriods,
  isCurrentPayrollPeriod,
  normalizePaySchedule,
  payrollPeriodBounds,
  payrollPeriodKey,
  payrollPeriodLabel,
  semiMonthlyPeriods,
  type PaySchedule,
} from "@/lib/payroll-period";

export function grossPayFromMinutes(minutes: number, hourlyRateCents: number) {
  return Math.round((minutes * hourlyRateCents) / 60);
}

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
};

function findPayout(
  payouts: Array<typeof payrollPayouts.$inferSelect>,
  userId: number,
  year: number,
  month: number,
  half: 0 | 1 | 2,
  periodDay: number,
) {
  return payouts.find(
    (p) =>
      p.userId === userId &&
      p.periodYear === year &&
      p.periodMonth === month &&
      (p.periodHalf ?? 0) === half &&
      (p.periodDay ?? 0) === periodDay,
  );
}

function buildPayrollRow(
  emp: {
    id: number;
    name: string | null;
    email: string;
    hourlyRateCents: number;
    paySchedule: string | null;
  },
  period: {
    year: number;
    month: number;
    half: 0 | 1 | 2;
    periodDay: number;
    label: string;
  },
  paySchedule: PaySchedule,
  minutesWorked: number,
  existing: typeof payrollPayouts.$inferSelect | undefined,
): PayrollRow {
  const { year, month, half, periodDay, label } = period;

  if (existing) {
    return {
      userId: emp.id,
      employeeName: emp.name ?? emp.email,
      year,
      month,
      half,
      periodDay,
      paySchedule,
      label,
      minutesWorked: existing.minutesWorked,
      hourlyRateCents: existing.hourlyRateCents,
      grossPayCents: existing.grossPayCents,
      payoutId: existing.id,
      status: existing.status as "Accrued" | "Paid",
      canGenerate: false,
    };
  }

  const periodRef = { year, month, half, periodDay };
  return {
    userId: emp.id,
    employeeName: emp.name ?? emp.email,
    year,
    month,
    half,
    periodDay,
    paySchedule,
    label,
    minutesWorked,
    hourlyRateCents: emp.hourlyRateCents,
    grossPayCents: grossPayFromMinutes(minutesWorked, emp.hourlyRateCents),
    payoutId: null,
    status: isCurrentPayrollPeriod(periodRef)
      ? "Projected"
      : "Open",
    canGenerate:
      !isCurrentPayrollPeriod(periodRef) &&
      canLockPayrollPeriod(periodRef) &&
      minutesWorked > 0 &&
      emp.hourlyRateCents > 0,
  };
}

export const getPayrollDashboard = cache(async () => {
  const semiPeriods = semiMonthlyPeriods(12);
  const dailyPeriods = dailyPayPeriods(30);

  const semiOldest = semiPeriods[semiPeriods.length - 1]!;
  const dailyOldest = dailyPeriods[dailyPeriods.length - 1]!;
  const semiStart = payrollPeriodBounds(
    semiOldest.year,
    semiOldest.month,
    semiOldest.half,
  ).start;
  const dailyStart = payrollPeriodBounds(
    dailyOldest.year,
    dailyOldest.month,
    0,
    dailyOldest.periodDay,
  ).start;
  const rangeStart = semiStart < dailyStart ? semiStart : dailyStart;
  const now = phNow();
  const rangeEnd = phDayBounds(now.year, now.month, now.day).end;

  const [employees, payouts, allEntries] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        hourlyRateCents: users.hourlyRateCents,
        paySchedule: users.paySchedule,
        role: users.role,
      })
      .from(users)
      .where(eq(users.active, true))
      .orderBy(users.name),
    db
      .select()
      .from(payrollPayouts)
      .orderBy(desc(payrollPayouts.periodYear), desc(payrollPayouts.periodMonth)),
    db
      .select({
        userId: timeEntries.userId,
        clockInAt: timeEntries.clockInAt,
        clockOutAt: timeEntries.clockOutAt,
      })
      .from(timeEntries)
      .where(
        and(
          gte(timeEntries.clockInAt, rangeStart),
          lt(timeEntries.clockInAt, rangeEnd),
        ),
      ),
  ]);

  const scheduleByUser = new Map(
    employees.map((e) => [e.id, normalizePaySchedule(e.paySchedule)]),
  );

  const minutesByUserPeriod = new Map<string, number>();
  for (const e of allEntries) {
    const schedule = scheduleByUser.get(e.userId);
    if (!schedule) continue;
    const period = clockInPeriodForDate(e.clockInAt, schedule);
    const key = `${e.userId}-${payrollPeriodKey(period)}`;
    minutesByUserPeriod.set(
      key,
      (minutesByUserPeriod.get(key) ?? 0) +
        entryMinutes(e.clockInAt, e.clockOutAt),
    );
  }

  const semiMonthlyRows: PayrollRow[] = [];
  const dailyRows: PayrollRow[] = [];

  for (const emp of employees) {
    const paySchedule = normalizePaySchedule(emp.paySchedule);

    if (paySchedule === "daily") {
      for (const p of dailyPeriods) {
        const { year, month, half, periodDay, label } = p;
        const existing = findPayout(
          payouts,
          emp.id,
          year,
          month,
          half,
          periodDay,
        );
        const minutesWorked =
          minutesByUserPeriod.get(
            `${emp.id}-${payrollPeriodKey({ year, month, half, periodDay })}`,
          ) ?? 0;
        dailyRows.push(
          buildPayrollRow(
            emp,
            { year, month, half, periodDay, label },
            paySchedule,
            minutesWorked,
            existing,
          ),
        );
      }
      continue;
    }

    for (const p of semiPeriods) {
      const { year, month, half, periodDay, label } = p;
      const existing = findPayout(
        payouts,
        emp.id,
        year,
        month,
        half,
        periodDay,
      );
      const minutesWorked =
        minutesByUserPeriod.get(
          `${emp.id}-${payrollPeriodKey({ year, month, half, periodDay })}`,
        ) ?? 0;
      semiMonthlyRows.push(
        buildPayrollRow(
          emp,
          { year, month, half, periodDay, label },
          paySchedule,
          minutesWorked,
          existing,
        ),
      );
    }
  }

  return { employees, semiMonthlyRows, dailyRows };
});

export async function getPayrollSlipData(
  userId: number,
  year: number,
  month: number,
  half: 0 | 1 | 2,
  periodDay = 0,
): Promise<PayrollSlipData | null> {
  const { start, end } = payrollPeriodBounds(year, month, half, periodDay);
  const periodLabel = payrollPeriodLabel(year, month, half, periodDay);

  const [user, payout, entries] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        hourlyRateCents: users.hourlyRateCents,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    db
      .select()
      .from(payrollPayouts)
      .where(
        and(
          eq(payrollPayouts.userId, userId),
          eq(payrollPayouts.periodYear, year),
          eq(payrollPayouts.periodMonth, month),
          eq(payrollPayouts.periodHalf, half),
          eq(payrollPayouts.periodDay, periodDay),
        ),
      )
      .limit(1)
      .then((rows) => rows[0] ?? null),
    db
      .select({
        clockInAt: timeEntries.clockInAt,
        clockOutAt: timeEntries.clockOutAt,
      })
      .from(timeEntries)
      .where(
        and(
          eq(timeEntries.userId, userId),
          gte(timeEntries.clockInAt, start),
          lt(timeEntries.clockInAt, end),
        ),
      )
      .orderBy(timeEntries.clockInAt),
  ]);

  if (!user) return null;

  const liveMinutes = entries.reduce(
    (sum, e) => sum + entryMinutes(e.clockInAt, e.clockOutAt),
    0,
  );
  const hourlyRateCents = payout?.hourlyRateCents ?? user.hourlyRateCents;
  const minutesWorked = payout?.minutesWorked ?? liveMinutes;
  const grossPayCents =
    payout?.grossPayCents ?? grossPayFromMinutes(liveMinutes, hourlyRateCents);

  const daysWorked = new Set(
    entries.map((e) => {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Manila",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(e.clockInAt);
      const pick = (type: Intl.DateTimeFormatPartTypes) =>
        parts.find((p) => p.type === type)?.value ?? "";
      return `${pick("year")}-${pick("month")}-${pick("day")}`;
    }),
  ).size;

  const periodRef = { year, month, half, periodDay };
  let status: string =
    payout?.status ??
    (isCurrentPayrollPeriod(periodRef) ? "Projected" : "Open");
  if (!payout && liveMinutes > 0 && !isCurrentPayrollPeriod(periodRef)) {
    status = "Open";
  }

  const punches = entries.map((e) => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(e.clockInAt);
    const pick = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((p) => p.type === type)?.value ?? "";
    return {
      dateKey: `${pick("year")}-${pick("month")}-${pick("day")}`,
      clockIn: e.clockInAt.toISOString(),
      clockOut: e.clockOutAt?.toISOString() ?? null,
      minutes: entryMinutes(e.clockInAt, e.clockOutAt),
    };
  });

  return {
    employeeName: user.name ?? user.email,
    employeeCode: employeeCode(user.id),
    periodLabel,
    year,
    month,
    half,
    periodDay,
    minutesWorked,
    hourlyRateCents,
    grossPayCents,
    status,
    paidAt: payout?.paidAt?.toISOString() ?? null,
    shiftCount: entries.length,
    daysWorked,
    punches,
    daySummaries: buildPayrollSlipDaySummaries(punches, hourlyRateCents),
  };
};
