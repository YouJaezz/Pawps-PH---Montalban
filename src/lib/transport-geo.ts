/** Road distance factor applied to straight-line km (typical urban PH routes). */
export const ROAD_DISTANCE_FACTOR = 1.3;

/** Haversine distance in km between two lat/lng points. */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function roundKm(km: number) {
  return Math.round(km * 10) / 10;
}

export function estimateRoadKmFromCoords(
  pickup: { lat: number; lng: number },
  dropoff: { lat: number; lng: number },
) {
  const straightKm = haversineKm(pickup.lat, pickup.lng, dropoff.lat, dropoff.lng);
  const roadKm = straightKm * ROAD_DISTANCE_FACTOR;
  return {
    straightKm: roundKm(straightKm),
    roadKm: roundKm(roadKm),
  };
}

export type GeoPoint = { lat: number; lng: number; label: string };
