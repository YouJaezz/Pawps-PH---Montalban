import { NextResponse } from "next/server";

import { db } from "@/db";
import { transportJobs } from "@/db/schema";
import { getOsrmDrivingRoute } from "@/lib/osrm-routing";
import {
  driverPointFromJob,
  resolveTransportJobCoords,
} from "@/lib/transport-job-coords";
import { eq } from "drizzle-orm";

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;

  const [job] = await db
    .select({
      id: transportJobs.id,
      customerName: transportJobs.customerName,
      pickupLocation: transportJobs.pickupLocation,
      dropoffLocation: transportJobs.dropoffLocation,
      pickupLat: transportJobs.pickupLat,
      pickupLng: transportJobs.pickupLng,
      dropoffLat: transportJobs.dropoffLat,
      dropoffLng: transportJobs.dropoffLng,
      status: transportJobs.status,
      driverLat: transportJobs.driverLat,
      driverLng: transportJobs.driverLng,
      lastLocationAt: transportJobs.lastLocationAt,
    })
    .from(transportJobs)
    .where(eq(transportJobs.trackingToken, token))
    .limit(1);

  if (!job) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { pickup, dropoff } = await resolveTransportJobCoords(job);
  const driver = driverPointFromJob(job);

  let routePath: [number, number][] = [];
  let routeKind: "remaining" | "planned" | null = null;

  if (driver && dropoff) {
    const route = await getOsrmDrivingRoute(driver, dropoff);
    if (route) {
      routePath = route.path;
      routeKind = "remaining";
    }
  } else if (pickup && dropoff) {
    const route = await getOsrmDrivingRoute(pickup, dropoff);
    if (route) {
      routePath = route.path;
      routeKind = "planned";
    }
  }

  return NextResponse.json({
    pickup,
    dropoff,
    driver,
    routePath,
    routeKind,
    status: job.status,
    customerName: job.customerName,
    pickupLocation: job.pickupLocation,
    dropoffLocation: job.dropoffLocation,
    lastLocationAt: job.lastLocationAt?.toISOString() ?? null,
  });
}
