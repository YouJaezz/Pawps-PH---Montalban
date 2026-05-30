import { NextResponse } from "next/server";

import { getOsrmDrivingRoute } from "@/lib/osrm-routing";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pickupLat = Number.parseFloat(searchParams.get("pickupLat") ?? "");
  const pickupLng = Number.parseFloat(searchParams.get("pickupLng") ?? "");
  const dropoffLat = Number.parseFloat(searchParams.get("dropoffLat") ?? "");
  const dropoffLng = Number.parseFloat(searchParams.get("dropoffLng") ?? "");

  if (
    !Number.isFinite(pickupLat) ||
    !Number.isFinite(pickupLng) ||
    !Number.isFinite(dropoffLat) ||
    !Number.isFinite(dropoffLng)
  ) {
    return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
  }

  const route = await getOsrmDrivingRoute(
    { lat: pickupLat, lng: pickupLng },
    { lat: dropoffLat, lng: dropoffLng },
  );

  if (!route) {
    return NextResponse.json({ error: "Route not found" }, { status: 404 });
  }

  return NextResponse.json(route);
}
