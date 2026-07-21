/**
 * Sequential BreachHub-primary → CSINT/direct fallback wrappers.
 * Never calls both gateways in parallel for the same underlying vendor.
 */

import {
  fetchBreachHubByIds,
  fetchBreachHubDiscordToRoblox,
  fetchBreachHubIntelx,
  fetchBreachHubIntelxWithBuckets,
  isBreachHubEnabled,
} from "@/lib/breachhub";
import {
  fetchCsintIntelx,
  fetchCsintIntelxWithBuckets,
  fetchCsintMelissaLookup,
  fetchCsintOathnetDiscordToRoblox,
  fetchCsintSeonEmail,
  fetchCsintSeonPhone,
  fetchCsintShodanHost,
  isCsintEnabled,
} from "@/lib/csint";
import { DEFAULT_INTELX_BUCKET, isIntelxBucket } from "@/lib/intelx-buckets";
import {
  isBreachHubPrimaryActive,
  withPrimaryFallback,
} from "@/lib/provider-dedupe";

function shodanFromBreachHubRows(
  query: string,
  bh: { results: unknown[] } | null,
): Record<string, unknown> | null {
  if (!bh || bh.results.length === 0) return null;

  const first =
    bh.results[0] && typeof bh.results[0] === "object"
      ? (bh.results[0] as Record<string, unknown>)
      : {};

  const ports = Array.isArray(first.ports) ? first.ports : [];
  const hostnames = Array.isArray(first.hostnames) ? first.hostnames : [];
  const services = Array.isArray(first.services) ? first.services : [];

  if (ports.length === 0 && hostnames.length === 0 && services.length === 0) {
    return null;
  }

  return {
    query,
    ip: query,
    ports,
    org: typeof first.org === "string" ? first.org : null,
    hostnames,
    vulns: Array.isArray(first.vulns) ? first.vulns : [],
    services,
    ...first,
  };
}

function shodanHasData(data: Record<string, unknown>): boolean {
  const ports = Array.isArray(data.ports) ? data.ports : [];
  const hostnames = Array.isArray(data.hostnames) ? data.hostnames : [];
  const services = Array.isArray(data.services) ? data.services : [];

  return ports.length > 0 || hostnames.length > 0 || services.length > 0;
}

/** OathNet Discord→Roblox: BreachHub first, CSINT only after fail/empty. */
export async function fetchOathnetDiscordToRoblox(
  discordId: string,
  timeoutMs = 18_000,
): Promise<Record<string, unknown> | null> {
  const { value } = await withPrimaryFallback(
    async () => {
      if (!isBreachHubEnabled()) return null;

      return fetchBreachHubDiscordToRoblox(discordId, timeoutMs);
    },
    async () => {
      if (!isCsintEnabled()) return null;

      return fetchCsintOathnetDiscordToRoblox(discordId);
    },
    (account) => Boolean(account && typeof account === "object"),
  );

  return value;
}

/** Shodan host: BreachHub first, CSINT fallback. */
export async function fetchShodanHostWithFallback(
  ip: string,
  timeoutMs = 18_000,
): Promise<Record<string, unknown>> {
  const { value } = await withPrimaryFallback(
    async () => {
      if (!isBreachHubEnabled()) return null;
      const bh = await fetchBreachHubByIds(
        ["shodan-host"],
        ip,
        "ip",
        timeoutMs,
      );

      return shodanFromBreachHubRows(ip, bh);
    },
    async () => {
      if (!isCsintEnabled()) return null;

      return fetchCsintShodanHost(ip, timeoutMs);
    },
    shodanHasData,
  );

  return (
    value ?? {
      query: ip,
      ip,
      ports: [],
      org: null,
      hostnames: [],
      vulns: [],
      services: [],
    }
  );
}

/** Melissa / contact enrich: BreachHub first, CSINT fallback. */
export async function fetchMelissaWithFallback(
  body: Record<string, string>,
  timeoutMs = 18_000,
): Promise<Record<string, unknown> | null> {
  const input =
    body.input ||
    body.email ||
    body.phone ||
    [body.first, body.last].filter(Boolean).join(" ") ||
    Object.values(body).join(" ");

  const { value } = await withPrimaryFallback(
    async () => {
      if (!isBreachHubEnabled()) return null;
      const bh = await fetchBreachHubByIds(
        ["melissa"],
        input,
        "auto",
        timeoutMs,
      );

      if (!bh || bh.count <= 0) return null;

      return { count: bh.count, results: bh.results };
    },
    async () => {
      if (!isCsintEnabled()) return null;

      return fetchCsintMelissaLookup(body);
    },
    (data) => {
      if (!data || typeof data !== "object") return false;
      const record = data as Record<string, unknown>;

      if (typeof record.count === "number") return record.count > 0;

      return Object.keys(record).length > 0;
    },
  );

  return value;
}

