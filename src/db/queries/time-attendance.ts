import { cache } from "react";
import { and, desc, eq, gte, isNull, lt } from "drizzle-orm";

import { db } from "@/db";
import { timeEntries, users } from "@/db/schema";
import { phMonthBounds, phMonthLabel, phNow } from "@/lib/ph-time";
import { entryMinutes } from "@/lib/time-duration";

export { entryMinutes, formatDuration } from "@/lib/time-duration";

export async function getUserOpenShift(userId: number) {
  const [row] = await db
    .select({
      id: timeEntries.id,
      clockInAt: timeEntries.clockInAt,
    })
    .from(timeEntries)
    .where(and(eq(timeEntries.userId, userId), isNull(timeEntries.clockOutAt)))
    .orderBy(desc(timeEntries.clockInAt))
    .limit(1);
  return row ?? null;
}

export async function getActiveShifts() {
  const rows = await db
    .select({
      entryId: timeEntries.id,
      userId: timeEntries.userId,
      clockInAt: timeEntries.clockInAt,
      name: users.name,
      email: users.email,
    })
    .from(timeEntries)
    .innerJoin(users, eq(timeEntries.userId, users.id))
    .where(and(isNull(timeEntries.clockOutAt), eq(users.active, true)))
    .orderBy(timeEntries.clockInAt);

  return rows.map((r) => ({
    entryId: r.entryId,
    userId: r.userId,
    clockInAt: r.clockInAt.toISOString(),
    name: r.name ?? r.email,
  }));
}

export const getAttendancePageData = cache(
  async (viewerUserId: number, adminView: boolean) => {
    const { year, month } = phNow();
    const { start, end } = phMonthBounds(year, month);
    const monthLabel = phMonthLabel(year, month);

    const [openEntry, monthEntries, employeeRows, selfRow] = await Promise.all([
      db
        .select()
        .from(timeEntries)
        .where(
          and(eq(timeEntries.userId, viewerUserId), isNull(timeEntries.clockOutAt)),
        )
        .orderBy(desc(timeEntries.clockInAt))
        .limit(1)
        .then((rows) => rows[0] ?? null),
      db
        .select({
          id: timeEntries.id,
          userId: timeEntries.userId,
          clockInAt: timeEntries.clockInAt,
          clockOutAt: timeEntries.clockOutAt,
          notes: timeEntries.notes,
        })
        .from(timeEntries)
        .where(
          adminView
            ? and(
                gte(timeEntries.clockInAt, start),
                lt(timeEntries.clockInAt, end),
              )
            : and(
                eq(timeEntries.userId, viewerUserId),
                gte(timeEntries.clockInAt, start),
                lt(timeEntries.clockInAt, end),
              ),
        )
        .orderBy(desc(timeEntries.clockInAt)),
      adminView
        ? db
            .select({
              id: users.id,
              name: users.name,
              email: users.email,
              hourlyRateCents: users.hourlyRateCents,
            })
            .from(users)
            .where(eq(users.active, true))
            .orderBy(users.name)
        : Promise.resolve([]),
      db
        .select({ name: users.name, email: users.email })
        .from(users)
        .where(eq(users.id, viewerUserId))
        .limit(1)
        .then((rows) => rows[0] ?? null),
    ]);

    const userNameById = new Map<number, string>();
    for (const u of employeeRows) {
      userNameById.set(u.id, u.name ?? u.email);
    }
    if (selfRow) userNameById.set(viewerUserId, selfRow.name ?? selfRow.email);

    let monthMinutes = 0;
    for (const e of monthEntries.filter((x) => x.userId === viewerUserId)) {
      monthMinutes += entryMinutes(e.clockInAt, e.clockOutAt);
    }

    const activeShifts = adminView ? await getActiveShifts() : [];

    const teamTotals = employeeRows.map((emp) => {
      const entries = monthEntries.filter((e) => e.userId === emp.id);
      const minutes = entries.reduce(
        (sum, e) => sum + entryMinutes(e.clockInAt, e.clockOutAt),
        0,
      );
      return {
        userId: emp.id,
        name: emp.name ?? emp.email,
        minutes,
        entryCount: entries.length,
        hourlyRateCents: emp.hourlyRateCents,
      };
    });

    return {
      year,
      month,
      monthLabel,
      openEntry,
      monthMinutes,
      monthEntries: monthEntries.map((e) => ({
        ...e,
        minutes: entryMinutes(e.clockInAt, e.clockOutAt),
        employeeName: userNameById.get(e.userId) ?? `#${e.userId}`,
      })),
      teamTotals,
      activeShifts,
      employees: employeeRows,
    };
  },
);
