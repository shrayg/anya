import { fetchWithTimeout } from "@/lib/fetch-with-timeout";

export type CombCredential = {
  identifier: string;
  secret: string;
  raw: string;
};

export type CombSearchResult = {
  source: string;
  query: string;
  totalMatches: number;
  returned: number;
  start: number;
  credentials: CombCredential[];
  message?: string;
};

export function parseCombLine(line: string): CombCredential {
  const trimmed = line.trim();

  if (!trimmed) {
    return { identifier: "", secret: "", raw: trimmed };
  }

  if (trimmed.includes("\t")) {
    const [identifier = "", secret = ""] = trimmed.split("\t");
    return { identifier, secret, raw: trimmed };
  }

  const colon = trimmed.indexOf(":");

  if (colon === -1) {
    return { identifier: trimmed, secret: "", raw: trimmed };
  }

  return {
    identifier: trimmed.slice(0, colon),
    secret: trimmed.slice(colon + 1),
    raw: trimmed,
  };
}

export function getEmailDomain(identifier: string): string | null {
  const trimmed = identifier.trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");

  if (at <= 0 || at === trimmed.length - 1) return null;

  return trimmed.slice(at + 1);
}

export function credentialMatchesDomain(
  identifier: string,
  domain: string,
): boolean {
  const target = domain.toLowerCase();
  const emailDomain = getEmailDomain(identifier);

  if (!emailDomain) return false;

  return emailDomain === target || emailDomain.endsWith(`.${target}`);
}

export function filterCredentialsForDomain(
  credentials: CombCredential[],
  domain: string,
): CombCredential[] {
  return credentials.filter((row) => credentialMatchesDomain(row.identifier, domain));
}

export function normalizeEmail(input: string): string | null {
  const trimmed = input.trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return null;
  }

  return trimmed;
}

export function credentialMatchesEmail(
  identifier: string,
  email: string,
): boolean {
  return identifier.trim().toLowerCase() === email.toLowerCase();
}

export function filterCredentialsForEmail(
  credentials: CombCredential[],
  email: string,
): CombCredential[] {
  return credentials.filter((row) => credentialMatchesEmail(row.identifier, email));
}

export async function searchProxynovaCombForEmail(
  email: string,
  options?: { start?: number; limit?: number },
): Promise<CombSearchResult> {
  const raw = await searchProxynovaComb(email, options);
  const credentials = filterCredentialsForEmail(raw.credentials, email);

  return {
    ...raw,
    query: email,
    source: "Breached Data",
    totalMatches: credentials.length,
    returned: credentials.length,
    credentials,
  };
}

export async function searchProxynovaCombForDomain(
  domain: string,
  options?: { start?: number; limit?: number },
): Promise<CombSearchResult> {
  const raw = await searchProxynovaComb(domain, options);
  const credentials = filterCredentialsForDomain(raw.credentials, domain);

  return {
    ...raw,
    query: domain,
    source: "Breached Data",
    totalMatches: credentials.length,
    returned: credentials.length,
    credentials,
  };
}

export async function searchProxynovaComb(
  query: string,
  options?: { start?: number; limit?: number },
): Promise<CombSearchResult> {
  const start = Math.max(0, options?.start ?? 0);
  const limit = Math.min(Math.max(1, options?.limit ?? 100), 100);

  const url = new URL("https://api.proxynova.com/comb");
  url.searchParams.set("query", query);
  url.searchParams.set("start", String(start));
  url.searchParams.set("limit", String(limit));

  const res = await fetchWithTimeout(url.toString(), {
    cache: "no-store",
    headers: { Accept: "application/json" },
    timeoutMs: 20_000,
  });

  if (res.status === 429) {
    throw new Error("Rate limited — ProxyNova allows about 100 requests per minute.");
  }

  if (!res.ok) {
    throw new Error(`ProxyNova COMB returned ${res.status}`);
  }

  const data = (await res.json()) as { count?: number; lines?: string[] };
  const lines = Array.isArray(data.lines) ? data.lines : [];
  const credentials = lines
    .map(parseCombLine)
    .filter((row) => row.identifier || row.secret);

  return {
    source: "Breached Data",
    query,
    totalMatches: typeof data.count === "number" ? data.count : credentials.length,
    returned: credentials.length,
    start,
    credentials,
  };
}
