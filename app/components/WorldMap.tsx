"use client";

import { useEffect, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import maplibregl, { type Map as MapLibreMap, type Marker } from "maplibre-gl";
import type { PeerDot } from "@/lib/types";

const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_TOKEN;

function dotColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return `hsl(${Math.abs(hash) % 360}, 70%, 60%)`;
}

export default function WorldMap({
  peers,
  me,
  onPeerClick,
  canConnect,
}: {
  peers: PeerDot[];
  me: { lat: number; lng: number } | null;
  onPeerClick: (id: string) => void;
  canConnect: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const meMarkerRef = useRef<Marker | null>(null);
  const [ready, setReady] = useState(false);

  const onPeerClickRef = useRef(onPeerClick);
  const canConnectRef = useRef(canConnect);

  useEffect(() => {
    onPeerClickRef.current = onPeerClick;
    canConnectRef.current = canConnect;
  }, [onPeerClick, canConnect]);

  useEffect(() => {
    if (!MAPTILER_KEY || !containerRef.current) return;
    let cancelled = false;
    const markers = markersRef.current;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: `https://api.maptiler.com/maps/basic-v2-dark/style.json?key=xxbiyNuYgQ6FvUGPh5Ur`,
      center: me ? [me.lng, me.lat] : [0, 20],
      zoom: me ? 4 : 1.4,
      attributionControl: {},
    });

    map.on("load", () => {
      if (!cancelled) setReady(true);
    });
    mapRef.current = map;

    return () => {
      cancelled = true;
      markers.forEach((m) => m.remove());
      markers.clear();
      meMarkerRef.current?.remove();
      meMarkerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !me) return;

    if (!meMarkerRef.current) {
      const el = document.createElement("div");
      el.className = "pulse-me";
      el.title = "You are here";
      el.innerHTML = `<span class="pulse-me-label">Me</span>`;
      meMarkerRef.current = new maplibregl.Marker({
        element: el,
        anchor: "bottom",
      })
        .setLngLat([me.lng, me.lat])
        .addTo(map);
    } else {
      meMarkerRef.current.setLngLat([me.lng, me.lat]);
    }
  }, [me, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const markers = markersRef.current;
    const seen = new Set<string>();

    for (const peer of peers) {
      seen.add(peer.id);
      let marker = markers.get(peer.id);
      if (!marker) {
        const el = document.createElement("button");
        el.className = "pulse-dot";
        // el.style.background = dotColor(peer.id);
        el.title = "Tap to connect";

        // --- UPDATED LISTENER ---
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          console.log("Dot clicked! canConnect is:", canConnectRef.current);
          if (canConnectRef.current) {
            onPeerClickRef.current(peer.id);
          } else {
            console.warn("Click ignored: canConnect is false");
          }
        });

        marker = new maplibregl.Marker({ element: el })
          .setLngLat([peer.lng, peer.lat])
          .addTo(map);
        markers.set(peer.id, marker);
      }
      marker.getElement().style.opacity = peer.busy ? "0.35" : "1";
    }

    for (const [id, marker] of markers) {
      if (!seen.has(id)) {
        marker.remove();
        markers.delete(id);
      }
    }
  }, [peers, ready]);

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="h-full w-full bg-zinc-900" />
      {/* ... (rest of your UI remains the same) */}
    </div>
  );
}
