import { eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { attendanceSettings, timeEntries } from "@/db/schema";
import {
  cutoffDateTimeForDay,
  type AttendanceCutoffSettings,
} from "@/lib/attendance-cutoff";
import { phCalendarParts } from "@/lib/ph-time";

export type AttendanceSettings = AttendanceCutoffSettings & {
  id: number;
  updatedAt: Date;
};

const DEFAULT_SETTINGS: AttendanceSettings = {
  id: 1,
  autoCutoffEnabled: true,
  cutoffHour: 19,
  cutoffMinute: 30,
  updatedAt: new Date(),
};

export async function getAttendanceSettings(): Promise<AttendanceSettings> {
  const [row] = await db
    .select()
    .from(attendanceSettings)
    .where(eq(attendanceSettings.id, 1))
    .limit(1);

  return row ?? DEFAULT_SETTINGS;
}

function appendNote(existing: string | null, line: string) {
  const prev = existing?.trim();
  if (!prev) return line;
  if (prev.includes(line)) return prev;
  return `${prev}\n${line}`;
}

function autoClockOutNote(cutoff: Date) {
  const label = cutoff.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  });
  return `Auto time-out at ${label} (PH)`;
}

/** Close forgotten open shifts at the daily cutoff (PH time). */
export async function runAutoClockOut() {
  const settings = await getAttendanceSettings();
  if (!settings.autoCutoffEnabled) return 0;

  const now = new Date();
  const openRows = await db
    .select({
      id: timeEntries.id,
      clockInAt: timeEntries.clockInAt,
      notes: timeEntries.notes,
    })
    .from(timeEntries)
    .where(isNull(timeEntries.clockOutAt));

  let closed = 0;
  for (const row of openRows) {
    const inDay = phCalendarParts(row.clockInAt);
    const cutoff = cutoffDateTimeForDay(
      settings,
      inDay.year,
      inDay.month,
      inDay.day,
    );

    if (now.getTime() < cutoff.getTime()) continue;
    if (row.clockInAt.getTime() >= cutoff.getTime()) continue;

    await db
      .update(timeEntries)
      .set({
        clockOutAt: cutoff,
        notes: appendNote(row.notes, autoClockOutNote(cutoff)),
      })
      .where(eq(timeEntries.id, row.id));
    closed += 1;
  }

  return closed;
}

export {
  cutoffTimeInputValue,
  formatCutoffLabel,
  isStaffAttendanceLocked,
  nextAttendanceUnlockLabel,
  parseCutoffTimeInput,
} from "@/lib/attendance-cutoff";
