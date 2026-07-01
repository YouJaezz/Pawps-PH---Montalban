"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { deliveryLogs, deliveryStatusHistory } from "@/db/schema";
import { requireAuth } from "@/lib/auth-guard";

function parseMoneyToCents(value: FormDataEntryValue | null) {
  const str = typeof value === "string" ? value.trim() : "";
  const n = Number(str);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export async function createDeliveryLog(formData: FormData) {
  await requireAuth();

  const orderIdRaw = String(formData.get("orderId") ?? "").trim();
  const orderId = orderIdRaw ? Number.parseInt(orderIdRaw, 10) : null;
  const customerNameRaw = String(formData.get("customerName") ?? "").trim();
  const locationRaw = String(formData.get("location") ?? "").trim();
  const deliveryMethod = String(
    formData.get("deliveryMethod") ?? "Montalban Free Delivery",
  );
  const status = String(formData.get("status") ?? "Queued");
  const fee = parseMoneyToCents(formData.get("fee"));
  const referenceRaw = String(formData.get("reference") ?? "").trim();
  const notesRaw = String(formData.get("notes") ?? "").trim();

  if (!deliveryMethod) throw new Error("Delivery method is required.");

  const safeOrderId =
    orderId != null && Number.isFinite(orderId) ? orderId : null;

  const inserted = await db
    .insert(deliveryLogs)
    .values({
      orderId: safeOrderId,
      customerName: customerNameRaw.length ? customerNameRaw : null,
      location: locationRaw.length ? locationRaw : null,
      deliveryMethod: deliveryMethod as
        | "Montalban Free Delivery"
        | "Lalamove"
        | "Other",
      status: status as
        | "Queued"
        | "Booked"
        | "Picked Up"
        | "Delivered"
        | "Cancelled",
      fee,
      reference: referenceRaw.length ? referenceRaw : null,
      notes: notesRaw.length ? notesRaw : null,
    })
    .returning({ id: deliveryLogs.id });

  const logId = inserted[0]?.id;
  if (logId) {
    await db.insert(deliveryStatusHistory).values({
      deliveryLogId: logId,
      previousStatus: null,
      newStatus: status,
      note: "Created",
    });
  }

  revalidatePath("/delivery");
  revalidatePath("/orders");
}

