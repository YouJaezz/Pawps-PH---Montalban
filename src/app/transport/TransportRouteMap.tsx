"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GeoPoint } from "@/lib/transport-geo";
import {
  estimateRoadKmFromCoords,
  ROAD_DISTANCE_FACTOR,
} from "@/lib/transport-geo";
import { formatPhpFromCents } from "@/lib/money";

import type { Map as LeafletMap, Marker, Polyline } from "leaflet";

import "leaflet/dist/leaflet.css";

type ActiveField = "pickup" | "dropoff";

type SearchHit = { lat: number; lng: number; label: string };

export type RouteDistanceBreakdown = {
  straightKm: number;
  roadKm: number;
  distanceFeeCents: number;
};

export function TransportRouteMap(props: {
  pickup: GeoPoint | null;
  dropoff: GeoPoint | null;
  onPickupChange: (point: GeoPoint | null) => void;
  onDropoffChange: (point: GeoPoint | null) => void;
  onRoadKmChange: (km: number | null, breakdown: RouteDistanceBreakdown | null) => void;
  perKmCents: number;
  distanceKmInput: string;
  onDistanceKmInputChange: (value: string) => void;
}) {
  const {
    pickup,
    dropoff,
    onPickupChange,
    onDropoffChange,
    onRoadKmChange,
    perKmCents,
    distanceKmInput,
    onDistanceKmInputChange,
  } = props;
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<LeafletMap | null>(null);
  const pickupMarkerRef = useRef<Marker | null>(null);
  const dropoffMarkerRef = useRef<Marker | null>(null);
  const routeLineRef = useRef<Polyline | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);

  const [activeField, setActiveField] = useState<ActiveField>("pickup");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchHits, setSearchHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [pinning, setPinning] = useState(false);

  const activeFieldRef = useRef(activeField);
  const onPickupRef = useRef(onPickupChange);
  const onDropoffRef = useRef(onDropoffChange);
  const placeFromMapRef = useRef<(lat: number, lng: number) => Promise<void>>(
    async () => {},
  );

  useEffect(() => {
    activeFieldRef.current = activeField;
    onPickupRef.current = onPickupChange;
    onDropoffRef.current = onDropoffChange;
  });

  const breakdown = useMemo(() => {
    if (!pickup || !dropoff) return null;
    const { straightKm, roadKm } = estimateRoadKmFromCoords(pickup, dropoff);
    return {
      straightKm,
      roadKm,
      distanceFeeCents: Math.round(roadKm * perKmCents),
    };
  }, [pickup, dropoff, perKmCents]);

  useEffect(() => {
    if (!breakdown) {
      onRoadKmChange(null, null);
      return;
    }
    onRoadKmChange(breakdown.roadKm, breakdown);
  }, [breakdown, onRoadKmChange]);

  const fitRoute = useCallback(
    (L: typeof import("leaflet")) => {
      const map = mapInstanceRef.current;
      if (!map || !pickup || !dropoff) return;
      const bounds = L.latLngBounds(
        [pickup.lat, pickup.lng],
        [dropoff.lat, dropoff.lng],
      );
      map.fitBounds(bounds.pad(0.25));
    },
    [pickup, dropoff],
  );

  const syncMarkers = useCallback(
    (L: typeof import("leaflet")) => {
      const map = mapInstanceRef.current;
      if (!map) return;

      const pickupIcon = L.divIcon({
        className: "",
        html: `<div style="background:#34d399;width:14px;height:14px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      const dropoffIcon = L.divIcon({
        className: "",
        html: `<div style="background:#f87171;width:14px;height:14px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });

      if (pickup) {
        if (!pickupMarkerRef.current) {
          pickupMarkerRef.current = L.marker([pickup.lat, pickup.lng], {
            icon: pickupIcon,
          }).addTo(map);
        } else {
          pickupMarkerRef.current.setLatLng([pickup.lat, pickup.lng]);
        }
      } else if (pickupMarkerRef.current) {
        map.removeLayer(pickupMarkerRef.current);
        pickupMarkerRef.current = null;
      }

      if (dropoff) {
        if (!dropoffMarkerRef.current) {
          dropoffMarkerRef.current = L.marker([dropoff.lat, dropoff.lng], {
            icon: dropoffIcon,
          }).addTo(map);
        } else {
          dropoffMarkerRef.current.setLatLng([dropoff.lat, dropoff.lng]);
        }
      } else if (dropoffMarkerRef.current) {
        map.removeLayer(dropoffMarkerRef.current);
        dropoffMarkerRef.current = null;
      }

      if (pickup && dropoff) {
        const latlngs: [number, number][] = [
          [pickup.lat, pickup.lng],
          [dropoff.lat, dropoff.lng],
        ];
        if (!routeLineRef.current) {
          routeLineRef.current = L.polyline(latlngs, {
            color: "#fbbf24",
            weight: 3,
            dashArray: "6 8",
            opacity: 0.9,
          }).addTo(map);
        } else {
          routeLineRef.current.setLatLngs(latlngs);
        }
        fitRoute(L);
      } else if (routeLineRef.current) {
        map.removeLayer(routeLineRef.current);
        routeLineRef.current = null;
      }
    },
    [pickup, dropoff, fitRoute],
  );

  const placeFromMap = useCallback(async (lat: number, lng: number) => {
    setPinning(true);
    try {
      const res = await fetch(`/api/geocode/reverse?lat=${lat}&lng=${lng}`);
      const label = res.ok
        ? ((await res.json()) as { label: string }).label
        : `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      const point: GeoPoint = { lat, lng, label };
      if (activeFieldRef.current === "pickup") {
        onPickupRef.current(point);
      } else {
        onDropoffRef.current(point);
      }
      setSearchQuery("");
      setSearchHits([]);
    } finally {
      setPinning(false);
    }
  }, []);

  useEffect(() => {
    placeFromMapRef.current = placeFromMap;
  }, [placeFromMap]);

  useEffect(() => {
    let cancelled = false;

    async function initMap() {
      if (!mapRef.current || mapInstanceRef.current) return;
      const L = await import("leaflet");
      if (cancelled || !mapRef.current) return;
      leafletRef.current = L;

      const map = L.map(mapRef.current, {
        center: [14.72, 121.15],
        zoom: 11,
        scrollWheelZoom: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);

      map.on("click", (e) => {
        void placeFromMapRef.current(e.latlng.lat, e.latlng.lng);
      });

      mapInstanceRef.current = map;
      setMapReady(true);
    }

    void initMap();

    return () => {
      cancelled = true;
      mapInstanceRef.current?.remove();
      mapInstanceRef.current = null;
      pickupMarkerRef.current = null;
      dropoffMarkerRef.current = null;
      routeLineRef.current = null;
    };
  }, []);

  useEffect(() => {
    const L = leafletRef.current;
    if (!L || !mapReady) return;
    syncMarkers(L);
  }, [mapReady, syncMarkers]);

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 3) return;

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/geocode/search?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          setSearchHits((await res.json()) as SearchHit[]);
        }
      } finally {
        setSearching(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  function selectSearchHit(hit: SearchHit) {
    const point: GeoPoint = { lat: hit.lat, lng: hit.lng, label: hit.label };
    if (activeField === "pickup") {
      onPickupChange(point);
    } else {
      onDropoffChange(point);
    }
    setSearchQuery("");
    setSearchHits([]);

    const L = leafletRef.current;
    const map = mapInstanceRef.current;
    if (L && map) {
      map.setView([hit.lat, hit.lng], 14);
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        void placeFromMap(pos.coords.latitude, pos.coords.longitude);
      },
      () => {},
      { enableHighAccuracy: true },
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-black/20 p-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setActiveField("pickup")}
          className={`rounded-lg px-3 py-1.5 text-xs ${
            activeField === "pickup"
              ? "bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-500/40"
              : "border border-white/10 text-zinc-400"
          }`}
        >
          Set pickup {pickup ? "✓" : ""}
        </button>
        <button
          type="button"
          onClick={() => setActiveField("dropoff")}
          className={`rounded-lg px-3 py-1.5 text-xs ${
            activeField === "dropoff"
              ? "bg-red-500/20 text-red-200 ring-1 ring-red-500/40"
              : "border border-white/10 text-zinc-400"
          }`}
        >
          Set dropoff {dropoff ? "✓" : ""}
        </button>
        <button
          type="button"
          onClick={useMyLocation}
          className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300"
        >
          Use my location
        </button>
      </div>

      <div className="relative">
        <input
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            if (e.target.value.trim().length < 3) setSearchHits([]);
          }}
          placeholder={`Search ${activeField} on map…`}
          className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
        />
        {searching ? (
          <div className="absolute right-3 top-2.5 text-[10px] text-zinc-500">
            Searching…
          </div>
        ) : null}
        {searchQuery.trim().length >= 3 && searchHits.length > 0 ? (
          <ul className="absolute z-[1000] mt-1 max-h-40 w-full overflow-y-auto rounded-lg border border-white/10 bg-zinc-900 shadow-lg">
            {searchHits.map((hit) => (
              <li key={`${hit.lat}-${hit.lng}`}>
                <button
                  type="button"
                  onClick={() => selectSearchHit(hit)}
                  className="w-full px-3 py-2 text-left text-xs text-zinc-200 hover:bg-white/5"
                >
                  {hit.label}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="grid gap-1 text-[11px]">
        <div className="flex gap-2">
          <span className="text-emerald-400">Pickup:</span>
          <span className="text-zinc-400">
            {pickup?.label ?? "Not set — tap map or search"}
          </span>
        </div>
        <div className="flex gap-2">
          <span className="text-red-400">Dropoff:</span>
          <span className="text-zinc-400">
            {dropoff?.label ?? "Not set — tap map or search"}
          </span>
        </div>
      </div>

      <p className="text-[10px] text-zinc-500">
        Tap the map or pick a search result to place the{" "}
        <span className={activeField === "pickup" ? "text-emerald-300" : "text-red-300"}>
          {activeField}
        </span>{" "}
        pin. {pinning ? "Loading address…" : ""}
      </p>

      <div
        ref={mapRef}
        className="h-56 w-full overflow-hidden rounded-lg border border-white/10 sm:h-64"
      />

      {breakdown ? (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-[11px]">
          <div className="font-medium text-amber-100">Distance breakdown</div>
          <div className="mt-2 space-y-1 text-zinc-400">
            <div className="flex justify-between gap-4">
              <span>Straight line (map)</span>
              <span className="text-zinc-200">{breakdown.straightKm} km</span>
            </div>
            <div className="flex justify-between gap-4">
              <span>Road estimate (×{ROAD_DISTANCE_FACTOR})</span>
              <span className="font-semibold text-amber-200">
                {breakdown.roadKm} km
              </span>
            </div>
            <div className="flex justify-between gap-4 border-t border-amber-500/10 pt-1">
              <span>Distance charge</span>
              <span className="text-zinc-200">
                {breakdown.roadKm} km × {formatPhpFromCents(perKmCents)}/km ={" "}
                {formatPhpFromCents(breakdown.distanceFeeCents)}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-[11px] text-zinc-500">
          Set both pickup and dropoff on the map to calculate km automatically.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs text-zinc-400">Distance (km)</label>
        <input
          value={distanceKmInput}
          onChange={(e) => onDistanceKmInputChange(e.target.value)}
          inputMode="decimal"
          placeholder="Auto from map"
          className="w-24 rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-sm outline-none"
        />
        {breakdown &&
        distanceKmInput &&
        Number.parseFloat(distanceKmInput) !== breakdown.roadKm ? (
          <span className="text-[10px] text-amber-300/80">Manual override</span>
        ) : null}
      </div>
    </div>
  );
}
