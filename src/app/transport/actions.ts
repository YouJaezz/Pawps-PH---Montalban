"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { transportJobs } from "@/db/schema";
import { requireAuth } from "@/lib/auth-guard";

function parseMoneyToCents(value: FormDataEntryValue | null) {
  const str = typeof value === "string" ? value.trim() : "";
  const n = Number(str);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export async function createTransportJob(formData: FormData) {
  await requireAuth();

  const customerName = String(formData.get("customerName") ?? "").trim();
  const contactRaw = String(formData.get("contact") ?? "").trim();
  const pickupLocation = String(formData.get("pickupLocation") ?? "").trim();
  const dropoffLocation = String(formData.get("dropoffLocation") ?? "").trim();
  const petDetailsRaw = String(formData.get("petDetails") ?? "").trim();
  const serviceType = String(formData.get("serviceType") ?? "Pet Taxi");
  const status = String(formData.get("status") ?? "Requested");
  const fee = parseMoneyToCents(formData.get("fee"));
  const notesRaw = String(formData.get("notes") ?? "").trim();

  if (!customerName || !pickupLocation || !dropoffLocation) {
    throw new Error("Customer name, pickup, and dropoff are required.");
  }

  await db.insert(transportJobs).values({
    customerName,
    contact: contactRaw.length ? contactRaw : null,
    pickupLocation,
    dropoffLocation,
    petDetails: petDetailsRaw.length ? petDetailsRaw : null,
    serviceType: serviceType as
      | "Pet Taxi"
      | "Vet Visit"
      | "Grooming Visit"
      | "Boarding Transfer"
      | "Other",
    status: status as
      | "Requested"
      | "Scheduled"
      | "In Transit"
      | "Completed"
      | "Cancelled",
    fee,
    notes: notesRaw.length ? notesRaw : null,
  });

  revalidatePath("/transport");
}

