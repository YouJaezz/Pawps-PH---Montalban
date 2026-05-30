import { NextResponse } from "next/server";

import { db } from "@/db";
import { transportJobs } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;

  const [job] = await db
    .select({
      customerName: transportJobs.customerName,
      pickupLocation: transportJobs.pickupLocation,
      dropoffLocation: transportJobs.dropoffLocation,
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

  return NextResponse.json({
    ...job,
    lastLocationAt: job.lastLocationAt?.toISOString() ?? null,
  });
}
