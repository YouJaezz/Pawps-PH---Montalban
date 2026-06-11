"use client";

import Link from "next/link";

import { LiveShiftTimer } from "@/components/LiveShiftTimer";

export function SidebarShiftStatus(props: { clockInAt: string | null }) {
  if (!props.clockInAt) {
    return (
      <Link
        href="/attendance"
        className="mt-2 block rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-[10px] text-zinc-500 hover:border-white/20 hover:text-zinc-400"
      >
        Not clocked in · Time In / Out →
      </Link>
    );
  }

  return (
    <Link
      href="/attendance"
      className="mt-2 block rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-2 hover:bg-emerald-500/15"
    >
      <div className="text-[9px] uppercase tracking-wide text-emerald-400/80">
        On duty · live
      </div>
      <LiveShiftTimer
        clockInAt={props.clockInAt}
        size="sm"
        className="mt-1"
      />
    </Link>
  );
}
