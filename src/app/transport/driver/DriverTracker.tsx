"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { updateDriverLocation } from "@/app/transport/actions";

type ShareState = "idle" | "sharing" | "error" | "unsupported";

export function DriverTracker(props: {
  jobId: number;
  trackingToken: string;
}) {
  const [shareState, setShareState] = useState<ShareState>(() =>
    typeof navigator !== "undefined" && !navigator.geolocation ? "unsupported" : "idle",
  );
  const [status, setStatus] = useState("Tap the button below to start sharing your location.");
  const [lastSent, setLastSent] = useState<string | null>(null);
  const watchRef = useRef<number | null>(null);

  const stopSharing = useCallback(() => {
    if (watchRef.current != null) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
    setShareState("idle");
    setStatus("Location sharing stopped. Tap start when you are ready to drive.");
  }, []);

  const startSharing = useCallback(() => {
    if (!navigator.geolocation) {
      setShareState("unsupported");
      setStatus("Geolocation is not supported on this device.");
      return;
    }

    setShareState("sharing");
    setStatus("Waiting for GPS… Allow location access if your browser asks.");

    watchRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const lat = pos.coords.latitude.toFixed(6);
        const lng = pos.coords.longitude.toFixed(6);
        setStatus(`Sharing live · ${lat}, ${lng}`);

        const fd = new FormData();
        fd.set("jobId", String(props.jobId));
        fd.set("lat", lat);
        fd.set("lng", lng);
        fd.set("token", props.trackingToken);

        try {
          await updateDriverLocation(fd);
          setLastSent(new Date().toLocaleTimeString("en-PH"));
        } catch {
          setStatus("Failed to send location — check your connection and try again.");
        }
      },
      (err) => {
        setShareState("error");
        setStatus(
          err.code === 1
            ? "Location blocked. Allow GPS in your browser settings, then tap Start again."
            : err.message,
        );
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 },
    );
  }, [props.jobId, props.trackingToken]);

  useEffect(() => {
    return () => {
      if (watchRef.current != null) {
        navigator.geolocation.clearWatch(watchRef.current);
      }
    };
  }, []);

  return (
    <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-4">
      <div className="text-sm font-medium text-sky-100">Live driver tracking</div>
      <ol className="mt-2 list-decimal space-y-1 pl-4 text-[11px] text-zinc-400">
        <li>Keep this page open on your phone while driving.</li>
        <li>Tap <span className="text-zinc-200">Start sharing location</span> below.</li>
        <li>Allow location/GPS when your browser prompts you.</li>
      </ol>

      <div className="mt-3 flex flex-wrap gap-2">
        {shareState === "sharing" ? (
          <button
            type="button"
            onClick={stopSharing}
            className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-xs font-medium text-red-200"
          >
            Stop sharing
          </button>
        ) : (
          <button
            type="button"
            onClick={startSharing}
            disabled={shareState === "unsupported"}
            className="rounded-lg bg-sky-500 px-4 py-2 text-xs font-medium text-zinc-950 hover:bg-sky-400 disabled:opacity-40"
          >
            Start sharing location
          </button>
        )}
      </div>

      <div className="mt-2 text-xs text-zinc-300">{status}</div>
      {lastSent ? (
        <div className="mt-1 text-[10px] text-zinc-500">Last sent {lastSent}</div>
      ) : null}
    </div>
  );
}
