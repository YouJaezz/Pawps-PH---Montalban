"use client";

import { useEffect, useState } from "react";

type TrackData = {
  status: string;
  customerName: string;
  pickupLocation: string;
  dropoffLocation: string;
  driverLat: string | null;
  driverLng: string | null;
  lastLocationAt: string | null;
};

export function LiveTrackView(props: { token: string }) {
  const [data, setData] = useState<TrackData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function poll() {
      try {
        const res = await fetch(`/api/track/${props.token}`);
        if (!res.ok) throw new Error("Tracking not found");
        const json = (await res.json()) as TrackData;
        if (active) {
          setData(json);
          setError(null);
        }
      } catch {
        if (active) setError("Unable to load tracking.");
      }
    }

    poll();
    const id = setInterval(poll, 8000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [props.token]);

  if (error) {
    return <p className="text-sm text-red-300">{error}</p>;
  }

  if (!data) {
    return <p className="text-sm text-zinc-400">Loading live location…</p>;
  }

  const mapUrl =
    data.driverLat && data.driverLng
      ? `https://www.openstreetmap.org/export/embed.html?bbox=${Number(data.driverLng) - 0.02}%2C${Number(data.driverLat) - 0.02}%2C${Number(data.driverLng) + 0.02}%2C${Number(data.driverLat) + 0.02}&layer=mapnik&marker=${data.driverLat}%2C${data.driverLng}`
      : null;

  return (
    <div className="space-y-4">
      <div>
        <div className="text-lg font-semibold text-zinc-50">
          {data.customerName}&apos;s trip
        </div>
        <div className="text-sm text-zinc-400">
          {data.pickupLocation} → {data.dropoffLocation}
        </div>
        <div className="mt-2 inline-block rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">
          {data.status}
        </div>
      </div>

      {mapUrl ? (
        <div className="overflow-hidden rounded-xl border border-white/10">
          <iframe
            title="Driver location"
            src={mapUrl}
            className="h-72 w-full"
            loading="lazy"
          />
        </div>
      ) : (
        <p className="text-sm text-zinc-500">
          Driver location will appear once the trip starts.
        </p>
      )}

      {data.lastLocationAt ? (
        <p className="text-[11px] text-zinc-500">
          Last updated {new Date(data.lastLocationAt).toLocaleString("en-PH")}
        </p>
      ) : null}
    </div>
  );
}
