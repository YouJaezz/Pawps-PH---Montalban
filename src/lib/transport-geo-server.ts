import { geocodeAddress } from "@/lib/geocode-server";
import { estimateRoadKmFromCoords } from "@/lib/transport-geo";

type GeocodeResult = { lat: number; lng: number } | null;

export async function estimateRouteKm(
  pickup: string,
  dropoff: string,
): Promise<{ km: number | null; pickup: GeocodeResult; dropoff: GeocodeResult }> {
  const [pickupGeo, dropoffGeo] = await Promise.all([
    geocodeAddress(pickup),
    geocodeAddress(dropoff),
  ]);

  if (!pickupGeo || !dropoffGeo) {
    return { km: null, pickup: pickupGeo, dropoff: dropoffGeo };
  }

  const { roadKm } = estimateRoadKmFromCoords(pickupGeo, dropoffGeo);
  return { km: roadKm, pickup: pickupGeo, dropoff: dropoffGeo };
}

export { estimateRoadKmFromCoords, haversineKm, roundKm, ROAD_DISTANCE_FACTOR } from "@/lib/transport-geo";
