"use client";

import { Loader2, MapPin, Network, Radio } from "lucide-react";
import { useEffect, useState } from "react";

import { IpMapModal, type IpMapPoint } from "@/components/dashboard/ip-map-modal";

type IpInfoPayload = {
  ip?: string;
  hostname?: string;
  city?: string;
  region?: string;
  country?: string;
  loc?: string;
  org?: string;
  postal?: string;
  timezone?: string;
  asn?: string;
  error?: string;
  message?: string;
};

type IpEnrichmentPayload = {
  enrichment?: Record<string, unknown>;
  ipleaks?: Record<string, unknown>;
  ipinfo?: Record<string, unknown>;
  error?: string;
  message?: string;
};

type LoadedIntel = {
  geo: IpInfoPayload | null;
  enrichment: Record<string, unknown> | null;
  error: string | null;
};

function parseLoc(loc?: string): { lat: number; lng: number } | null {
  if (!loc) return null;
  const [latRaw, lngRaw] = loc.split(",").map((part) => part.trim());
  const lat = Number(latRaw);
  const lng = Number(lngRaw);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return { lat, lng };
}

function asStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (typeof entry === "string") return entry.trim();
        if (typeof entry === "number" && Number.isFinite(entry)) {
          return String(entry);
        }

        return "";
      })
      .filter(Boolean);
  }

  if (typeof value === "string" && value.trim()) {
    return value
      .split(/[,;\s]+/)
      .map((part) => part.trim())
      .filter(Boolean);
  }

  return [];
}

function pickString(record: Record<string, unknown> | null, keys: string[]) {
  if (!record) return "";

  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }

  return "";
}

/**
 * Compact IP enrichment + “View on map” for breach/result cards.
 * Uses /api/ipinfo (geo) and /api/osint/ip (ports / connections) when available.
 */
