"use client";

import { useEffect, useState } from "react";

import { CustomerTrackMap } from "@/app/track/[token]/CustomerTrackMap";

type TrackData = {
  status: string;
  customerName: string;
  pickupLocation: string;
  dropoffLocation: string;
  pickup: { lat: number; lng: number } | null;
  dropoff: { lat: number; lng: number } | null;
  driver: { lat: number; lng: number } | null;
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

  const hasDriver = Boolean(data.driver ?? (data.driverLat && data.driverLng));
  const canShowMap = Boolean(data.pickup && data.dropoff);

  return (
    <div className="space-y-4">
      <div>
        <div className="text-lg font-semibold text-zinc-50">
          {data.customerName}&apos;s trip
        </div>
        <div className="text-sm text-zinc-400">
          {data.pickupLocation} → {data.dropoffLocation}
        </div>
        <div className="mt-2 inline-block rounded-full border border-brand-cyan/30 bg-brand-blue/10 px-3 py-1 text-xs text-brand-cyan/70">
          {data.status}
        </div>
      </div>

      {canShowMap ? (
        <CustomerTrackMap token={props.token} hasDriver={hasDriver} />
      ) : (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <p className="text-sm font-medium text-amber-100">
            Waiting for route details
          </p>
          <p className="mt-1 text-xs text-zinc-400">
            Map will appear once pickup and dropoff locations are resolved.
          </p>
        </div>
      )}

      {!hasDriver ? (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <p className="text-sm font-medium text-amber-100">
            Waiting for driver location
          </p>
          <p className="mt-1 text-xs text-zinc-400">
            Your driver must open Driver mode and tap Start sharing location.
          </p>
          <ol className="mt-3 list-decimal space-y-1.5 pl-4 text-[11px] text-zinc-400">
            <li>Driver opens Pawps PH → Transport jobs on their phone.</li>
            <li>Opens this trip → taps <span className="text-zinc-200">Driver mode</span>.</li>
            <li>Taps <span className="text-zinc-200">Start sharing location</span> and allows GPS.</li>
          </ol>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3 text-[10px] text-zinc-500">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-brand-cyan" />
          Pickup
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-flex h-3 w-3 items-center justify-center rounded-full border-2 border-zinc-900 bg-white">
            <span className="h-1 w-1 rounded-full bg-zinc-900" />
          </span>
          Dropoff
        </span>
        {hasDriver ? (
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-3 w-5 rounded bg-zinc-100" />
            Driver
          </span>
        ) : null}
      </div>

      {data.lastLocationAt ? (
        <p className="text-[11px] text-zinc-500">
          Last updated {new Date(data.lastLocationAt).toLocaleString("en-PH")}
        </p>
      ) : null}
    </div>
  );
}
