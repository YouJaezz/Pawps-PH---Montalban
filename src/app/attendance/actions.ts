"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { timeEntries } from "@/db/schema";
import { requireAuth } from "@/lib/auth-guard";

export type AttendanceActionResult = {
  ok?: boolean;
  error?: string;
  message?: string;
};

function revalidateAttendance() {
  revalidatePath("/attendance");
  revalidatePath("/payroll");
}

export async function clockIn(
  _prev: AttendanceActionResult | null,
  _formData: FormData,
): Promise<AttendanceActionResult> {
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