export function IpIntelPanel({
  ip,
  blurResults = false,
}: {
  ip: string;
  blurResults?: boolean;
}) {
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const [intel, setIntel] = useState<LoadedIntel | null>(null);
  const [mapPoint, setMapPoint] = useState<IpMapPoint | null>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      setState("loading");
      setIntel(null);

      try {
        const [geoRes, enrichRes] = await Promise.all([
          fetch(`/api/ipinfo?ip=${encodeURIComponent(ip)}`, {
            signal: controller.signal,
            credentials: "include",
            cache: "no-store",
          }),
          fetch(`/api/osint/ip?query=${encodeURIComponent(ip)}`, {
            signal: controller.signal,
            credentials: "include",
            cache: "no-store",
          }),
        ]);

        const geoJson = (await geoRes.json().catch(() => null)) as
          | IpInfoPayload
          | null;
        const enrichJson = (await enrichRes.json().catch(() => null)) as
          | IpEnrichmentPayload
          | null;

        if (cancelled) return;

        const geoOk =
          geoRes.ok && geoJson && typeof geoJson === "object" && !geoJson.error
            ? geoJson
            : null;
        const enrichment =
          enrichRes.ok && enrichJson?.enrichment && typeof enrichJson.enrichment === "object"
            ? enrichJson.enrichment
            : enrichRes.ok && enrichJson?.ipleaks && typeof enrichJson.ipleaks === "object"
              ? enrichJson.ipleaks
              : null;

        const err =
          (!geoOk &&
            (geoJson?.error ||
              geoJson?.message ||
              (!geoRes.ok ? "Geolocation unavailable." : null))) ||
          null;

        setIntel({
          geo: geoOk,
          enrichment,
          error: geoOk || enrichment ? null : err || "No IP intelligence found.",
        });
        setState(geoOk || enrichment ? "ready" : "error");
      } catch (err) {
        if (cancelled || (err instanceof DOMException && err.name === "AbortError")) {
          return;
        }

        setIntel({
          geo: null,
          enrichment: null,
          error: "IP lookup failed.",
        });
        setState("error");
      }
    }

    void load();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [ip]);

  const geo = intel?.geo ?? null;
  const enrichment = intel?.enrichment ?? null;
  const loc = parseLoc(geo?.loc);
  const ports = asStringList(enrichment?.ports);
  const hostnames = asStringList(enrichment?.hostnames);
  const services = Array.isArray(enrichment?.services)
    ? (enrichment!.services as Record<string, unknown>[])
    : [];
  const org =
    geo?.org ||
    pickString(enrichment, ["org", "organization", "isp"]) ||
    "";
  const asn = geo?.asn || pickString(enrichment, ["asn"]) || "";
  const place = [geo?.city, geo?.region, geo?.country].filter(Boolean).join(", ");
  const hostname =
    geo?.hostname || pickString(enrichment, ["hostname", "host"]) || "";

  const openMap = () => {
    if (!loc) return;

    setMapPoint({
      ip,
      lat: loc.lat,
      lng: loc.lng,
      label: [place, org].filter(Boolean).join(" · ") || undefined,
    });
  };

  return (
    <>
      <div
        className="anya-ip-intel"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <div className="anya-ip-intel-head">
          <p className="anya-ip-intel-title">
            <Network className="size-3.5" />
            APIs &amp; connections
          </p>
          <span className="anya-ip-intel-ip">{blurResults ? "••••••••" : ip}</span>
        </div>

        {state === "loading" ? (
          <p className="anya-ip-intel-status">
            <Loader2 className="size-3.5 animate-spin" />
            Looking up IP intelligence…
          </p>
        ) : null}

        {state === "error" && intel?.error ? (
          <p className="anya-ip-intel-status anya-ip-intel-status--muted">
            {intel.error}
          </p>
        ) : null}

        {state === "ready" ? (
          <div className="anya-ip-intel-grid">
            {place ? (
              <div className="anya-ip-intel-chip">
                <span className="anya-ip-intel-chip-label">Location</span>
                <span className="anya-ip-intel-chip-value">{place}</span>
              </div>
            ) : null}
            {org ? (
              <div className="anya-ip-intel-chip">
                <span className="anya-ip-intel-chip-label">Org / ISP</span>
                <span className="anya-ip-intel-chip-value">{org}</span>
              </div>
            ) : null}
            {asn ? (
              <div className="anya-ip-intel-chip">
                <span className="anya-ip-intel-chip-label">ASN</span>
                <span className="anya-ip-intel-chip-value">{asn}</span>
              </div>
            ) : null}
            {hostname ? (
              <div className="anya-ip-intel-chip">
                <span className="anya-ip-intel-chip-label">Hostname</span>
                <span className="anya-ip-intel-chip-value">{hostname}</span>
              </div>
            ) : null}
            {hostnames.length > 0 ? (
              <div className="anya-ip-intel-chip anya-ip-intel-chip--wide">
                <span className="anya-ip-intel-chip-label">Related hosts</span>
                <span className="anya-ip-intel-chip-value">
                  {hostnames.slice(0, 8).join(", ")}
                </span>
              </div>
            ) : null}
            {ports.length > 0 ? (
              <div className="anya-ip-intel-chip anya-ip-intel-chip--wide">
                <span className="anya-ip-intel-chip-label">
                  <Radio className="mr-1 inline size-3" />
                  Open ports / APIs
                </span>
                <span className="anya-ip-intel-chip-value">
                  {ports.slice(0, 24).join(", ")}
                </span>
              </div>
            ) : null}
            {services.length > 0 ? (
              <div className="anya-ip-intel-chip anya-ip-intel-chip--wide">
                <span className="anya-ip-intel-chip-label">Services</span>
                <span className="anya-ip-intel-chip-value">
                  {services
                    .slice(0, 8)
                    .map((svc) => {
                      const port =
                        typeof svc.port === "number" ? svc.port : null;
                      const product =
                        typeof svc.product === "string" ? svc.product : null;
                      const transport =
                        typeof svc.transport === "string"
                          ? svc.transport
                          : null;

                      return [port, product, transport]
                        .filter((part) => part != null && part !== "")
                        .join("/");
                    })
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="anya-ip-intel-actions">
          <button
            className="anya-ip-intel-map-btn"
            disabled={!loc || blurResults}
            type="button"
            onClick={openMap}
          >
            <MapPin className="size-3.5" />
            View on map
          </button>
          {!loc && state === "ready" ? (
            <span className="anya-ip-intel-status--muted text-[0.65rem]">
              No coordinates for this IP
            </span>
          ) : null}
        </div>
      </div>

      {mapPoint ? (
        <IpMapModal point={mapPoint} onClose={() => setMapPoint(null)} />
      ) : null}
    </>
  );
}