/** SEON email: BreachHub specialty email index first is broad — prefer CSINT SEON only as module fallback when BH seon-email empty via by-ids. */
export async function fetchSeonEmailWithFallback(
  email: string,
  timeoutMs = 18_000,
): Promise<Record<string, unknown> | null> {
  const { value } = await withPrimaryFallback(
    async () => {
      if (!isBreachHubEnabled()) return null;
      const bh = await fetchBreachHubByIds(
        ["seon-email", "seon-email-verification"],
        email,
        "email",
        timeoutMs,
      );

      if (!bh || bh.count <= 0) return null;

      return { email, indexHits: bh, count: bh.count, results: bh.results };
    },
    async () => {
      if (!isCsintEnabled()) return null;

      return fetchCsintSeonEmail(email);
    },
  );

  return value;
}

export async function fetchSeonPhoneWithFallback(
  phone: string,
  timeoutMs = 18_000,
): Promise<Record<string, unknown> | null> {
  const { value } = await withPrimaryFallback(
    async () => {
      if (!isBreachHubEnabled()) return null;
      const bh = await fetchBreachHubByIds(
        ["seon-phone"],
        phone,
        "phone",
        timeoutMs,
      );

      if (!bh || bh.count <= 0) return null;

      return { query: phone, indexHits: bh, count: bh.count, results: bh.results };
    },
    async () => {
      if (!isCsintEnabled()) return null;

      return fetchCsintSeonPhone(phone);
    },
  );

  return value;
}

export type IntelxExportResult = {
  content: string;
  error?: string;
  bucket: string;
};

/**
 * IntelX export — ID-kind aware (never BH ∥ CSINT in parallel):
 * - System ID (UUID): BreachHub `system_id` first → CSINT → (GodsEye in route)
 * - Storage ID (long hex): CSINT `storageid`+bucket first → BreachHub → GodsEye
 */
export async function fetchIntelxExportWithFallback(
  storageId: string,
  idKind: "uuid" | "storage",
  preferredBucket: string,
): Promise<IntelxExportResult> {
  const bucket = isIntelxBucket(preferredBucket)
    ? preferredBucket
    : DEFAULT_INTELX_BUCKET;

  const tryBreachHub = async (): Promise<IntelxExportResult | null> => {
    if (!isBreachHubEnabled()) return null;

    const breachHub =
      idKind === "uuid"
        ? await fetchBreachHubIntelx(storageId, bucket)
        : await fetchBreachHubIntelxWithBuckets(storageId, bucket);

    if (!breachHub.content.trim()) {
      return breachHub.error
        ? { content: "", error: breachHub.error, bucket: breachHub.bucket }
        : null;
    }

    return { content: breachHub.content, bucket: breachHub.bucket };
  };

  const tryCsint = async (): Promise<IntelxExportResult | null> => {
    if (!isCsintEnabled()) return null;

    const csint =
      idKind === "uuid"
        ? await fetchCsintIntelx(storageId, bucket)
        : await fetchCsintIntelxWithBuckets(storageId, bucket);

    if (!csint.content.trim()) {
      return csint.error
        ? { content: "", error: csint.error, bucket: csint.bucket }
        : null;
    }

    return { content: csint.content, bucket: csint.bucket };
  };

  // System IDs: BH native path first. Storage IDs: CSINT dedicated export first.
  const primary = idKind === "uuid" ? tryBreachHub : tryCsint;
  const fallback = idKind === "uuid" ? tryCsint : tryBreachHub;

  const { value } = await withPrimaryFallback(
    primary,
    fallback,
    (row) => Boolean(row.content?.trim()),
  );

  return (
    value ?? {
      content: "",
      error: "No export content returned.",
      bucket,
    }
  );
}

/** Whether combined search should run CSINT additive only after BH misses. */
export function csintIsFallbackOnly(): boolean {
  return isBreachHubPrimaryActive() && isCsintEnabled();
}
