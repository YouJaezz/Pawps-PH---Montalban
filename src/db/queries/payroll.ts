import { cache } from "react";
import { and, desc, eq, gte, lt } from "drizzle-orm";

import { db } from "@/db";
import { payrollPayouts, timeEntries, users } from "@/db/schema";
import { employeeCode } from "@/db/queries/payroll-attendance";
import { entryMinutes } from "@/db/queries/time-attendance";
import type { PayrollSlipData } from "@/lib/payroll-slip";
import { buildPayrollSlipDaySummaries } from "@/lib/payroll-slip-format";
import {
  phNow,
} from "@/lib/ph-time";
import {
  canLockPayrollPeriod,
  isCurrentPayrollPeriod,
  isSemiMonthlyEnabled,
  payrollPeriodBounds,
  payrollPeriodKey,
  payrollPeriodLabel,
  type PayrollPeriod,
} from "@/lib/payroll-period";

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

function currentPayrollPeriod(): PayrollPeriod {
  const now = phNow();
  if (!isSemiMonthlyEnabled(now.year, now.month)) {
    return { year: now.year, month: now.month, half: 0, label: payrollPeriodLabel(now.year, now.month, 0) };
  }
  const half: 1 | 2 = now.day <= 15 ? 1 : 2;
  return { year: now.year, month: now.month, half, label: payrollPeriodLabel(now.year, now.month, half) };
}

function payrollPeriods(count: number): PayrollPeriod[] {
  const start = currentPayrollPeriod();
  const periods: PayrollPeriod[] = [start];
  while (periods.length < count) {
    const cur = periods[periods.length - 1]!;
    if (cur.half === 2) {
      periods.push({
        year: cur.year,
        month: cur.month,
        half: 1,
        label: payrollPeriodLabel(cur.year, cur.month, 1),
      });
      continue;
    }
    if (cur.half === 1) {
      const prevMonth = shiftMonth(cur.year, cur.month, -1);
      const prevHalf: 0 | 2 = isSemiMonthlyEnabled(prevMonth.year, prevMonth.month) ? 2 : 0;
      periods.push({
        year: prevMonth.year,
        month: prevMonth.month,
        half: prevHalf,
        label: payrollPeriodLabel(prevMonth.year, prevMonth.month, prevHalf),
      });
      continue;
    }
    // legacy monthly
    const prevMonth = shiftMonth(cur.year, cur.month, -1);
    periods.push({
      year: prevMonth.year,
      month: prevMonth.month,
      half: 0,
      label: payrollPeriodLabel(prevMonth.year, prevMonth.month, 0),
    });
  }
  return periods;
}

export function grossPayFromMinutes(minutes: number, hourlyRateCents: number) {
  return Math.round((minutes * hourlyRateCents) / 60);
}

export const getPayrollDashboard = cache(async () => {
  const periods = payrollPeriods(12);
  const oldest = periods[periods.length - 1]!;
  const newest = periods[0]!;
  const rangeStart = payrollPeriodBounds(oldest.year, oldest.month, oldest.half).start;
  const rangeEnd = payrollPeriodBounds(newest.year, newest.month, newest.half).end;

  const [employees, payouts, allEntries] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        hourlyRateCents: users.hourlyRateCents,
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

  const minutesByUserPeriod = new Map<string, number>();
  for (const e of allEntries) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "numeric",
      day: "numeric",
    }).formatToParts(e.clockInAt);
    const pick = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((p) => p.type === type)?.value ?? 0);
    const year = pick("year");
    const month = pick("month");
    const day = pick("day");
    const half: 0 | 1 | 2 = isSemiMonthlyEnabled(year, month)
      ? (day <= 15 ? 1 : 2)
      : 0;
    const key = `${e.userId}-${payrollPeriodKey({ year, month, half })}`;
    minutesByUserPeriod.set(
      key,
      (minutesByUserPeriod.get(key) ?? 0) +
        entryMinutes(e.clockInAt, e.clockOutAt),
    );
  }

  const rows = [];
  for (const emp of employees) {
    for (const p of periods) {
      const { year, month, half } = p;
      const label = p.label;
      const existing = payouts.find(
        (p) =>
          p.userId === emp.id &&
          p.periodYear === year &&
          p.periodMonth === month &&
          (p.periodHalf ?? 0) === half,
      );

      const minutesWorked =
        minutesByUserPeriod.get(`${emp.id}-${payrollPeriodKey({ year, month, half })}`) ?? 0;

      if (existing) {
        rows.push({
          userId: emp.id,
          employeeName: emp.name ?? emp.email,
          year,
          month,
          half,
          label,
          minutesWorked: existing.minutesWorked,
          hourlyRateCents: existing.hourlyRateCents,
          grossPayCents: existing.grossPayCents,
          payoutId: existing.id,
          status: existing.status as "Accrued" | "Paid",
          canGenerate: false,
        });
        continue;
      }

      rows.push({
        userId: emp.id,
        employeeName: emp.name ?? emp.email,
        year,
        month,
        half,
        label,
        minutesWorked,
        hourlyRateCents: emp.hourlyRateCents,
        grossPayCents: grossPayFromMinutes(minutesWorked, emp.hourlyRateCents),
        payoutId: null as number | null,
        status: isCurrentPayrollPeriod({ year, month, half })
          ? ("Projected" as const)
          : ("Open" as const),
        canGenerate:
          !isCurrentPayrollPeriod({ year, month, half }) &&
          canLockPayrollPeriod({ year, month, half }) &&
          minutesWorked > 0 &&
          emp.hourlyRateCents > 0,
      });
    }
  }

  return { employees, rows };
});

export async function getPayrollSlipData(
  userId: number,
  year: number,
  month: number,
  half: 0 | 1 | 2,
): Promise<PayrollSlipData | null> {
  const { start, end } = payrollPeriodBounds(year, month, half);
  const periodLabel = payrollPeriodLabel(year, month, half);

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

  let status: string =
    payout?.status ?? (isCurrentPayrollPeriod({ year, month, half }) ? "Projected" : "Open");
  if (!payout && liveMinutes > 0 && !isCurrentPayrollPeriod({ year, month, half })) {
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
}
