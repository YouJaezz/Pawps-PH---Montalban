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

type GeocodeResult = { lat: number; lng: number } | null;

/** Free geocoding via OpenStreetMap Nominatim (Philippines-biased). */
export async function geocodeAddress(address: string): Promise<GeocodeResult> {
  const q = address.trim();
  if (!q) return null;

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", `${q}, Philippines`);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");

  try {
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": "PawpsPH-Transport/1.0" },
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { lat: string; lon: string }[];
    if (!data[0]) return null;
    return {
      lat: Number.parseFloat(data[0].lat),
      lng: Number.parseFloat(data[0].lon),
    };
  } catch {
    return null;
  }
}

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

  const km = haversineKm(
    pickupGeo.lat,
    pickupGeo.lng,
    dropoffGeo.lat,
    dropoffGeo.lng,
  );

  return { km: Math.round(km * 1.3 * 10) / 10, pickup: pickupGeo, dropoff: dropoffGeo };
}
