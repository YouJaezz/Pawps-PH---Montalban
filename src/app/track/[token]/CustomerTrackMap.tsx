"use client";

import { useEffect, useRef, useState } from "react";
import type { LatLngExpression, Map as LeafletMap, Marker, Polyline } from "leaflet";

import "leaflet/dist/leaflet.css";

type MapPoint = { lat: number; lng: number };

type TrackMapData = {
  pickup: MapPoint | null;
  dropoff: MapPoint | null;
  driver: MapPoint | null;
  routePath: [number, number][];
  routeKind: "remaining" | "planned" | null;
};

function bearingDeg(from: MapPoint, to: MapPoint) {
  const φ1 = (from.lat * Math.PI) / 180;
  const φ2 = (to.lat * Math.PI) / 180;
  const Δλ = ((to.lng - from.lng) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function routeBearing(path: [number, number][], driver: MapPoint) {
  if (path.length < 2) return 0;
  let bestIdx = 0;
  let bestDist = Number.POSITIVE_INFINITY;
  for (let i = 0; i < path.length - 1; i++) {
    const [lat, lng] = path[i];
    const d = (lat - driver.lat) ** 2 + (lng - driver.lng) ** 2;
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  const from = { lat: path[bestIdx][0], lng: path[bestIdx][1] };
  const to = {
    lat: path[Math.min(bestIdx + 1, path.length - 1)][0],
    lng: path[Math.min(bestIdx + 1, path.length - 1)][1],
  };
  return bearingDeg(from, to);
}

function vanIconHtml(bearing: number) {
  return `<div style="width:42px;height:42px;display:flex;align-items:center;justify-content:center;transform:rotate(${bearing}deg);filter:drop-shadow(0 2px 4px rgba(0,0,0,.45))">
    <svg width="34" height="34" viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="6" width="18" height="22" rx="4" fill="#f8fafc" stroke="#334155" stroke-width="1.5"/>
      <rect x="10" y="8" width="14" height="7" rx="1.5" fill="#64748b"/>
      <rect x="10" y="18" width="14" height="8" rx="1.5" fill="#cbd5e1"/>
      <circle cx="12" cy="26" r="2.5" fill="#1e293b"/>
      <circle cx="22" cy="26" r="2.5" fill="#1e293b"/>
    </svg>
  </div>`;
}

function destinationIconHtml() {
  return `<div style="width:28px;height:28px;display:flex;align-items:center;justify-content:center">
    <div style="width:22px;height:22px;border-radius:50%;border:3px solid #111827;background:#fff;box-shadow:0 1px 6px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center">
      <div style="width:7px;height:7px;border-radius:50%;background:#111827"></div>
    </div>
  </div>`;
}

function pickupIconHtml() {
  return `<div style="width:16px;height:16px;border-radius:50%;background:#34d399;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`;
}

export function CustomerTrackMap(props: { token: string; hasDriver: boolean }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<LeafletMap | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const routeLineRef = useRef<Polyline | null>(null);
  const plannedLineRef = useRef<Polyline | null>(null);
  const driverMarkerRef = useRef<Marker | null>(null);
  const pickupMarkerRef = useRef<Marker | null>(null);
  const dropoffMarkerRef = useRef<Marker | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapData, setMapData] = useState<TrackMapData | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function initMap() {
      if (!mapRef.current || mapInstanceRef.current) return;
      const L = await import("leaflet");
      if (cancelled || !mapRef.current) return;
      leafletRef.current = L;

      const map = L.map(mapRef.current, {
        zoomControl: true,
        scrollWheelZoom: true,
      });

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;
      setMapReady(true);
      requestAnimationFrame(() => map.invalidateSize());
    }

    void initMap();

    return () => {
      cancelled = true;
      mapInstanceRef.current?.remove();
      mapInstanceRef.current = null;
      routeLineRef.current = null;
      plannedLineRef.current = null;
      driverMarkerRef.current = null;
      pickupMarkerRef.current = null;
      dropoffMarkerRef.current = null;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadMap() {
      try {
        const res = await fetch(`/api/track/${props.token}/map`);
        if (!res.ok) throw new Error("Map unavailable");
        const json = (await res.json()) as TrackMapData;
        if (active) {
          setMapData(json);
          setMapError(null);
        }
      } catch {
        if (active) setMapError("Could not load map route.");
      }
    }

    loadMap();
    const id = window.setInterval(loadMap, props.hasDriver ? 8000 : 15000);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, [props.token, props.hasDriver]);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapInstanceRef.current;
    if (!L || !map || !mapReady || !mapData) return;

    const bounds: LatLngExpression[] = [];

    if (mapData.pickup) {
      bounds.push([mapData.pickup.lat, mapData.pickup.lng]);
      if (!pickupMarkerRef.current) {
        pickupMarkerRef.current = L.marker([mapData.pickup.lat, mapData.pickup.lng], {
          icon: L.divIcon({
            className: "",
            html: pickupIconHtml(),
            iconSize: [16, 16],
            iconAnchor: [8, 8],
          }),
          zIndexOffset: 100,
        }).addTo(map);
      } else {
        pickupMarkerRef.current.setLatLng([mapData.pickup.lat, mapData.pickup.lng]);
      }
    } else if (pickupMarkerRef.current) {
      map.removeLayer(pickupMarkerRef.current);
      pickupMarkerRef.current = null;
    }

    if (mapData.dropoff) {
      bounds.push([mapData.dropoff.lat, mapData.dropoff.lng]);
      if (!dropoffMarkerRef.current) {
        dropoffMarkerRef.current = L.marker(
          [mapData.dropoff.lat, mapData.dropoff.lng],
          {
            icon: L.divIcon({
              className: "",
              html: destinationIconHtml(),
              iconSize: [28, 28],
              iconAnchor: [14, 14],
            }),
            zIndexOffset: 500,
          },
        ).addTo(map);
      } else {
        dropoffMarkerRef.current.setLatLng([
          mapData.dropoff.lat,
          mapData.dropoff.lng,
        ]);
      }
    } else if (dropoffMarkerRef.current) {
      map.removeLayer(dropoffMarkerRef.current);
      dropoffMarkerRef.current = null;
    }

    if (mapData.driver) {
      bounds.push([mapData.driver.lat, mapData.driver.lng]);
      const bearing = mapData.routePath.length
        ? routeBearing(mapData.routePath, mapData.driver)
        : mapData.dropoff
          ? bearingDeg(mapData.driver, mapData.dropoff)
          : 0;

      if (!driverMarkerRef.current) {
        driverMarkerRef.current = L.marker(
          [mapData.driver.lat, mapData.driver.lng],
          {
            icon: L.divIcon({
              className: "",
              html: vanIconHtml(bearing),
              iconSize: [42, 42],
              iconAnchor: [21, 21],
            }),
            zIndexOffset: 1000,
          },
        ).addTo(map);
      } else {
        driverMarkerRef.current.setLatLng([mapData.driver.lat, mapData.driver.lng]);
        driverMarkerRef.current.setIcon(
          L.divIcon({
            className: "",
            html: vanIconHtml(bearing),
            iconSize: [42, 42],
            iconAnchor: [21, 21],
          }),
        );
      }
    } else if (driverMarkerRef.current) {
      map.removeLayer(driverMarkerRef.current);
      driverMarkerRef.current = null;
    }

    const activePath = mapData.routePath;
    if (activePath.length > 1) {
      const isRemaining = mapData.routeKind === "remaining";
      const targetLine = isRemaining ? routeLineRef : plannedLineRef;
      const otherLine = isRemaining ? plannedLineRef : routeLineRef;

      if (otherLine.current) {
        map.removeLayer(otherLine.current);
        otherLine.current = null;
      }

      if (targetLine.current) {
        targetLine.current.setLatLngs(activePath);
        targetLine.current.setStyle({
          color: isRemaining ? "#2563eb" : "#60a5fa",
          weight: isRemaining ? 6 : 4,
          opacity: isRemaining ? 0.95 : 0.55,
        });
      } else {
        targetLine.current = L.polyline(activePath, {
          color: isRemaining ? "#2563eb" : "#60a5fa",
          weight: isRemaining ? 6 : 4,
          opacity: isRemaining ? 0.95 : 0.55,
          lineCap: "round",
          lineJoin: "round",
        }).addTo(map);
      }

      for (const point of activePath) bounds.push(point);
    } else {
      if (routeLineRef.current) {
        map.removeLayer(routeLineRef.current);
        routeLineRef.current = null;
      }
      if (plannedLineRef.current) {
        map.removeLayer(plannedLineRef.current);
        plannedLineRef.current = null;
      }
    }

    if (bounds.length > 0) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [36, 36], maxZoom: 16 });
    }

    map.invalidateSize();
  }, [mapReady, mapData]);

  return (
    <div className="relative overflow-hidden rounded-xl border border-zinc-200">
      <div
        ref={mapRef}
        className="customer-track-map h-80 w-full sm:h-96"
        style={{ minHeight: 320 }}
      />
      {!props.hasDriver ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/70 to-transparent px-3 py-2">
          <p className="text-[11px] font-medium text-amber-100">
            Planned route — van appears when driver starts GPS
          </p>
        </div>
      ) : null}
      {mapError ? (
        <p className="absolute bottom-2 left-2 rounded bg-black/70 px-2 py-1 text-[10px] text-red-800">
          {mapError}
        </p>
      ) : null}
    </div>
  );
}
