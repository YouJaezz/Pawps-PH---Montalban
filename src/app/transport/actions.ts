"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { getTransportPricing } from "@/db/queries/transport";
import {
  transportExtras,
  transportJobs,
  transportLocationLogs,
} from "@/db/schema";
import { requireAuth } from "@/lib/auth-guard";
import { getSession } from "@/lib/session";
import { estimateRouteKm } from "@/lib/transport-geo-server";
import {
  calculateTransportFee,
  kmToTenths,
} from "@/lib/transport-pricing";
import { eq } from "drizzle-orm";

function parseMoneyToCents(value: FormDataEntryValue | null) {
  const str = typeof value === "string" ? value.trim() : "";
  const n = Number(str);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

function parseExtras(formData: FormData) {
  const labels = formData.getAll("extraLabel");
  const amounts = formData.getAll("extraAmount");
  const extras: { label: string; amountCents: number }[] = [];

  for (let i = 0; i < labels.length; i++) {
    const label = String(labels[i] ?? "").trim();
    const amountCents = parseMoneyToCents(amounts[i] ?? null);
    if (label && amountCents > 0) {
      extras.push({ label, amountCents });
    }
  }
  return extras;
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
  const notesRaw = String(formData.get("notes") ?? "").trim();
  const distanceKmRaw = String(formData.get("distanceKm") ?? "").trim();
  const manualDistance = Number.parseFloat(distanceKmRaw);
  const autoEstimate = formData.get("autoEstimate") === "on";
  const trafficBufferMinutes = Number.parseInt(
    String(formData.get("trafficBufferMinutes") ?? "0"),
    10,
  );
  const intersectionCount = Number.parseInt(
    String(formData.get("intersectionCount") ?? "0"),
    10,
  );
  const pickupLatRaw = String(formData.get("pickupLat") ?? "").trim();
  const pickupLngRaw = String(formData.get("pickupLng") ?? "").trim();
  const dropoffLatRaw = String(formData.get("dropoffLat") ?? "").trim();
  const dropoffLngRaw = String(formData.get("dropoffLng") ?? "").trim();

  if (!customerName || !pickupLocation || !dropoffLocation) {
    throw new Error("Customer name, pickup, and dropoff are required.");
  }

  const pricing = await getTransportPricing();
  let distanceKm = Number.isFinite(manualDistance) ? manualDistance : 0;

  if (autoEstimate && distanceKm <= 0) {
    const estimate = await estimateRouteKm(pickupLocation, dropoffLocation);
    if (estimate.km != null) distanceKm = estimate.km;
  }

  const extras = parseExtras(formData);
  const extrasTotalCents = extras.reduce((s, e) => s + e.amountCents, 0);
  const feeCalc = calculateTransportFee(pricing, distanceKm, extrasTotalCents, {
    trafficBufferMinutes: Number.isFinite(trafficBufferMinutes)
      ? trafficBufferMinutes
      : 0,
    intersectionCount: Number.isFinite(intersectionCount) ? intersectionCount : 0,
  });

  const trackingToken = randomUUID();
  const receiptNumber = `PPH-T-${Date.now().toString(36).toUpperCase()}`;

  const inserted = await db
    .insert(transportJobs)
    .values({
      customerName,
      contact: contactRaw.length ? contactRaw : null,
      pickupLocation,
      dropoffLocation,
      pickupLat: pickupLatRaw.length ? pickupLatRaw : null,
      pickupLng: pickupLngRaw.length ? pickupLngRaw : null,
      dropoffLat: dropoffLatRaw.length ? dropoffLatRaw : null,
      dropoffLng: dropoffLngRaw.length ? dropoffLngRaw : null,
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
      fee: feeCalc.totalFeeCents,
      distanceKmTenths: kmToTenths(distanceKm),
      baseFeeCents: feeCalc.baseFeeCents,
      distanceFeeCents: feeCalc.distanceFeeCents,
      trafficFeeCents: feeCalc.trafficFeeCents,
      stopLightFeeCents: feeCalc.stopLightFeeCents,
      extrasTotalCents,
      trackingToken,
      receiptNumber,
      notes: notesRaw.length ? notesRaw : null,
    })
    .returning({ id: transportJobs.id });

  const jobId = inserted[0]?.id;
  if (!jobId) throw new Error("Failed to create job.");

  if (extras.length) {
    await db.insert(transportExtras).values(
      extras.map((e) => ({
        transportJobId: jobId,
        label: e.label,
        amountCents: e.amountCents,
      })),
    );
  }

  revalidatePath("/transport");
}

export async function updateTransportStatus(formData: FormData) {
  await requireAuth();

  const id = Number.parseInt(String(formData.get("id") ?? ""), 10);
  const status = String(formData.get("status") ?? "");

  if (!Number.isFinite(id) || id <= 0) throw new Error("Invalid job.");

  await db
    .update(transportJobs)
    .set({
      status: status as
        | "Requested"
        | "Scheduled"
        | "In Transit"
        | "Completed"
        | "Cancelled",
    })
    .where(eq(transportJobs.id, id));

  revalidatePath("/transport");
  revalidatePath(`/transport/driver/${id}`);
}

export async function updateDriverLocation(formData: FormData) {
  const id = Number.parseInt(String(formData.get("jobId") ?? ""), 10);
  const lat = String(formData.get("lat") ?? "").trim();
  const lng = String(formData.get("lng") ?? "").trim();
  const token = String(formData.get("token") ?? "").trim();

  if (!Number.isFinite(id) || id <= 0 || !lat || !lng) {
    throw new Error("Invalid location.");
  }

  const [job] = await db
    .select({
      id: transportJobs.id,
      trackingToken: transportJobs.trackingToken,
    })
    .from(transportJobs)
    .where(eq(transportJobs.id, id))
    .limit(1);

  if (!job) throw new Error("Job not found.");

  const session = await getSession();
  if (!session && job.trackingToken !== token) {
    throw new Error("Unauthorized.");
  }

  const now = new Date();
  await db
    .update(transportJobs)
    .set({
      driverLat: lat,
      driverLng: lng,
      lastLocationAt: now,
      status: "In Transit",
    })
    .where(eq(transportJobs.id, id));

  await db.insert(transportLocationLogs).values({
    transportJobId: id,
    lat,
    lng,
    recordedAt: now,
  });

  revalidatePath("/transport");
  revalidatePath(`/transport/driver/${id}`);
  revalidatePath(`/track/${job.trackingToken}`);
}

export async function estimateTransportDistance(formData: FormData) {
  await requireAuth();

  const pickup = String(formData.get("pickup") ?? "").trim();
  const dropoff = String(formData.get("dropoff") ?? "").trim();
  const estimate = await estimateRouteKm(pickup, dropoff);
  return estimate;
}
