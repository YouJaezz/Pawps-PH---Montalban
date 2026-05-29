"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { transportJobs } from "@/db/schema";
import { requireAuth } from "@/lib/auth-guard";
import { eq } from "drizzle-orm";

export async function deleteTransportJob(formData: FormData) {
  await requireAuth();

  const id = Number.parseInt(String(formData.get("id") ?? ""), 10);
  if (!Number.isFinite(id) || id <= 0) throw new Error("Invalid transport job.");

  await db.delete(transportJobs).where(eq(transportJobs.id, id));
  revalidatePath("/transport");
}

