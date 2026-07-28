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
  latitude?: number;
  longitude?: number;
  lat?: number;
  lon?: number;
  lng?: number;
};

type LoadedIntel = {
  geo: IpInfoPayload | null;
  enrichment: Record<string, unknown> | null;
  error: string | null;
};

const GEO_TIMEOUT_MS = 12_000;
const ENRICH_TIMEOUT_MS = 14_000;

function parseLoc(geo?: IpInfoPayload | null): { lat: number; lng: number } | null {
  if (!geo) return null;

  if (geo.loc) {
    const [latRaw, lngRaw] = geo.loc.split(",").map((part) => part.trim());
    const lat = Number(latRaw);
    const lng = Number(lngRaw);

    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }

  const lat = Number(geo.latitude ?? geo.lat);
  const lng = Number(geo.longitude ?? geo.lon ?? geo.lng);

  if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };

  return null;
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

function extractEnrichment(
  payload: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!payload) return null;

  for (const key of ["enrichment", "ipleaks", "ipinfo", "data"] as const) {
    const nested = payload[key];

    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      return nested as Record<string, unknown>;
    }
  }

  // Flat useful fields on the root.
  if (
    payload.ports ||
    payload.hostnames ||
    payload.services ||
    payload.org ||
    payload.asn
  ) {
    return payload;
  }

  return null;
}

async function fetchJson(
  url: string,
  signal: AbortSignal,
  timeoutMs: number,
): Promise<{ ok: boolean; status: number; json: Record<string, unknown> | null }> {
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), timeoutMs);

  const onParentAbort = () => timeout.abort();
  signal.addEventListener("abort", onParentAbort, { once: true });

  try {
    const res = await fetch(url, {
      signal: timeout.signal,
      credentials: "include",
      cache: "no-store",
    });
    const json = (await res.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;

    return { ok: res.ok, status: res.status, json };
  } catch {
    return { ok: false, status: 0, json: null };
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", onParentAbort);
  }
}

/**
 * Compact IP enrichment + “View on map”.
 * Geo resolves fast (IPInfo → free fallback); ports/APIs load in parallel
 * without blocking the map button.
 */
export function IpIntelPanel({
  ip,
  blurResults = false,
  variant = "embedded",
  moduleSlug = "breaches",
}: {
  ip: string;
  blurResults?: boolean;
  /** `panel` = standalone left-column window; `embedded` = card footer. */
  variant?: "embedded" | "panel";
  /** Bill/gate under the parent search module (starter Discord/Breaches, etc.). */
  moduleSlug?: string;
}) {
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const [intel, setIntel] = useState<LoadedIntel | null>(null);
  const [enriching, setEnriching] = useState(false);
  const [mapPoint, setMapPoint] = useState<IpMapPoint | null>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      setState("loading");
      setIntel(null);
      setEnriching(true);

      const slug = encodeURIComponent(moduleSlug);
      const encodedIp = encodeURIComponent(ip);

      const geoPromise = fetchJson(
        `/api/ipinfo?ip=${encodedIp}&moduleSlug=${slug}`,
        controller.signal,
        GEO_TIMEOUT_MS,
      );

      const enrichPromise = fetchJson(
        `/api/osint/ip?query=${encodedIp}&moduleSlug=${slug}`,
        controller.signal,
        ENRICH_TIMEOUT_MS,
      );

      const geoRes = await geoPromise;

      if (cancelled) return;

      const geoJson = geoRes.json as IpInfoPayload | null;
      const geoOk =
        geoRes.ok &&
        geoJson &&
        typeof geoJson === "object" &&
        !geoJson.error
          ? geoJson
          : null;

      if (geoOk) {
        setIntel({ geo: geoOk, enrichment: null, error: null });
        setState("ready");
      }

      const enrichRes = await enrichPromise;

      if (cancelled) return;

      const enrichment = extractEnrichment(enrichRes.json);
      const err =
        (!geoOk &&
          ((typeof geoJson?.error === "string" && geoJson.error) ||
            (typeof geoJson?.message === "string" && geoJson.message) ||
            (!geoRes.ok ? "Geolocation unavailable." : null))) ||
        null;

      if (geoOk || enrichment) {
        setIntel({
          geo: geoOk,
          enrichment,
          error: null,
        });
        setState("ready");
      } else {
        setIntel({
          geo: null,
          enrichment: null,
          error: err || "No IP intelligence found.",
        });
        setState("error");
      }

      setEnriching(false);
    }

    void load();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [ip, moduleSlug]);

  const geo = intel?.geo ?? null;
  const enrichment = intel?.enrichment ?? null;
  const loc = parseLoc(geo);
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
        className={
          variant === "panel" ? "anya-ip-intel anya-ip-intel--panel" : "anya-ip-intel"
        }
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
            {enriching ? (
              <p className="anya-ip-intel-status anya-ip-intel-status--muted">
                <Loader2 className="size-3 animate-spin" />
                Checking ports &amp; connections…
              </p>
            ) : null}
            {!place && !org && !asn && !hostname && ports.length === 0 && !enriching ? (
              <p className="anya-ip-intel-status anya-ip-intel-status--muted">
                Geo resolved — no extra connection data for this IP.
              </p>
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
          {!loc && state === "loading" ? (
            <span className="anya-ip-intel-status--muted text-[0.65rem]">
              Resolving location…
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
