import { fetchWithTimeout } from "@/lib/fetch-with-timeout";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export type SerperOrganic = {
  title?: string;
  link?: string;
  snippet?: string;
};

export function getSerperApiKey(): string | null {
  const key = process.env.SERPER_API_KEY?.trim();

  return key || null;
}

/** Google organic results via Serper (server-side). Empty when key missing. */
export async function searchSerper(
  q: string,
  num = 10,
): Promise<SerperOrganic[]> {
  const key = getSerperApiKey();

  if (!key) return [];

  const res = await fetchWithTimeout("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": key,
      "Content-Type": "application/json",
      "User-Agent": UA,
    },
    body: JSON.stringify({ q, num }),
    cache: "no-store",
    timeoutMs: 12_000,
  });

  if (!res.ok) return [];

  const json = (await res.json()) as { organic?: SerperOrganic[] };

  return Array.isArray(json.organic) ? json.organic : [];
}
