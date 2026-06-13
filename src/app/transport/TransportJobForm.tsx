"use client";

import { useCallback, useMemo, useState } from "react";

import { createTransportJob } from "@/app/transport/actions";
import {
  TransportRouteMap,
  type RouteDistanceBreakdown,
} from "@/app/transport/TransportRouteMap";
import type { GeoPoint } from "@/lib/transport-geo";
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
  trafficPerMinCents: number;
  stopLightFeeCents: number;
}) {
  const [pickupPoint, setPickupPoint] = useState<GeoPoint | null>(null);
  const [dropoffPoint, setDropoffPoint] = useState<GeoPoint | null>(null);
  const [distanceKm, setDistanceKm] = useState("");
  const [kmFromMap, setKmFromMap] = useState(true);
  const [breakdown, setBreakdown] = useState<RouteDistanceBreakdown | null>(
    null,
  );
  const [extras, setExtras] = useState<{ label: string; amount: string }[]>([
    { label: "Toll fee", amount: "" },
  ]);

  const handleRoadKmChange = useCallback(
    (km: number | null, nextBreakdown: RouteDistanceBreakdown | null) => {
      setBreakdown(nextBreakdown);
      if (km != null && kmFromMap) {
        setDistanceKm(String(km));
      }
    },
    [kmFromMap],
  );

  const handleDistanceInputChange = useCallback((value: string) => {
    setKmFromMap(false);
    setDistanceKm(value);
  }, []);

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
          trafficPerMinCents: props.trafficPerMinCents,
          stopLightFeeCents: props.stopLightFeeCents,
        },
        km,
        extrasTotalCents,
        breakdown?.travelTime
          ? {
              trafficBufferMinutes: breakdown.travelTime.trafficBufferMinutes,
              intersectionCount: breakdown.travelTime.intersectionCount,
            }
          : undefined,
      ),
    [props, km, extrasTotalCents, breakdown],
  );

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
        <input
          name="contact"
          className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
        />
      </label>

      <TransportRouteMap
        pickup={pickupPoint}
        dropoff={dropoffPoint}
        onPickupChange={(p) => {
          setPickupPoint(p);
          if (p) setKmFromMap(true);
        }}
        onDropoffChange={(p) => {
          setDropoffPoint(p);
          if (p) setKmFromMap(true);
        }}
        onRoadKmChange={handleRoadKmChange}
        perKmCents={props.perKmCents}
        trafficPerMinCents={props.trafficPerMinCents}
        stopLightFeeCents={props.stopLightFeeCents}
        distanceKmInput={distanceKm}
        onDistanceKmInputChange={handleDistanceInputChange}
      />

      <input
        type="hidden"
        name="pickupLocation"
        value={pickupPoint?.label ?? ""}
      />
      <input
        type="hidden"
        name="dropoffLocation"
        value={dropoffPoint?.label ?? ""}
      />
      <input type="hidden" name="pickupLat" value={pickupPoint?.lat ?? ""} />
      <input type="hidden" name="pickupLng" value={pickupPoint?.lng ?? ""} />
      <input type="hidden" name="dropoffLat" value={dropoffPoint?.lat ?? ""} />
      <input type="hidden" name="dropoffLng" value={dropoffPoint?.lng ?? ""} />
      <input type="hidden" name="distanceKm" value={distanceKm} />
      <input type="hidden" name="autoEstimate" value={kmFromMap ? "on" : ""} />
      <input
        type="hidden"
        name="trafficBufferMinutes"
        value={breakdown?.travelTime?.trafficBufferMinutes ?? 0}
      />
      <input
        type="hidden"
        name="intersectionCount"
        value={breakdown?.travelTime?.intersectionCount ?? 0}
      />

      {!pickupPoint || !dropoffPoint ? (
        <p className="text-[11px] text-amber-300/80">
          Select pickup and dropoff on the map above before creating the job.
        </p>
      ) : null}

      <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-[11px] text-zinc-500">
        Base {formatPhpFromCents(preview.baseFeeCents)} + distance{" "}
        {formatPhpFromCents(preview.distanceFeeCents)}
        {breakdown ? (
          <span className="text-zinc-600">
            {" "}
            ({breakdown.routeKm} km driving route ×{" "}
            {formatPhpFromCents(props.perKmCents)})
          </span>
        ) : null}
        {preview.trafficFeeCents > 0 ? (
          <>
            {" "}
            + traffic {formatPhpFromCents(preview.trafficFeeCents)}
          </>
        ) : null}
        {preview.stopLightFeeCents > 0 ? (
          <>
            {" "}
            + stop lights {formatPhpFromCents(preview.stopLightFeeCents)}
          </>
        ) : null}{" "}
        + extras {formatPhpFromCents(preview.extrasTotalCents)} ={" "}
        <span className="font-medium text-amber-200">
          {formatPhpFromCents(preview.totalFeeCents)}
        </span>
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
        <input
          name="petDetails"
          className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1">
          <div className="text-xs text-zinc-300">Service</div>
          <select
            name="serviceType"
            defaultValue="Pet Taxi"
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm"
          >
            <option>Pet Taxi</option>
            <option>Vet Visit</option>
            <option>Grooming Visit</option>
            <option>Boarding Transfer</option>
            <option>Other</option>
          </select>
        </label>
        <label className="space-y-1">
          <div className="text-xs text-zinc-300">Status</div>
          <select
            name="status"
            defaultValue="Scheduled"
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm"
          >
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
        <input
          name="notes"
          className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
        />
      </label>
      <button
        type="submit"
        disabled={!pickupPoint || !dropoffPoint || km <= 0}
        className="w-full rounded-xl bg-zinc-50 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white disabled:opacity-40"
      >
        Create job · {formatPhpFromCents(preview.totalFeeCents)}
      </button>
    </form>
  );
}
