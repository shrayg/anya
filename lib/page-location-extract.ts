import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { searchSerper, type SerperOrganic } from "@/lib/serp/serper";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/** Domains that rarely hold postal contact blocks next to an email. */
const SKIP_HOST_RE =
  /(^|\.)(linkedin|facebook|fb\.com|instagram|twitter|x\.com|youtube|tiktok|google|bing|duckduckgo|yahoo|reddit|pinterest|wikipedia|apple\.com|microsoft\.com|github\.com|npmjs\.com)\b/i;

const MAX_PAGES = 5;
const MAX_PAGE_BYTES = 450_000;
const WINDOW_CHARS = 420;

export type PageLocationFinding = {
  url: string;
  domain: string;
  title: string | null;
  addresses: string[];
  phones: string[];
  snippet: string | null;
  /** Where the location signal was found relative to the identifier. */
  proximity: "snippet" | "page-near-identifier" | "page";
  confidence: "high" | "medium" | "low";
};

export type PageLocationExtractResult = {
  identifier: string;
  findings: PageLocationFinding[];
  organicsChecked: number;
  pagesFetched: number;
};

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** US-ish postal / PO Box / city-state-ZIP patterns. */
function extractAddresses(text: string): string[] {
  const found = new Set<string>();

  const patterns: RegExp[] = [
    /P\.?\s*O\.?\s*Box\s+\d+[,.\s]+[A-Za-z][A-Za-z\s.'-]{1,40}?,?\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?(?:\s*,?\s*(?:USA|United States))?/gi,
    /\d{1,5}\s+[A-Za-z0-9][A-Za-z0-9.'#\-\s]{2,60}?\b(?:Street|St\.?|Avenue|Ave\.?|Road|Rd\.?|Boulevard|Blvd\.?|Drive|Dr\.?|Lane|Ln\.?|Way|Court|Ct\.?|Place|Pl\.?|Circle|Cir\.?|Highway|Hwy\.?)\b[.,\s]+[A-Za-z][A-Za-z\s.'-]{1,40}?,?\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?/gi,
    /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3}\s+[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/g,
  ];

  for (const re of patterns) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;

    while ((m = re.exec(text)) !== null) {
      const cleaned = m[0].replace(/\s+/g, " ").trim();

      if (cleaned.length >= 8 && cleaned.length <= 160) {
        found.add(cleaned);
      }
    }
  }

  return [...found];
}

function extractPhones(text: string): string[] {
  const found = new Set<string>();
  const re =
    /(?:\+?001[-\s.]?)?(?:\+?1[-\s.]?)?(?:\(?\d{3}\)?[-\s.]?\d{3}[-\s.]?\d{4}|\d{10})\b/g;
  let m: RegExpExecArray | null;

  while ((m = re.exec(text)) !== null) {
    const digits = m[0].replace(/\D/g, "");

    if (digits.length >= 10 && digits.length <= 13) {
      found.add(m[0].replace(/\s+/g, " ").trim());
    }
  }

  return [...found];
}

function windowsAroundNeedle(text: string, needle: string): string[] {
  const lower = text.toLowerCase();
  const n = needle.toLowerCase();
  const windows: string[] = [];
  let from = 0;

  while (from < lower.length) {
    const idx = lower.indexOf(n, from);

    if (idx < 0) break;

    const start = Math.max(0, idx - WINDOW_CHARS);
    const end = Math.min(text.length, idx + needle.length + WINDOW_CHARS);

    windows.push(text.slice(start, end));
    from = idx + needle.length;
    if (windows.length >= 6) break;
  }

  return windows;
}

function rankFinding(f: PageLocationFinding): number {
  const conf = f.confidence === "high" ? 3 : f.confidence === "medium" ? 2 : 1;
  const prox =
    f.proximity === "page-near-identifier"
      ? 30
      : f.proximity === "snippet"
        ? 20
        : 10;

  return conf * 10 + prox + f.addresses.length * 2 + f.phones.length;
}

function findingFromOrganic(
  row: SerperOrganic,
  identifier: string,
): PageLocationFinding | null {
  const url = row.link?.trim();

  if (!url) return null;

  const domain = hostOf(url);

  if (!domain || SKIP_HOST_RE.test(domain)) return null;

  const blob = `${row.title ?? ""} ${row.snippet ?? ""}`;
  const addresses = extractAddresses(blob);
  const phones = extractPhones(blob);
  const idInSnippet = blob.toLowerCase().includes(identifier.toLowerCase());

  if (addresses.length === 0 && phones.length === 0) return null;

  const confidence: PageLocationFinding["confidence"] =
    addresses.length > 0 && idInSnippet
      ? "high"
      : addresses.length > 0
        ? "medium"
        : "low";

  return {
    url,
    domain,
    title: row.title ?? null,
    addresses,
    phones,
    snippet: row.snippet ?? null,
    proximity: "snippet",
    confidence,
  };
}

