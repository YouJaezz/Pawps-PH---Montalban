import { db } from "@/db";
import { transportJobs } from "@/db/schema";
import { geocodeAddress } from "@/lib/geocode-server";
import { eq } from "drizzle-orm";

export type MapPoint = { lat: number; lng: number };

function parseCoord(value: string | null | undefined) {
  if (!value) return null;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

export function coordsFromJob(job: {
  pickupLat: string | null;
  pickupLng: string | null;
  dropoffLat: string | null;
  dropoffLng: string | null;
}) {
  const pickupLat = parseCoord(job.pickupLat);
  const pickupLng = parseCoord(job.pickupLng);
  const dropoffLat = parseCoord(job.dropoffLat);
  const dropoffLng = parseCoord(job.dropoffLng);

  return {
    pickup:
      pickupLat != null && pickupLng != null
        ? { lat: pickupLat, lng: pickupLng }
        : null,
    dropoff:
      dropoffLat != null && dropoffLng != null
        ? { lat: dropoffLat, lng: dropoffLng }
        : null,
  };
}

export async function resolveTransportJobCoords(job: {
  id: number;
  pickupLocation: string;
  dropoffLocation: string;
  pickupLat: string | null;
  pickupLng: string | null;
  dropoffLat: string | null;
  dropoffLng: string | null;
}) {
  const existing = coordsFromJob(job);
  let pickup = existing.pickup;
  let dropoff = existing.dropoff;
  const updates: Partial<{
    pickupLat: string;
    pickupLng: string;
    dropoffLat: string;
    dropoffLng: string;
  }> = {};

  if (!pickup) {
    const geo = await geocodeAddress(job.pickupLocation);
    if (geo) {
      pickup = geo;
      updates.pickupLat = String(geo.lat);
      updates.pickupLng = String(geo.lng);
    }
  }

  if (!dropoff) {
    const geo = await geocodeAddress(job.dropoffLocation);
    if (geo) {
      dropoff = geo;
      updates.dropoffLat = String(geo.lat);
      updates.dropoffLng = String(geo.lng);
    }
  }

  if (Object.keys(updates).length > 0) {
    await db.update(transportJobs).set(updates).where(eq(transportJobs.id, job.id));
  }

  return { pickup, dropoff };
}

export function driverPointFromJob(job: {
  driverLat: string | null;
  driverLng: string | null;
}) {
  const lat = parseCoord(job.driverLat);
  const lng = parseCoord(job.driverLng);
  if (lat == null || lng == null) return null;
  return { lat, lng };
}
