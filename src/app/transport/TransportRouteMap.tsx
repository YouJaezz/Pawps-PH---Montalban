"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Map as LeafletMap, Marker, Polyline } from "leaflet";

import type { GeoPoint } from "@/lib/transport-geo";
import { PH_MAP_CENTER } from "@/lib/transport-geo";
import { formatPhpFromCents } from "@/lib/money";
import {
  formatDurationMinutes,
  type TravelTimeEstimate,
} from "@/lib/travel-time-estimate";

import "leaflet/dist/leaflet.css";

type SearchHit = { lat: number; lng: number; label: string };

type RouteResponse = {
  distanceKm: number;
  durationMinutes: number | null;
  travelTime: TravelTimeEstimate;
  path: [number, number][];
};

export type RouteDistanceBreakdown = {
  routeKm: number;
  durationMinutes: number | null;
  travelTime: TravelTimeEstimate | null;
  distanceFeeCents: number;
  viaRoadNetwork: boolean;
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
  const placeFromMapRef = useRef<(lat: number, lng: number) => Promise<void>>(
    async () => {},
  );

  const [activeField, setActiveField] = useState<"pickup" | "dropoff">("pickup");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchHits, setSearchHits] = useState<SearchHit[]>([]);
  const [searchEmpty, setSearchEmpty] = useState(false);
  const [searching, setSearching] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [pinning, setPinning] = useState(false);
  const [routeData, setRouteData] = useState<RouteResponse | null>(null);
  const [loadedRouteKey, setLoadedRouteKey] = useState<string | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);

  const routeKey = useMemo(() => {
    if (!pickup || !dropoff) return null;
    return `${pickup.lat.toFixed(5)},${pickup.lng.toFixed(5)}|${dropoff.lat.toFixed(5)},${dropoff.lng.toFixed(5)}`;
  }, [pickup, dropoff]);

  const activeRouteData =
    routeKey && loadedRouteKey === routeKey ? routeData : null;
  const calculatingRoute = Boolean(routeKey && loadedRouteKey !== routeKey);

  const activeFieldRef = useRef(activeField);
  const onPickupRef = useRef(onPickupChange);
  const onDropoffRef = useRef(onDropoffChange);

  useEffect(() => {
    activeFieldRef.current = activeField;
    onPickupRef.current = onPickupChange;
    onDropoffRef.current = onDropoffChange;
  });

  const breakdown = useMemo((): RouteDistanceBreakdown | null => {
    if (!pickup || !dropoff || !activeRouteData) return null;
    return {
      routeKm: activeRouteData.distanceKm,
      durationMinutes: activeRouteData.durationMinutes,
      travelTime: activeRouteData.travelTime,
      distanceFeeCents: Math.round(activeRouteData.distanceKm * perKmCents),
      viaRoadNetwork: true,
    };
  }, [pickup, dropoff, activeRouteData, perKmCents]);

  useEffect(() => {
    if (!breakdown) {
      onRoadKmChange(null, null);
      return;
    }
    onRoadKmChange(breakdown.routeKm, breakdown);
  }, [breakdown, onRoadKmChange]);

  const drawRoute = useCallback(
    (L: typeof import("leaflet"), path: [number, number][]) => {
      const map = mapInstanceRef.current;
      if (!map || path.length === 0) return;

      if (routeLineRef.current) {
        routeLineRef.current.setLatLngs(path);
      } else {
        routeLineRef.current = L.polyline(path, {
          color: "#fbbf24",
          weight: 5,
          opacity: 0.9,
        }).addTo(map);
      }

      map.fitBounds(routeLineRef.current.getBounds(), { padding: [28, 28] });
    },
    [],
  );

  const syncMarkers = useCallback(
    (L: typeof import("leaflet")) => {
      const map = mapInstanceRef.current;
      if (!map) return;

      const pickupIcon = L.divIcon({
        className: "",
        html: `<div style="background:#34d399;width:16px;height:16px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.5)"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      const dropoffIcon = L.divIcon({
        className: "",
        html: `<div style="background:#f87171;width:16px;height:16px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.5)"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
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

      if (activeRouteData?.path.length && pickup && dropoff) {
        drawRoute(L, activeRouteData.path);
      } else if (routeLineRef.current) {
        map.removeLayer(routeLineRef.current);
        routeLineRef.current = null;
        const focus = pickup ?? dropoff;
        if (focus) map.setView([focus.lat, focus.lng], 15);
      } else {
        const focus = pickup ?? dropoff;
        if (focus) map.setView([focus.lat, focus.lng], 15);
      }

      map.invalidateSize();
    },
    [pickup, dropoff, activeRouteData, drawRoute],
  );

  const placeFromMap = useCallback(async (lat: number, lng: number) => {
    setPinning(true);
    try {
      const res = await fetch(`/api/geocode/reverse?lat=${lat}&lng=${lng}`);
      const label = res.ok
        ? ((await res.json()) as { label: string }).label
        : `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      const point: GeoPoint = { lat, lng, label };
      if (activeFieldRef.current === "pickup") onPickupRef.current(point);
      else onDropoffRef.current(point);
      setSearchQuery("");
      setSearchHits([]);
      setSearchEmpty(false);
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
        center: [PH_MAP_CENTER.lat, PH_MAP_CENTER.lng],
        zoom: 12,
        scrollWheelZoom: true,
      });

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);

      map.on("click", (e) => {
        void placeFromMapRef.current(e.latlng.lat, e.latlng.lng);
      });

      mapInstanceRef.current = map;
      setMapReady(true);
      requestAnimationFrame(() => map.invalidateSize());
      window.setTimeout(() => map.invalidateSize(), 300);
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
    if (!routeKey || !pickup || !dropoff) return;

    let cancelled = false;

    const url = `/api/route/driving?pickupLat=${pickup.lat}&pickupLng=${pickup.lng}&dropoffLat=${dropoff.lat}&dropoffLng=${dropoff.lng}`;

    fetch(url)
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          setRouteData(null);
          setLoadedRouteKey(null);
          setRouteError("Could not calculate driving route. Try adjusting the pins.");
          return;
        }
        const data = (await res.json()) as RouteResponse;
        setRouteData(data);
        setLoadedRouteKey(routeKey);
        setRouteError(null);
      })
      .catch(() => {
        if (!cancelled) {
          setRouteData(null);
          setLoadedRouteKey(null);
          setRouteError("Route service unavailable. Try again in a moment.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [routeKey, pickup, dropoff]);

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 3) return;

    const timer = setTimeout(async () => {
      setSearching(true);
      setSearchEmpty(false);
      try {
        const res = await fetch(`/api/geocode/search?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const hits = (await res.json()) as SearchHit[];
          setSearchHits(hits);
          setSearchEmpty(hits.length === 0);
        }
      } finally {
        setSearching(false);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  function selectSearchHit(hit: SearchHit) {
    const point: GeoPoint = { lat: hit.lat, lng: hit.lng, label: hit.label };
    if (activeField === "pickup") onPickupChange(point);
    else onDropoffChange(point);
    setSearchQuery("");
    setSearchHits([]);
    setSearchEmpty(false);
    mapInstanceRef.current?.setView([hit.lat, hit.lng], 15);
  }

  function useMyLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      void placeFromMap(pos.coords.latitude, pos.coords.longitude);
    });
  }

  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-black/20 p-3">
      <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 px-2.5 py-2 text-[10px] text-sky-200/90">
        Free maps — OpenStreetMap + road routing (OSRM). No API key or billing.
      </div>

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
            if (e.target.value.trim().length < 3) {
              setSearchHits([]);
              setSearchEmpty(false);
            }
          }}
          placeholder={`Search ${activeField} — barangay, street, landmark…`}
          className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
        />
        {searching ? (
          <div className="absolute right-3 top-2.5 text-[10px] text-zinc-500">
            Searching…
          </div>
        ) : null}
        {searchQuery.trim().length >= 3 && searchHits.length > 0 ? (
          <ul className="absolute z-[1000] mt-1 max-h-44 w-full overflow-y-auto rounded-lg border border-white/10 bg-zinc-900 shadow-lg">
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
        ) : searchEmpty && searchQuery.trim().length >= 3 && !searching ? (
          <div className="absolute z-[1000] mt-1 w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-zinc-400">
            No match — include barangay &amp; city, or tap the map to pin the spot.
          </div>
        ) : null}
      </div>

      <div className="grid gap-1 text-[11px]">
        <div className="flex gap-2">
          <span className="shrink-0 text-emerald-400">Pickup:</span>
          <span className="text-zinc-400">
            {pickup?.label ?? "Search or tap map"}
          </span>
        </div>
        <div className="flex gap-2">
          <span className="shrink-0 text-red-400">Dropoff:</span>
          <span className="text-zinc-400">
            {dropoff?.label ?? "Search or tap map"}
          </span>
        </div>
      </div>

      <p className="text-[10px] text-zinc-500">
        Tap map to pin {activeField}. {pinning ? "Looking up address…" : ""}
        {calculatingRoute ? " Calculating driving route…" : ""}
      </p>

      <div
        ref={mapRef}
        className="transport-map h-56 w-full rounded-lg border border-white/10 sm:h-64"
        style={{ minHeight: 224 }}
      />

      {routeError ? (
        <p className="text-[11px] text-red-300/90">{routeError}</p>
      ) : null}

      {breakdown ? (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-[11px]">
          <div className="font-medium text-amber-100">
            Driving route (actual roads)
          </div>
          <div className="mt-2 space-y-1 text-zinc-400">
            <div className="flex justify-between gap-4">
              <span>Driving distance</span>
              <span className="font-semibold text-amber-200">
                {breakdown.routeKm} km
              </span>
            </div>
            {breakdown.travelTime ? (
              <>
                <div className="flex justify-between gap-4 border-t border-amber-500/10 pt-1">
                  <span>Clear-road drive</span>
                  <span className="text-zinc-200">
                    ~{breakdown.travelTime.baseDriveMinutes} min
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span>
                    Traffic buffer (×{breakdown.travelTime.trafficFactor.toFixed(2)})
                  </span>
                  <span className="text-zinc-200">
                    +{breakdown.travelTime.trafficBufferMinutes} min
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span>
                    Stop lights ({breakdown.travelTime.intersectionCount} pauses ×{" "}
                    {breakdown.travelTime.stopLightPauseSec}s)
                  </span>
                  <span className="text-zinc-200">
                    +{breakdown.travelTime.stopLightMinutes} min
                  </span>
                </div>
                <div className="flex justify-between gap-4 border-t border-amber-500/10 pt-1">
                  <span className="font-medium text-amber-100/90">
                    Est. trip time
                  </span>
                  <span className="font-semibold text-amber-200">
                    {formatDurationMinutes(breakdown.travelTime.totalEstimatedMinutes)}
                  </span>
                </div>
              </>
            ) : null}
            <div className="flex justify-between gap-4 border-t border-amber-500/10 pt-1">
              <span>Distance charge</span>
              <span className="text-zinc-200">
                {breakdown.routeKm} km × {formatPhpFromCents(perKmCents)}/km ={" "}
                {formatPhpFromCents(breakdown.distanceFeeCents)}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-[11px] text-zinc-500">
          Set pickup and dropoff — fare uses real driving distance along roads, not
          straight-line guess.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs text-zinc-400">Distance (km)</label>
        <input
          value={distanceKmInput}
          onChange={(e) => onDistanceKmInputChange(e.target.value)}
          inputMode="decimal"
          placeholder="From route"
          className="min-w-[5rem] w-28 rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-sm outline-none"
        />
        {breakdown &&
        distanceKmInput &&
        Number.parseFloat(distanceKmInput) !== breakdown.routeKm ? (
          <span className="text-[10px] text-amber-300/80">Manual override</span>
        ) : null}
      </div>
    </div>
  );
}