async function fetchPageText(url: string): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(url, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      },
      cache: "no-store",
      timeoutMs: 10_000,
    });

    if (!res.ok) return null;

    const ctype = res.headers.get("content-type") || "";

    if (!/html|text|xml/i.test(ctype) && ctype.length > 0) return null;

    const buf = await res.arrayBuffer();
    const slice = buf.byteLength > MAX_PAGE_BYTES ? buf.slice(0, MAX_PAGE_BYTES) : buf;
    const html = new TextDecoder("utf-8", { fatal: false }).decode(slice);

    return stripHtml(html);
  } catch {
    return null;
  }
}

function findingFromPage(input: {
  url: string;
  domain: string;
  title: string | null;
  snippet: string | null;
  text: string;
  identifier: string;
}): PageLocationFinding | null {
  const nearWindows = windowsAroundNeedle(input.text, input.identifier);
  const nearBlob = nearWindows.join(" \n ");
  const nearAddresses = extractAddresses(nearBlob);
  const nearPhones = extractPhones(nearBlob);

  if (nearAddresses.length > 0 || nearPhones.length > 0) {
    return {
      url: input.url,
      domain: input.domain,
      title: input.title,
      addresses: nearAddresses,
      phones: nearPhones,
      snippet: input.snippet,
      proximity: "page-near-identifier",
      confidence: nearAddresses.length > 0 ? "high" : "medium",
    };
  }

  const pageAddresses = extractAddresses(input.text);
  const pagePhones = extractPhones(input.text);

  if (pageAddresses.length === 0 && pagePhones.length === 0) return null;

  // Only keep page-wide hits when the identifier also appears on the page.
  if (!input.text.toLowerCase().includes(input.identifier.toLowerCase())) {
    return null;
  }

  return {
    url: input.url,
    domain: input.domain,
    title: input.title,
    addresses: pageAddresses.slice(0, 4),
    phones: pagePhones.slice(0, 4),
    snippet: input.snippet,
    proximity: "page",
    confidence: "low",
  };
}

/**
 * After a SERP for an email/phone, scrape result pages for postal/phone
 * contact blocks that appear next to that identifier (Contact Us / FAQ style).
 */
export async function extractLocationsFromIdentifier(input: {
  identifier: string;
  /** Cap page fetches (snippets always scanned). */
  maxPages?: number;
}): Promise<PageLocationExtractResult> {
  const identifier = input.identifier.trim();
  const maxPages = input.maxPages ?? MAX_PAGES;

  if (!identifier) {
    return {
      identifier,
      findings: [],
      organicsChecked: 0,
      pagesFetched: 0,
    };
  }

  const organics = await searchSerper(`"${identifier}"`, 12);
  const byUrl = new Map<string, PageLocationFinding>();

  for (const row of organics) {
    const fromSnippet = findingFromOrganic(row, identifier);

    if (fromSnippet) byUrl.set(fromSnippet.url, fromSnippet);
  }

  const candidates = organics
    .map((row) => {
      const url = row.link?.trim();
      const domain = url ? hostOf(url) : null;

      if (!url || !domain || SKIP_HOST_RE.test(domain)) return null;

      const hint = `${row.title ?? ""} ${url}`.toLowerCase();
      const priority = /contact|about|faq|impressum|privacy|support/.test(hint)
        ? 0
        : byUrl.has(url)
          ? 1
          : 2;

      return { row, url, domain, priority };
    })
    .filter(Boolean) as Array<{
    row: SerperOrganic;
    url: string;
    domain: string;
    priority: number;
  }>;

  candidates.sort((a, b) => a.priority - b.priority);

  let pagesFetched = 0;

  for (const cand of candidates.slice(0, maxPages)) {
    pagesFetched += 1;
    const text = await fetchPageText(cand.url);

    if (!text) continue;

    const fromPage = findingFromPage({
      url: cand.url,
      domain: cand.domain,
      title: cand.row.title ?? null,
      snippet: cand.row.snippet ?? null,
      text,
      identifier,
    });

    if (!fromPage) continue;

    const prev = byUrl.get(cand.url);

    if (!prev || rankFinding(fromPage) > rankFinding(prev)) {
      if (prev) {
        byUrl.set(cand.url, {
          ...fromPage,
          addresses: [...new Set([...fromPage.addresses, ...prev.addresses])],
          phones: [...new Set([...fromPage.phones, ...prev.phones])],
          snippet: fromPage.snippet || prev.snippet,
        });
      } else {
        byUrl.set(cand.url, fromPage);
      }
    }
  }

  const findings = [...byUrl.values()].sort(
    (a, b) => rankFinding(b) - rankFinding(a),
  );

  return {
    identifier,
    findings,
    organicsChecked: organics.length,
    pagesFetched,
  };
}
