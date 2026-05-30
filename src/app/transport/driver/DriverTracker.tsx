"use client";

import { useEffect, useRef, useState } from "react";

import { updateDriverLocation } from "@/app/transport/actions";

export function DriverTracker(props: {
  jobId: number;
  trackingToken: string;
}) {
  const [status, setStatus] = useState(() =>
    typeof navigator !== "undefined" && !navigator.geolocation
      ? "Geolocation not supported on this device."
      : "Waiting for GPS…",
  );
  const [lastSent, setLastSent] = useState<string | null>(null);
  const watchRef = useRef<number | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) return;

    watchRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const lat = pos.coords.latitude.toFixed(6);
        const lng = pos.coords.longitude.toFixed(6);
        setStatus(`Location: ${lat}, ${lng}`);

        const fd = new FormData();
        fd.set("jobId", String(props.jobId));
        fd.set("lat", lat);
        fd.set("lng", lng);
        fd.set("token", props.trackingToken);

        try {
          await updateDriverLocation(fd);
          setLastSent(new Date().toLocaleTimeString("en-PH"));
        } catch {
          setStatus("Failed to send location — check connection.");
        }
      },
      (err) => setStatus(err.message),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 },
    );

    return () => {
      if (watchRef.current != null) {
        navigator.geolocation.clearWatch(watchRef.current);
      }
    };
  }, [props.jobId, props.trackingToken]);

  return (
    <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-4">
      <div className="text-sm font-medium text-sky-100">Live driver tracking</div>
      <p className="mt-1 text-xs text-zinc-400">
        Your location is shared with the customer tracking link while this page is open.
      </p>
      <div className="mt-2 text-xs text-zinc-300">{status}</div>
      {lastSent ? (
        <div className="mt-1 text-[10px] text-zinc-500">Last sent {lastSent}</div>
      ) : null}
    </div>
  );
}
