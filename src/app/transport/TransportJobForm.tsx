"use client";

import { useMemo, useState } from "react";

import { createTransportJob, estimateTransportDistance } from "@/app/transport/actions";
import { calculateTransportFee } from "@/lib/transport-pricing";
import { formatPhpFromCents } from "@/lib/money";

const EXTRA_PRESETS = [
  "Toll fee",
  "Food",
  "Water",
  "Pet supplies",
  "Parking",
  "Other",
];

export function TransportJobForm(props: {
  baseFeeCents: number;
  perKmCents: number;
  minimumFeeCents: number;
}) {
  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [distanceKm, setDistanceKm] = useState("");
  const [extras, setExtras] = useState<{ label: string; amount: string }[]>([
    { label: "Toll fee", amount: "" },
  ]);
  const [estimating, setEstimating] = useState(false);

  const km = Number.parseFloat(distanceKm) || 0;
  const extrasTotalCents = extras.reduce(
    (s, e) => s + Math.round((Number.parseFloat(e.amount) || 0) * 100),
    0,
  );

  const preview = useMemo(
    () =>
      calculateTransportFee(
        {
          baseFeeCents: props.baseFeeCents,
          perKmCents: props.perKmCents,
          minimumFeeCents: props.minimumFeeCents,
        },
        km,
        extrasTotalCents,
      ),
    [props, km, extrasTotalCents],
  );

  async function handleEstimate() {
    if (!pickup.trim() || !dropoff.trim()) return;
    setEstimating(true);
    try {
      const fd = new FormData();
      fd.set("pickup", pickup);
      fd.set("dropoff", dropoff);
      const result = await estimateTransportDistance(fd);
      if (result.km != null) setDistanceKm(String(result.km));
    } finally {
      setEstimating(false);
    }
  }

  return (
    <form action={createTransportJob} className="space-y-4">
      <label className="space-y-1">
        <div className="text-xs text-zinc-300">Customer name *</div>
        <input
          name="customerName"
          required
          className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
        />
      </label>
      <label className="space-y-1">
        <div className="text-xs text-zinc-300">Contact</div>
        <input name="contact" className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none" />
      </label>
      <label className="space-y-1">
        <div className="text-xs text-zinc-300">Pickup *</div>
        <input
          name="pickupLocation"
          required
          value={pickup}
          onChange={(e) => setPickup(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
        />
      </label>
      <label className="space-y-1">
        <div className="text-xs text-zinc-300">Dropoff *</div>
        <input
          name="dropoffLocation"
          required
          value={dropoff}
          onChange={(e) => setDropoff(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
        />
      </label>

      <div className="rounded-xl border border-white/10 bg-black/20 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-zinc-300">Distance (km)</span>
          <label className="flex items-center gap-1 text-[10px] text-zinc-500">
            <input type="checkbox" name="autoEstimate" defaultChecked />
            Auto-estimate from map
          </label>
        </div>
        <div className="mt-2 flex gap-2">
          <input
            name="distanceKm"
            value={distanceKm}
            onChange={(e) => setDistanceKm(e.target.value)}
            inputMode="decimal"
            placeholder="e.g. 12.5"
            className="flex-1 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm outline-none"
          />
          <button
            type="button"
            onClick={handleEstimate}
            disabled={estimating}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-200"
          >
            {estimating ? "…" : "Estimate km"}
          </button>
        </div>
        <div className="mt-2 text-[11px] text-zinc-500">
          Base {formatPhpFromCents(preview.baseFeeCents)} + distance{" "}
          {formatPhpFromCents(preview.distanceFeeCents)} + extras{" "}
          {formatPhpFromCents(preview.extrasTotalCents)} ={" "}
          <span className="font-medium text-amber-200">
            {formatPhpFromCents(preview.totalFeeCents)}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs text-zinc-300">Extras (toll, food, pet needs)</div>
        {extras.map((ex, i) => (
          <div key={i} className="flex gap-2">
            <select
              name="extraLabel"
              value={ex.label}
              onChange={(e) => {
                const next = [...extras];
                next[i] = { ...next[i], label: e.target.value };
                setExtras(next);
              }}
              className="flex-1 rounded border border-white/10 bg-black/30 px-2 py-1 text-xs"
            >
              {EXTRA_PRESETS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <input
              name="extraAmount"
              value={ex.amount}
              onChange={(e) => {
                const next = [...extras];
                next[i] = { ...next[i], amount: e.target.value };
                setExtras(next);
              }}
              placeholder="₱"
              className="w-20 rounded border border-white/10 bg-black/30 px-2 py-1 text-xs"
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() => setExtras([...extras, { label: "Other", amount: "" }])}
          className="text-[10px] text-zinc-400 hover:text-zinc-200"
        >
          + Add extra line
        </button>
      </div>

      <label className="space-y-1">
        <div className="text-xs text-zinc-300">Pet details</div>
        <input name="petDetails" className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none" />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1">
          <div className="text-xs text-zinc-300">Service</div>
          <select name="serviceType" defaultValue="Pet Taxi" className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm">
            <option>Pet Taxi</option>
            <option>Vet Visit</option>
            <option>Grooming Visit</option>
            <option>Boarding Transfer</option>
            <option>Other</option>
          </select>
        </label>
        <label className="space-y-1">
          <div className="text-xs text-zinc-300">Status</div>
          <select name="status" defaultValue="Scheduled" className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm">
            <option>Requested</option>
            <option>Scheduled</option>
            <option>In Transit</option>
            <option>Completed</option>
            <option>Cancelled</option>
          </select>
        </label>
      </div>
      <label className="space-y-1">
        <div className="text-xs text-zinc-300">Notes</div>
        <input name="notes" className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none" />
      </label>
      <button
        type="submit"
        className="w-full rounded-xl bg-zinc-50 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white"
      >
        Create job · {formatPhpFromCents(preview.totalFeeCents)}
      </button>
    </form>
  );
}
