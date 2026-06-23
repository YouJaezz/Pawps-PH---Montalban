"use server";

import { revalidatePath } from "next/cache";
import { and, eq, gt, isNull, lt, ne, or } from "drizzle-orm";

import { db } from "@/db";
import { attendanceSettings, timeEntries } from "@/db/schema";
import {
  formatCutoffLabel,
  getAttendanceSettings,
  isStaffAttendanceLocked,
  parseCutoffTimeInput,
  runAutoClockOut,
} from "@/db/queries/attendance-settings";
import { requireAdmin, requireAuth } from "@/lib/auth-guard";
import { isAdmin } from "@/lib/roles";
import { parsePhDatetimeLocal } from "@/lib/ph-time";

export type AttendanceActionResult = {
  ok?: boolean;
  error?: string;
  message?: string;
};

function revalidateAttendance() {
  revalidatePath("/attendance");
  revalidatePath("/payroll");
}

async function staffAttendanceBlocked() {
  const session = await requireAuth();
  if (isAdmin(session.role)) return null;

  await runAutoClockOut();
  const settings = await getAttendanceSettings();
  if (!isStaffAttendanceLocked(settings)) return null;

  return {
    error: `Time clock is closed until tomorrow. Everyone was auto timed-out at ${formatCutoffLabel(settings)} (PH).`,
  } satisfies AttendanceActionResult;
}

export async function clockIn(
  _prev: AttendanceActionResult | null,
  _formData: FormData,
): Promise<AttendanceActionResult> {
  const blocked = await staffAttendanceBlocked();
  if (blocked) return blocked;

  const session = await requireAuth();

  const [open] = await db
    .select({ id: timeEntries.id })
    .from(timeEntries)
    .where(
      and(eq(timeEntries.userId, session.userId), isNull(timeEntries.clockOutAt)),
    )
    .limit(1);

  if (open) {
    return { error: "You are already clocked in. Clock out first." };
  }

  await db.insert(timeEntries).values({
    userId: session.userId,
    clockInAt: new Date(),
  });

  revalidateAttendance();
  return { ok: true, message: "Clocked in — have a great shift!" };
}

export async function clockOut(
  _prev: AttendanceActionResult | null,
  _formData: FormData,
): Promise<AttendanceActionResult> {
  const blocked = await staffAttendanceBlocked();
  if (blocked) return blocked;

  const session = await requireAuth();

  const [open] = await db
    .select({ id: timeEntries.id })
    .from(timeEntries)
    .where(
      and(eq(timeEntries.userId, session.userId), isNull(timeEntries.clockOutAt)),
    )
    .limit(1);

  if (!open) {
    return { error: "You are not clocked in." };
  }

  await db
    .update(timeEntries)
    .set({ clockOutAt: new Date() })
    .where(eq(timeEntries.id, open.id));

  revalidateAttendance();
  return { ok: true, message: "Clocked out — see you next time!" };
}

export async function updateAttendanceSettings(
  _prev: AttendanceActionResult | null,
  formData: FormData,
): Promise<AttendanceActionResult> {
  await requireAdmin();

  const autoCutoffEnabled = formData.get("autoCutoffEnabled") === "on";
  const cutoffRaw = String(formData.get("cutoffTime") ?? "");
  const parsed = parseCutoffTimeInput(cutoffRaw);
  if (!parsed) {
    return { error: "Enter a valid cutoff time (HH:MM, 24-hour)." };
  }

  await db
    .insert(attendanceSettings)
    .values({
      id: 1,
      autoCutoffEnabled,
      cutoffHour: parsed.hour,
      cutoffMinute: parsed.minute,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: attendanceSettings.id,
      set: {
        autoCutoffEnabled,
        cutoffHour: parsed.hour,
        cutoffMinute: parsed.minute,
        updatedAt: new Date(),
      },
    });

  revalidateAttendance();
  return {
    ok: true,
    message: `Attendance settings saved — auto time-out at ${formatCutoffLabel({
      cutoffHour: parsed.hour,
      cutoffMinute: parsed.minute,
    })} (PH).`,
  };
}

function appendAdminNote(existing: string | null, editorName: string) {
  const line = `Adjusted by ${editorName}`;
  const prev = existing?.trim();
  if (!prev) return line;
  if (prev.includes(line)) return prev;
  return `${prev}\n${line}`;
}

export async function updateTimeEntry(
  _prev: AttendanceActionResult | null,
  formData: FormData,
): Promise<AttendanceActionResult> {
  const session = await requireAdmin();

  const entryId = Number.parseInt(String(formData.get("entryId") ?? ""), 10);
  const clockInRaw = String(formData.get("clockInAt") ?? "").trim();
  const clockOutRaw = String(formData.get("clockOutAt") ?? "").trim();

  if (!Number.isFinite(entryId) || entryId <= 0) {
    return { error: "Invalid time entry." };
  }

  const clockInAt = parsePhDatetimeLocal(clockInRaw);
  if (!clockInAt) {
    return { error: "Invalid time in. Use the date/time picker." };
  }

  const clockOutAt = clockOutRaw ? parsePhDatetimeLocal(clockOutRaw) : null;
  if (clockOutRaw && !clockOutAt) {
    return { error: "Invalid time out. Use the date/time picker." };
  }

  if (clockOutAt && clockOutAt.getTime() <= clockInAt.getTime()) {
    return { error: "Time out must be after time in." };
  }

  const [entry] = await db
    .select({
      id: timeEntries.id,
      userId: timeEntries.userId,
      notes: timeEntries.notes,
    })
    .from(timeEntries)
    .where(eq(timeEntries.id, entryId))
    .limit(1);

  if (!entry) return { error: "Time entry not found." };

  if (clockOutAt) {
    const overlaps = await db
      .select({ id: timeEntries.id })
      .from(timeEntries)
      .where(
        and(
          eq(timeEntries.userId, entry.userId),
          ne(timeEntries.id, entryId),
          lt(timeEntries.clockInAt, clockOutAt),
          or(isNull(timeEntries.clockOutAt), gt(timeEntries.clockOutAt, clockInAt)),
        ),
      )
      .limit(1);

    if (overlaps.length > 0) {
      return {
        error: "These times overlap another shift for this employee.",
      };
    }
  }

  const editorName = session.name ?? session.email;
  await db
    .update(timeEntries)
    .set({
      clockInAt,
      clockOutAt,
      notes: appendAdminNote(entry.notes, editorName),
    })
    .where(eq(timeEntries.id, entryId));

  revalidateAttendance();
  return { ok: true, message: "Time entry updated." };
}
