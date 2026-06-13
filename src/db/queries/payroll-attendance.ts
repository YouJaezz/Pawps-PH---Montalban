import { cache } from "react";
import { and, eq, gte, isNull, lt } from "drizzle-orm";

import { db } from "@/db";
import { timeEntries, users } from "@/db/schema";
import { grossPayFromMinutes } from "@/db/queries/payroll";
import { entryMinutes } from "@/lib/time-duration";
import {
  phCalendarParts,
  phMonthBounds,
  phMonthLabel,
  phNow,
} from "@/lib/ph-time";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function employeeCode(userId: number) {
  return `EMP-${String(userId).padStart(3, "0")}`;
}

function phDateKey(date: Date) {
  const { year, month, day } = phCalendarParts(date);
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function phDateLabel(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(`${y}-${pad2(m!)}-${pad2(d!)}T12:00:00+08:00`).toLocaleDateString(
    "en-PH",
    { weekday: "short", month: "short", day: "numeric", timeZone: "Asia/Manila" },
  );
}

function daysInMonth(year: number, month: number) {
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const last = new Date(`${nextYear}-${pad2(nextMonth)}-01T00:00:00+08:00`);
  last.setTime(last.getTime() - 86_400_000);
  return phCalendarParts(last).day;
}

export type PayrollAttendanceReport = Awaited<
  ReturnType<typeof getPayrollAttendanceReport>
>;

export const getPayrollAttendanceReport = cache(
  async (year: number, month: number) => {
    const { start, end } = phMonthBounds(year, month);
    const monthLabel = phMonthLabel(year, month);
    const dayCount = daysInMonth(year, month);

    const [employees, entries, openShifts] = await Promise.all([
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
        .select({
          id: timeEntries.id,
          userId: timeEntries.userId,
          clockInAt: timeEntries.clockInAt,
          clockOutAt: timeEntries.clockOutAt,
        })
        .from(timeEntries)
        .where(
          and(
            gte(timeEntries.clockInAt, start),
            lt(timeEntries.clockInAt, end),
          ),
        )
        .orderBy(timeEntries.clockInAt),
      db
        .select({
          userId: timeEntries.userId,
          clockInAt: timeEntries.clockInAt,
        })
        .from(timeEntries)
        .innerJoin(users, eq(timeEntries.userId, users.id))
        .where(and(isNull(timeEntries.clockOutAt), eq(users.active, true))),
    ]);

    const onDutyUserIds = new Set(openShifts.map((s) => s.userId));
    const nameById = new Map(
      employees.map((e) => [e.id, e.name ?? e.email] as const),
    );

    const punches = entries.map((e) => {
      const minutes = entryMinutes(e.clockInAt, e.clockOutAt);
      const status = e.clockOutAt
        ? ("Complete" as const)
        : ("On duty" as const);
      return {
        id: e.id,
        userId: e.userId,
        employeeName: nameById.get(e.userId) ?? `#${e.userId}`,
        employeeCode: employeeCode(e.userId),
        clockInAt: e.clockInAt,
        clockOutAt: e.clockOutAt,
        minutes,
        status,
        dateKey: phDateKey(e.clockInAt),
      };
    });

    const staffSummaries = employees.map((emp) => {
      const empPunches = punches.filter((p) => p.userId === emp.id);
      const minutesWorked = empPunches.reduce((sum, p) => sum + p.minutes, 0);
      const daysWorked = new Set(empPunches.map((p) => p.dateKey)).size;
      return {
        userId: emp.id,
        employeeName: emp.name ?? emp.email,
        employeeCode: employeeCode(emp.id),
        role: emp.role,
        minutesWorked,
        shiftCount: empPunches.length,
        daysWorked,
        hourlyRateCents: emp.hourlyRateCents,
        grossPayCents: grossPayFromMinutes(minutesWorked, emp.hourlyRateCents),
        onDuty: onDutyUserIds.has(emp.id),
      };
    });

    const dateKeys: string[] = [];
    for (let d = 1; d <= dayCount; d++) {
      dateKeys.push(`${year}-${pad2(month)}-${pad2(d)}`);
    }

    const dailyGrid = dateKeys.map((dateKey) => {
      const cells = employees.map((emp) => {
        const dayMinutes = punches
          .filter((p) => p.userId === emp.id && p.dateKey === dateKey)
          .reduce((sum, p) => sum + p.minutes, 0);
        return {
          userId: emp.id,
          minutes: dayMinutes,
        };
      });
      const dayTotal = cells.reduce((sum, c) => sum + c.minutes, 0);
      return {
        dateKey,
        dateLabel: phDateLabel(dateKey),
        cells,
        dayTotal,
      };
    });

    const totalMinutes = staffSummaries.reduce((sum, s) => sum + s.minutesWorked, 0);
    const totalShifts = punches.length;
    const staffWithHours = staffSummaries.filter((s) => s.minutesWorked > 0).length;
    const onDutyNow = openShifts.map((s) => ({
      userId: s.userId,
      employeeName: nameById.get(s.userId) ?? `#${s.userId}`,
      employeeCode: employeeCode(s.userId),
      clockInAt: s.clockInAt.toISOString(),
    }));

    const now = phNow();
    const isCurrentMonth = year === now.year && month === now.month;

    return {
      year,
      month,
      monthLabel,
      isCurrentMonth,
      generatedAt: new Date().toISOString(),
      summary: {
        totalMinutes,
        totalShifts,
        staffWithHours,
        staffCount: employees.length,
        onDutyCount: onDutyNow.length,
        avgMinutesPerStaff:
          employees.length > 0 ? Math.round(totalMinutes / employees.length) : 0,
      },
      staffSummaries,
      punches: punches.sort(
        (a, b) => b.clockInAt.getTime() - a.clockInAt.getTime(),
      ),
      dailyGrid,
      onDutyNow,
      employees: employees.map((e) => ({
        id: e.id,
        name: e.name ?? e.email,
        code: employeeCode(e.id),
      })),
    };
  },
);

export function resolvePayrollReportPeriod(
  yearParam?: string,
  monthParam?: string,
) {
  const now = phNow();
  const year = yearParam ? Number(yearParam) : now.year;
  const month = monthParam ? Number(monthParam) : now.month;
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    month < 1 ||
    month > 12 ||
    year < 2020 ||
    year > 2100
  ) {
    return { year: now.year, month: now.month };
  }
  return { year, month };
}
