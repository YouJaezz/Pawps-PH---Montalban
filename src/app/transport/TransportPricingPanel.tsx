"use client";

import { updateTransportPricing } from "@/app/transport/pricing-actions";
import { formatPhpFromCents } from "@/lib/money";

export function TransportPricingPanel(props: {
  baseFeeCents: number;
  perKmCents: number;
  minimumFeeCents: number;
  trafficPerMinCents: number;
  stopLightFeeCents: number;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="text-sm font-medium text-zinc-100">Your transport rates</div>
      <p className="mt-0.5 text-[11px] text-zinc-500">
        Fee = max(base + km + traffic + stop lights, minimum) + extras
      </p>
      <form action={updateTransportPricing} className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <label className="space-y-0.5">
          <span className="text-[10px] text-zinc-500">Base fee (₱)</span>
          <input
            name="baseFee"
            defaultValue={(props.baseFeeCents / 100).toFixed(0)}
            className="w-full rounded border border-white/10 bg-black/30 px-2 py-1 text-xs"
          />
        </label>
        <label className="space-y-0.5">
          <span className="text-[10px] text-zinc-500">Per km (₱)</span>
          <input
            name="perKm"
            defaultValue={(props.perKmCents / 100).toFixed(0)}
            className="w-full rounded border border-white/10 bg-black/30 px-2 py-1 text-xs"
          />
        </label>
        <label className="space-y-0.5">
          <span className="text-[10px] text-zinc-500">Minimum (₱)</span>
          <input
            name="minimumFee"
            defaultValue={(props.minimumFeeCents / 100).toFixed(0)}
            className="w-full rounded border border-white/10 bg-black/30 px-2 py-1 text-xs"
          />
        </label>
        <label className="space-y-0.5">
          <span className="text-[10px] text-zinc-500">Traffic (₱/min)</span>
          <input
            name="trafficPerMin"
            defaultValue={(props.trafficPerMinCents / 100).toFixed(0)}
            className="w-full rounded border border-white/10 bg-black/30 px-2 py-1 text-xs"
          />
        </label>
        <label className="space-y-0.5">
          <span className="text-[10px] text-zinc-500">Stop light (₱ each)</span>
          <input
            name="stopLightFee"
            defaultValue={(props.stopLightFeeCents / 100).toFixed(0)}
            className="w-full rounded border border-white/10 bg-black/30 px-2 py-1 text-xs"
          />
        </label>
        <button
          type="submit"
          className="col-span-2 rounded border border-white/10 py-1.5 text-xs text-zinc-200 hover:bg-white/5 sm:col-span-3"
        >
          Save rates — base {formatPhpFromCents(props.baseFeeCents)} +{" "}
          {formatPhpFromCents(props.perKmCents)}/km + traffic{" "}
          {formatPhpFromCents(props.trafficPerMinCents)}/min +{" "}
          {formatPhpFromCents(props.stopLightFeeCents)}/light
        </button>
      </form>
    </div>
  );
}
