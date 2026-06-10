import { cache } from "react";
import { and, desc, eq, gte, lt } from "drizzle-orm";

import { db } from "@/db";
import { payrollPayouts, timeEntries, users } from "@/db/schema";
import { entryMinutes } from "@/db/queries/time-attendance";
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
