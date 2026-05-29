"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { customers } from "@/db/schema";

export async function createCustomer(formData: FormData) {
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

