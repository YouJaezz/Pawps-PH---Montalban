"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { deliveryLogs, deliveryStatusHistory } from "@/db/schema";
import { requireAuth } from "@/lib/auth-guard";
import { eq } from "drizzle-orm";

function parseMoneyToCents(value: FormDataEntryValue | null) {
  const str = typeof value === "string" ? value.trim() : "";
  const n = Number(str);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

const deliveryStatuses = [
  "Queued",
  "Booked",
  "Picked Up",
  "Delivered",
  "Cancelled",
] as const;

export async function updateDeliveryLog(formData: FormData) {
  await requireAuth();

  const id = Number.parseInt(String(formData.get("id") ?? ""), 10);
  const status = String(formData.get("status") ?? "");
  const fee = parseMoneyToCents(formData.get("fee"));
  const reference = String(formData.get("reference") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const note = String(formData.get("historyNote") ?? "").trim();

  if (!Number.isFinite(id) || id <= 0) throw new Error("Invalid delivery log.");

  const [existing] = await db
    .select({ status: deliveryLogs.status })
    .from(deliveryLogs)
    .where(eq(deliveryLogs.id, id))
    .limit(1);

  if (!existing) throw new Error("Delivery log not found.");

  const safeStatus = deliveryStatuses.includes(
    status as (typeof deliveryStatuses)[number],
  )
    ? (status as (typeof deliveryStatuses)[number])
    : existing.status;

  await db
    .update(deliveryLogs)
    .set({
      status: safeStatus,
      fee,
      reference: reference || null,
      notes: notes || null,
    })
    .where(eq(deliveryLogs.id, id));

  if (existing.status !== safeStatus) {
    await db.insert(deliveryStatusHistory).values({
      deliveryLogId: id,
      previousStatus: existing.status,
      newStatus: safeStatus,
      note: note || null,
    });
  }

  revalidatePath("/delivery");
}

export async function getDeliveryHistory(deliveryLogId: number) {
  await requireAuth();
  return db
    .select()
    .from(deliveryStatusHistory)
    .where(eq(deliveryStatusHistory.deliveryLogId, deliveryLogId))
    .orderBy(deliveryStatusHistory.changedAt);
}
