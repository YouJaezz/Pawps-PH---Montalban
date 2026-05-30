import {
  countRouteIntersections,
  estimateTravelTime,
  type TravelTimeEstimate,
} from "@/lib/travel-time-estimate";
import { roundKm } from "@/lib/transport-geo";

/** Free driving routes via OSRM (OpenStreetMap road data). */
const OSRM_BASE = "https://router.project-osrm.org/route/v1/driving";

export type DrivingRouteResult = {
  distanceKm: number;
  distanceMeters: number;
  /** Total trip time incl. traffic + stop lights. */
  durationMinutes: number | null;
  travelTime: TravelTimeEstimate;
  /** Leaflet-ready [lat, lng] pairs along the road network. */
  path: [number, number][];
};

export async function getOsrmDrivingRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
): Promise<DrivingRouteResult | null> {
  const coordPath = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
  const url = `${OSRM_BASE}/${coordPath}?overview=full&geometries=geojson&steps=true`;

  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return null;

    const data = (await res.json()) as {
      code?: string;
      routes?: {
        distance: number;
        duration: number;
        geometry?: { coordinates?: [number, number][] };
        legs?: { steps?: { maneuver?: { type?: string } }[] }[];
      }[];
    };

    if (data.code !== "Ok" || !data.routes?.[0]) return null;

    const route = data.routes[0];
    const raw = route.geometry?.coordinates ?? [];
    const path: [number, number][] = raw.map(([lng, lat]) => [lat, lng]);

    const steps = route.legs?.flatMap((leg) => leg.steps ?? []) ?? [];
    const intersectionCount = countRouteIntersections(steps);
    const travelTime = estimateTravelTime(route.duration, intersectionCount);

    return {
      distanceMeters: route.distance,
      distanceKm: roundKm(route.distance / 1000),
      durationMinutes: travelTime.totalEstimatedMinutes,
      travelTime,
      path,
    };
  } catch {
    return null;
  }
}
