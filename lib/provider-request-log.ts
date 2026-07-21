/**
 * In-memory last-call map for provider HTTP traffic.
 * Updated from BreachHub / CSINT fetch helpers and health probes.
 */

export type ProviderRequestLogEntry = {
  gateway: string;
  path: string;
  method: string;
  ok: boolean;
  latencyMs: number;
  statusCode?: number;
  error?: string;
  at: string;
};

const MAX_ENTRIES = 500;

const byKey = new Map<string, ProviderRequestLogEntry>();

function keyFor(gateway: string, path: string, method = "GET"): string {
  return `${gateway}|${method.toUpperCase()}|${path}`;
}

export function recordProviderRequest(
  entry: Omit<ProviderRequestLogEntry, "at"> & { at?: string },
): void {
  const normalized: ProviderRequestLogEntry = {
    ...entry,
    method: entry.method.toUpperCase(),
    at: entry.at ?? new Date().toISOString(),
  };
  const key = keyFor(normalized.gateway, normalized.path, normalized.method);

  byKey.set(key, normalized);

  if (byKey.size > MAX_ENTRIES) {
    const oldest = byKey.keys().next().value;

    if (oldest) byKey.delete(oldest);
  }
}

export function getProviderRequest(
  gateway: string,
  path: string,
  method = "GET",
): ProviderRequestLogEntry | undefined {
  return byKey.get(keyFor(gateway, path, method));
}

export function getProviderRequestsForGateway(
  gateway: string,
): ProviderRequestLogEntry[] {
  const out: ProviderRequestLogEntry[] = [];

  for (const entry of byKey.values()) {
    if (entry.gateway === gateway) out.push(entry);
  }

  return out.sort((a, b) => b.at.localeCompare(a.at));
}

export function listProviderRequests(): ProviderRequestLogEntry[] {
  return [...byKey.values()].sort((a, b) => b.at.localeCompare(a.at));
}
