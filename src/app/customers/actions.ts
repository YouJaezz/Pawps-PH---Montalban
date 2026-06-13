"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { customers } from "@/db/schema";
import { requireAuth } from "@/lib/auth-guard";
import { eq } from "drizzle-orm";

export type CustomerActionResult = {
  ok?: boolean;
  error?: string;
};

export async function createCustomer(formData: FormData) {
  await requireAuth();

  const name = String(formData.get("name") ?? "").trim();
  const contactRaw = String(formData.get("contact") ?? "").trim();
  const locationRaw = String(formData.get("location") ?? "").trim();

  if (!name) throw new Error("Customer name is required.");

  await db.insert(customers).values({
    name,
    contact: contactRaw.length ? contactRaw : null,
    location: locationRaw.length ? locationRaw : null,
  });

  revalidatePath("/customers");
}

export async function updateCustomer(
  _prev: CustomerActionResult | null,
  formData: FormData,
): Promise<CustomerActionResult> {
  try {
    await requireAuth();

    const customerId = Number.parseInt(String(formData.get("customerId") ?? ""), 10);
    const name = String(formData.get("name") ?? "").trim();
    const contactRaw = String(formData.get("contact") ?? "").trim();
    const locationRaw = String(formData.get("location") ?? "").trim();

    if (!Number.isFinite(customerId) || customerId <= 0) {
      return { error: "Invalid customer." };
    }
    if (!name) return { error: "Customer name is required." };

    const updated = await db
      .update(customers)
      .set({
        name,
        contact: contactRaw.length ? contactRaw : null,
        location: locationRaw.length ? locationRaw : null,
      })
      .where(eq(customers.id, customerId))
      .returning({ id: customers.id });

    if (updated.length === 0) return { error: "Customer not found." };

    revalidatePath("/customers");
    revalidatePath("/orders");
    return { ok: true };
  } catch (err) {
    console.error("updateCustomer failed:", err);
    return {
      error: err instanceof Error ? err.message : "Could not update customer.",
    };
  }
}

