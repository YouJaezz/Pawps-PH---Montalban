type GeocodeResult = { lat: number; lng: number } | null;

const USER_AGENT = "PawpsPH-Transport/1.0";

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
      headers: { "User-Agent": USER_AGENT },
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

export type GeocodeSearchHit = {
  lat: number;
  lng: number;
  label: string;
};

export async function searchAddresses(
  query: string,
  limit = 5,
): Promise<GeocodeSearchHit[]> {
  const q = query.trim();
  if (q.length < 3) return [];

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", `${q}, Philippines`);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("addressdetails", "1");

  try {
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": USER_AGENT },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      lat: string;
      lon: string;
      display_name: string;
    }[];
    return data.map((row) => ({
      lat: Number.parseFloat(row.lat),
      lng: Number.parseFloat(row.lon),
      label: row.display_name,
    }));
  } catch {
    return [];
  }
}

export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<string | null> {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("format", "json");

  try {
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": USER_AGENT },
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { display_name?: string };
    return data.display_name ?? null;
  } catch {
    return null;
  }
}
