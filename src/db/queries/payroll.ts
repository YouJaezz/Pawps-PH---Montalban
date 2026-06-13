import { cache } from "react";
import { and, desc, eq, gte, lt } from "drizzle-orm";

import { db } from "@/db";
import { payrollPayouts, timeEntries, users } from "@/db/schema";
import { employeeCode } from "@/db/queries/payroll-attendance";
import { entryMinutes } from "@/db/queries/time-attendance";
import type { PayrollSlipData } from "@/lib/payroll-slip";
import { buildPayrollSlipDaySummaries } from "@/lib/payroll-slip-format";
import {
  phIsCurrentMonth,
  phMonthBounds,
  phMonthKey,
  phMonthLabel,
  phNow,
} from "@/lib/ph-time";

function phMonthPeriods(count: number) {
  const { year: startYear, month: startMonth } = phNow();
  const periods: Array<{ year: number; month: number }> = [];
  for (let i = 0; i < count; i++) {
    let y = startYear;
    let m = startMonth - i;
    while (m <= 0) {
      m += 12;
      y -= 1;
    }
    periods.push({ year: y, month: m });
  }
  return periods;
}

export function grossPayFromMinutes(minutes: number, hourlyRateCents: number) {
  return Math.round((minutes * hourlyRateCents) / 60);
}

export const getPayrollDashboard = cache(async () => {
  const monthPeriods = phMonthPeriods(6);
  const oldest = monthPeriods[monthPeriods.length - 1]!;
  const newest = monthPeriods[0]!;
  const rangeStart = phMonthBounds(oldest.year, oldest.month).start;
  const rangeEnd = phMonthBounds(newest.year, newest.month).end;

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

  const minutesByUserMonth = new Map<string, number>();
  for (const e of allEntries) {
    const key = `${e.userId}-${phMonthKey(e.clockInAt)}`;
    minutesByUserMonth.set(
      key,
      (minutesByUserMonth.get(key) ?? 0) +
        entryMinutes(e.clockInAt, e.clockOutAt),
    );
  }

  const rows = [];
  for (const emp of employees) {
    for (const { year, month } of monthPeriods) {
      const label = phMonthLabel(year, month);
      const monthKeyStr = `${year}-${month}`;
      const existing = payouts.find(
        (p) =>
          p.userId === emp.id &&
          p.periodYear === year &&
          p.periodMonth === month,
      );

      const minutesWorked =
        minutesByUserMonth.get(`${emp.id}-${monthKeyStr}`) ?? 0;

      if (existing) {
        rows.push({
          userId: emp.id,
          employeeName: emp.name ?? emp.email,
          year,
          month,
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
        label,
        minutesWorked,
        hourlyRateCents: emp.hourlyRateCents,
        grossPayCents: grossPayFromMinutes(minutesWorked, emp.hourlyRateCents),
        payoutId: null as number | null,
        status: phIsCurrentMonth(year, month)
          ? ("Projected" as const)
          : ("Open" as const),
        canGenerate:
          !phIsCurrentMonth(year, month) &&
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
): Promise<PayrollSlipData | null> {
  const { start, end } = phMonthBounds(year, month);
  const periodLabel = phMonthLabel(year, month);

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
    payout?.status ?? (phIsCurrentMonth(year, month) ? "Projected" : "Open");
  if (!payout && liveMinutes > 0 && !phIsCurrentMonth(year, month)) {
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
    minutesWorked,
    hourlyRateCents,
    grossPayCents,
    status,
    paidAt: payout?.paidAt?.toISOString() ?? null,
    shiftCount: entries.length,
    daysWorked,
    punches,
    daySummaries: buildPayrollSlipDaySummaries(punches),
  };
}
