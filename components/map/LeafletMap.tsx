"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Names come from profiles, so never put them into HTML as-is.
function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function textNode(text: string) {
  const span = document.createElement("span");
  span.textContent = text;
  return span;
}

export type MapPoint = {
  id: string;
  lat: number;
  lng: number;
  accuracy: number | null;
  label: string;
  initials: string;
  tone: "me" | "partner" | "sos";
  stale: boolean;
};

/**
 * OpenStreetMap through Leaflet. Only this file touches Leaflet, and it
 * only loads in the browser (see MapScreen's dynamic import).
 */
export default function LeafletMap({ points, focusId }: { points: MapPoint[]; focusId: string | null }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const fitted = useRef(false);

  useEffect(() => {
    if (!container.current || map.current) return;
    map.current = L.map(container.current, { zoomControl: true, attributionControl: true }).setView([20, 0], 2);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    return () => {
      map.current?.remove();
      map.current = null;
      fitted.current = false;
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    const group = layer.current;
    if (!m || !group) return;
    group.clearLayers();
    for (const p of points) {
      if (p.accuracy && p.accuracy < 5000) {
        L.circle([p.lat, p.lng], { radius: p.accuracy, className: `map-accuracy map-${p.tone}`, weight: 1 }).addTo(group);
      }
      const icon = L.divIcon({
        className: "",
        html: `<span class="map-marker map-${p.tone}${p.stale ? " map-stale" : ""}" aria-hidden="true">${escapeHtml(p.initials)}</span>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });
      L.marker([p.lat, p.lng], { icon, title: p.label, alt: p.label, keyboard: true }).addTo(group).bindTooltip(textNode(p.label));
    }

    const focus = points.find((p) => p.id === focusId);
    if (focus) {
      m.setView([focus.lat, focus.lng], 16);
      fitted.current = true;
    } else if (!fitted.current && points.length > 0) {
      // First data: show everyone. Afterwards leave the view where the person put it.
      if (points.length === 1) m.setView([points[0].lat, points[0].lng], 15);
      else m.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng])), { padding: [48, 48], maxZoom: 16 });
      fitted.current = true;
    }
  }, [points, focusId]);

  return <div ref={container} className="size-full" role="region" aria-label="Map" />;
}
