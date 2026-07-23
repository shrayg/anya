"use client";

import { MapPin, X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import type { Map as LeafletMap } from "leaflet";

import "leaflet/dist/leaflet.css";

export type IpMapPoint = {
  ip: string;
  lat: number;
  lng: number;
  label?: string;
};

/**
 * In-app Leaflet map modal pinned to an IP geolocation.
 * Leaflet is loaded dynamically (window-only).
 */
export function IpMapModal({
  point,
  onClose,
}: {
  point: IpMapPoint;
  onClose: () => void;
}) {
  const mapId = useId().replace(/:/g, "");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;

    async function mountMap() {
      if (!containerRef.current) return;

      const L = (await import("leaflet")).default;

      if (cancelled || !containerRef.current) return;

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      const map = L.map(containerRef.current, {
        zoomControl: true,
        attributionControl: true,
      }).setView([point.lat, point.lng], 11);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      const icon = L.divIcon({
        className: "anya-ip-map-marker",
        html: `<span class="anya-ip-map-pin" aria-hidden="true"></span>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });

      const popup = [
        `<strong>${escapeHtml(point.ip)}</strong>`,
        point.label ? `<div>${escapeHtml(point.label)}</div>` : "",
        `<div class="anya-ip-map-coords">${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}</div>`,
      ]
        .filter(Boolean)
        .join("");

      L.marker([point.lat, point.lng], { icon })
        .addTo(map)
        .bindPopup(popup)
        .openPopup();

      mapRef.current = map;

      // Leaflet needs a tick after modal layout to size correctly.
      requestAnimationFrame(() => {
        map.invalidateSize();
      });
    }

    void mountMap();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [point.ip, point.lat, point.lng, point.label]);

  return (
    <div
      aria-labelledby={`ip-map-title-${mapId}`}
      aria-modal="true"
      className="anya-ip-map-overlay"
      role="dialog"
      onClick={onClose}
    >
      <div
        className="anya-ip-map-dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="anya-ip-map-header">
          <div className="min-w-0">
            <p className="anya-ip-map-kicker">
              <MapPin className="size-3.5" />
              IP location
            </p>
            <h2 className="anya-ip-map-title" id={`ip-map-title-${mapId}`}>
              {point.ip}
            </h2>
            {point.label ? (
              <p className="anya-ip-map-subtitle">{point.label}</p>
            ) : null}
          </div>
          <button
            aria-label="Close map"
            className="anya-ip-map-close"
            type="button"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </header>
        <div ref={containerRef} className="anya-ip-map-canvas" />
        <p className="anya-ip-map-footer">
          {point.lat.toFixed(5)}, {point.lng.toFixed(5)} · OpenStreetMap
        </p>
      </div>
    </div>
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
