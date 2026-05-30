type GeocodeResult = { lat: number; lng: number } | null;

const USER_AGENT = "PawpsPH-Transport/1.0 (contact: pawps-ph-montalban)";

/** Rizal / Montalban / NCR area — prefer local results. */
const PH_VIEWBOX = {
  minLon: 120.85,
  maxLat: 15.05,
  maxLon: 121.45,
  minLat: 14.35,
};

/** Center of service area (Montalban / Rizal). */
export const PH_MAP_CENTER = { lat: 14.72, lng: 121.15 };

function buildNominatimSearchUrl(query: string, limit: number) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("countrycodes", "ph");
  url.searchParams.set(
    "viewbox",
    `${PH_VIEWBOX.minLon},${PH_VIEWBOX.maxLat},${PH_VIEWBOX.maxLon},${PH_VIEWBOX.minLat}`,
  );
  url.searchParams.set("bounded", "0");
  return url;
}

function formatShortLabel(displayName: string) {
  const parts = displayName.split(",").map((p) => p.trim());
  if (parts.length <= 4) return displayName;
  return parts.slice(0, 4).join(", ");
}

async function fetchNominatim(url: URL) {
  const res = await fetch(url.toString(), {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
      "Accept-Language": "en",
    },
    cache: "no-store",
  });
  if (!res.ok) return [];
  return (await res.json()) as {
    lat: string;
    lon: string;
    display_name: string;
  }[];
}

async function searchPhoton(query: string, limit: number) {
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("lang", "en");
  url.searchParams.set("lat", String(PH_MAP_CENTER.lat));
  url.searchParams.set("lon", String(PH_MAP_CENTER.lng));

  try {
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      features: {
        geometry: { coordinates: [number, number] };
        properties: {
          name?: string;
          street?: string;
          city?: string;
          state?: string;
          country?: string;
        };
      }[];
    };

    return data.features
      .filter((f) => f.properties.country === "Philippines" || !f.properties.country)
      .map((f) => {
        const [lng, lat] = f.geometry.coordinates;
        const p = f.properties;
        const label = [p.name, p.street, p.city, p.state, "Philippines"]
          .filter(Boolean)
          .join(", ");
        return {
          lat,
          lng,
          label: label || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        };
      });
  } catch {
    return [];
  }
}

/** Free geocoding via OpenStreetMap Nominatim (Philippines-biased). */
export async function geocodeAddress(address: string): Promise<GeocodeResult> {
  const q = address.trim();
  if (!q) return null;

  const queries = [q, `${q}, Rizal, Philippines`, `${q}, Philippines`];

  for (const query of queries) {
    const rows = await fetchNominatim(buildNominatimSearchUrl(query, 1));
    if (rows[0]) {
      return {
        lat: Number.parseFloat(rows[0].lat),
        lng: Number.parseFloat(rows[0].lon),
      };
    }
  }

  const photon = await searchPhoton(q, 1);
  return photon[0] ? { lat: photon[0].lat, lng: photon[0].lng } : null;
}

export type GeocodeSearchHit = {
  lat: number;
  lng: number;
  label: string;
};

export async function searchAddresses(
  query: string,
  limit = 6,
): Promise<GeocodeSearchHit[]> {
  const q = query.trim();
  if (q.length < 3) return [];

  const seen = new Set<string>();
  const hits: GeocodeSearchHit[] = [];

  function addHit(hit: GeocodeSearchHit) {
    const key = `${hit.lat.toFixed(5)},${hit.lng.toFixed(5)}`;
    if (seen.has(key)) return;
    seen.add(key);
    hits.push(hit);
  }

  const nominatimRows = await fetchNominatim(buildNominatimSearchUrl(q, limit));
  for (const row of nominatimRows) {
    addHit({
      lat: Number.parseFloat(row.lat),
      lng: Number.parseFloat(row.lon),
      label: formatShortLabel(row.display_name),
    });
  }

  if (hits.length < limit) {
    const photonRows = await searchPhoton(q, limit);
    for (const row of photonRows) {
      addHit({ ...row, label: formatShortLabel(row.label) });
      if (hits.length >= limit) break;
    }
  }

  if (hits.length === 0 && !q.toLowerCase().includes("philippines")) {
    const retry = await fetchNominatim(
      buildNominatimSearchUrl(`${q}, Rizal, Philippines`, limit),
    );
    for (const row of retry) {
      addHit({
        lat: Number.parseFloat(row.lat),
        lng: Number.parseFloat(row.lon),
        label: formatShortLabel(row.display_name),
      });
    }
  }

  return hits.slice(0, limit);
}

export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<string | null> {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("zoom", "18");

  try {
    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
        "Accept-Language": "en",
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { display_name?: string };
    return data.display_name ? formatShortLabel(data.display_name) : null;
  } catch {
    return null;
  }
}
