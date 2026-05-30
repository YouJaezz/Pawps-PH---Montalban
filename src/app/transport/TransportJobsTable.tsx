"use client";

import Link from "next/link";

import { deleteTransportJob } from "@/app/transport/delete-actions";
import { updateTransportStatus } from "@/app/transport/actions";
import { formatPhpFromCents } from "@/lib/money";
import { tenthsToKm } from "@/lib/transport-pricing";

export type TransportJobRow = {
  id: number;
  customerName: string;
  contact: string | null;
  pickupLocation: string;
  dropoffLocation: string;
  serviceType: string;
  status: string;
  fee: number;
  distanceKmTenths: number;
  trackingToken: string | null;
  receiptNumber: string | null;
};

const statuses = [
  "Requested",
  "Scheduled",
  "In Transit",
  "Completed",
  "Cancelled",
] as const;

export function TransportJobsTable(props: { rows: TransportJobRow[] }) {
  return (
    <div className="space-y-2">
      {props.rows.length === 0 ? (
        <p className="text-sm text-zinc-500">No transport jobs yet.</p>
      ) : (
        props.rows.map((j) => (
          <div
            key={j.id}
            className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="font-medium text-zinc-50">{j.customerName}</div>
                <div className="text-xs text-zinc-400">
                  {j.pickupLocation} → {j.dropoffLocation}
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  {j.serviceType} · {tenthsToKm(j.distanceKmTenths)} km ·{" "}
                  {formatPhpFromCents(j.fee)}
                </div>
              </div>
              <form action={updateTransportStatus} className="flex items-center gap-1">
                <input type="hidden" name="id" value={j.id} />
                <select
                  name="status"
                  defaultValue={j.status}
                  className="rounded border border-white/10 bg-black/30 px-2 py-1 text-xs"
                >
                  {statuses.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="rounded border border-emerald-500/30 px-2 py-1 text-[10px] text-emerald-200"
                >
                  Save
                </button>
              </form>
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
              <Link
                href={`/transport/driver/${j.id}`}
                className="rounded border border-sky-500/30 px-2 py-0.5 text-sky-200"
              >
                Driver mode
              </Link>
              {j.receiptNumber ? (
                <Link
                  href={`/transport/receipt/${j.id}`}
                  className="rounded border border-white/10 px-2 py-0.5 text-zinc-300"
                >
                  Receipt
                </Link>
              ) : null}
              {j.trackingToken ? (
                <Link
                  href={`/track/${j.trackingToken}`}
                  target="_blank"
                  className="rounded border border-amber-500/30 px-2 py-0.5 text-amber-200"
                >
                  Share tracking
                </Link>
              ) : null}
              <form action={deleteTransportJob}>
                <input type="hidden" name="id" value={j.id} />
                <button type="submit" className="text-red-400/80 hover:text-red-300">
                  Delete
                </button>
              </form>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
