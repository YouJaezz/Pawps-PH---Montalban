"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { deliveryLogs } from "@/db/schema";
import { requireAuth } from "@/lib/auth-guard";
import { eq } from "drizzle-orm";

export async function deleteDeliveryLog(formData: FormData) {
  await requireAuth();

  const id = Number.parseInt(String(formData.get("id") ?? ""), 10);
  if (!Number.isFinite(id) || id <= 0) throw new Error("Invalid delivery log.");

  await db.delete(deliveryLogs).where(eq(deliveryLogs.id, id));
  revalidatePath("/delivery");
}

