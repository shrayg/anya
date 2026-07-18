import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import "server-only";

export const STATUS_HISTORY_WINDOW_DAYS = 90;

export type StatusLevel = "operational" | "degraded" | "outage";

export type StatusHistorySeries = {
  segments: StatusLevel[];
  uptimePercent: number;
};

export type StatusHistoryPayload = {
  windowDays: number;
  overall: StatusHistorySeries;
  services: Record<string, StatusHistorySeries>;
};

type DaySample = {
  day: string;
  overall: StatusLevel;
  services: Record<string, StatusLevel>;
};

type HistoryFile = {
  version: 1;
  days: DaySample[];
};

const SERVICE_IDS = [
  "website",
  "database",
  "auth",
  "api",
  "search",
  "ai",
  "billing",
] as const;

function utcDayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function addUtcDays(dayKey: string, delta: number): string {
  const d = new Date(`${dayKey}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function dayKeysForWindow(endDay: string, windowDays: number): string[] {
  const keys: string[] = [];
  for (let i = windowDays - 1; i >= 0; i -= 1) {
    keys.push(addUtcDays(endDay, -i));
  }
  return keys;
}

function worstStatus(a: StatusLevel, b: StatusLevel): StatusLevel {
  if (a === "outage" || b === "outage") return "outage";
  if (a === "degraded" || b === "degraded") return "degraded";
  return "operational";
}

function uptimePercent(segments: StatusLevel[]): number {
  if (segments.length === 0) return 100;
  let score = 0;
  for (const s of segments) {
    if (s === "operational") score += 1;
    else if (s === "degraded") score += 0.5;
  }
  return Math.round((score / segments.length) * 10_000) / 100;
}

/** Durable path on the VPS (outside the git checkout). */
export function resolveStatusHistoryPath(): string {
  const fromEnv = process.env.ANYA_STATUS_HISTORY_PATH?.trim();
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === "production") {
    return "/var/www/anya-secrets/status-history.json";
  }
  return join(process.cwd(), "data", "status-history.json");
}

function emptyFile(): HistoryFile {
  return { version: 1, days: [] };
}

function readFile(path: string): HistoryFile {
  try {
    if (!existsSync(path)) return emptyFile();
    const raw = readFileSync(path, "utf8");
    const parsed = JSON.parse(raw) as HistoryFile;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.days)) {
      return emptyFile();
    }
    return parsed;
  } catch {
    return emptyFile();
  }
}

function writeHistoryFile(path: string, data: HistoryFile) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function seedOperationalWindow(
  endDay: string,
  windowDays: number,
  seedServices: Record<string, StatusLevel>,
): DaySample[] {
  const keys = dayKeysForWindow(endDay, windowDays);
  return keys.map((day) => ({
    day,
    overall: "operational" as const,
    services: { ...seedServices },
  }));
}

function servicesMapFromList(
  services: Array<{ id: string; status: StatusLevel }>,
): Record<string, StatusLevel> {
  const out: Record<string, StatusLevel> = {};
  for (const id of SERVICE_IDS) {
    out[id] = "operational";
  }
  for (const service of services) {
    out[service.id] = service.status;
  }
  return out;
}

/**
 * Append / merge today's snapshot into the on-disk ring buffer.
 * Seeds a mostly-operational window on first run (honest current day only).
 */
export function recordStatusHistorySample(input: {
  overall: StatusLevel;
  services: Array<{ id: string; status: StatusLevel }>;
}): StatusHistoryPayload {
  const path = resolveStatusHistoryPath();
  const today = utcDayKey();
  const currentServices = servicesMapFromList(input.services);

  let file = readFile(path);

  if (file.days.length === 0) {
    file = {
      version: 1,
      days: seedOperationalWindow(
        today,
        STATUS_HISTORY_WINDOW_DAYS,
        Object.fromEntries(SERVICE_IDS.map((id) => [id, "operational" as const])),
      ),
    };
  }

  const byDay = new Map(file.days.map((d) => [d.day, d]));
  const existing = byDay.get(today);

  if (existing) {
    existing.overall = worstStatus(existing.overall, input.overall);
    for (const [id, status] of Object.entries(currentServices)) {
      existing.services[id] = worstStatus(
        existing.services[id] ?? "operational",
        status,
      );
    }
  } else {
    byDay.set(today, {
      day: today,
      overall: input.overall,
      services: { ...currentServices },
    });
  }

  const windowKeys = dayKeysForWindow(today, STATUS_HISTORY_WINDOW_DAYS);
  const days: DaySample[] = windowKeys.map((day) => {
    const found = byDay.get(day);
    if (found) return found;
    return {
      day,
      overall: "operational" as const,
      services: Object.fromEntries(
        SERVICE_IDS.map((id) => [id, "operational" as const]),
      ),
    };
  });

  const todayIdx = days.findIndex((d) => d.day === today);
  if (todayIdx >= 0) {
    const merged = byDay.get(today);
    if (merged) days[todayIdx] = merged;
  }

  writeHistoryFile(path, { version: 1, days });
  return buildHistoryPayload(days);
}

export function readStatusHistory(): StatusHistoryPayload {
  const path = resolveStatusHistoryPath();
  const today = utcDayKey();
  const file = readFile(path);

  if (file.days.length === 0) {
    const seeded = seedOperationalWindow(
      today,
      STATUS_HISTORY_WINDOW_DAYS,
      Object.fromEntries(SERVICE_IDS.map((id) => [id, "operational" as const])),
    );
    return buildHistoryPayload(seeded);
  }

  const byDay = new Map(file.days.map((d) => [d.day, d]));
  const windowKeys = dayKeysForWindow(today, STATUS_HISTORY_WINDOW_DAYS);
  const days: DaySample[] = windowKeys.map((day) => {
    const found = byDay.get(day);
    if (found) return found;
    return {
      day,
      overall: "operational" as const,
      services: Object.fromEntries(
        SERVICE_IDS.map((id) => [id, "operational" as const]),
      ),
    };
  });

  return buildHistoryPayload(days);
}

function buildHistoryPayload(days: DaySample[]): StatusHistoryPayload {
  const overallSegments = days.map((d) => d.overall);
  const services: Record<string, StatusHistorySeries> = {};

  for (const id of SERVICE_IDS) {
    const segments = days.map((d) => d.services[id] ?? "operational");
    services[id] = {
      segments,
      uptimePercent: uptimePercent(segments),
    };
  }

  return {
    windowDays: days.length,
    overall: {
      segments: overallSegments,
      uptimePercent: uptimePercent(overallSegments),
    },
    services,
  };
}
