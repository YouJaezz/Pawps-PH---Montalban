"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { customers } from "@/db/schema";
import { requireAdmin } from "@/lib/auth-guard";
import { eq } from "drizzle-orm";

export async function deleteCustomer(formData: FormData) {
  await requireAdmin();

  const customerId = Number.parseInt(String(formData.get("customerId") ?? ""), 10);
  if (!Number.isFinite(customerId) || customerId <= 0) {
    throw new Error("Invalid customer.");
  }

  await db.delete(customers).where(eq(customers.id, customerId));
  revalidatePath("/customers");
}

