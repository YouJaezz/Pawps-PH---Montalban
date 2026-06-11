"use client";

import { useEffect, useState } from "react";

import { formatLiveDuration, liveElapsedMs } from "@/lib/time-duration";

export function LiveShiftTimer(props: {
  clockInAt: string;
  className?: string;
  size?: "sm" | "lg";
  showPulse?: boolean;
}) {
  const [elapsedMs, setElapsedMs] = useState(() =>
    liveElapsedMs(props.clockInAt),
  );

  useEffect(() => {
    const tick = () => setElapsedMs(liveElapsedMs(props.clockInAt));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [props.clockInAt]);

  const sizeClass =
    props.size === "lg"
      ? "text-3xl font-bold tracking-tight"
      : "text-sm font-semibold";

  return (
    <span className={`inline-flex items-center gap-2 ${props.className ?? ""}`}>
      {props.showPulse !== false ? (
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
        </span>
      ) : null}
      <span className={`tabular-nums text-emerald-300 ${sizeClass}`}>
        {formatLiveDuration(elapsedMs)}
      </span>
    </span>
  );
}
