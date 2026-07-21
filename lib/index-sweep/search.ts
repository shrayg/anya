import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import {
  INDEX_SWEEP_UNSUPPORTED,
  platformsForQueryType,
  type IndexSweepPlatform,
} from "@/lib/index-sweep/platforms";
import {
  detectIndexSweepKind,
  INDEX_SWEEP_INVALID_MESSAGE,
  normalizeIndexSweepEmail,
  normalizeIndexSweepPhoneDigits,
  phoneSearchVariants,
} from "@/lib/index-sweep/normalize";
import type {
  IndexSweepConfidence,
  IndexSweepDork,
  IndexSweepEngine,
  IndexSweepHit,
  IndexSweepMatchMode,
  IndexSweepSearchResult,
} from "@/lib/index-sweep/types";
import { extractLocationsFromIdentifier } from "@/lib/page-location-extract";
import { resolveLinkedInFromIdentifier } from "@/lib/profile-resolve/linkedin";
import { toUserFacingSearchMessage } from "@/lib/user-facing-errors";

export const INDEX_SWEEP_SOURCE_ID = "index-sweep" as const;
export const INDEX_SWEEP_SOURCE_LABEL = "Index Sweep";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

function engineUrl(engine: IndexSweepEngine, q: string): string {
  const encoded = encodeURIComponent(q);

  if (engine === "bing") {
    return `https://www.bing.com/search?q=${encoded}`;
  }

  if (engine === "duckduckgo") {
    return `https://duckduckgo.com/?q=${encoded}`;
  }

  return `https://www.google.com/search?q=${encoded}`;
}

function pushEngineLinks(query: string): IndexSweepDork["engines"] {
  return (
    [
      ["google", "Google"],
      ["bing", "Bing"],
      ["duckduckgo", "DuckDuckGo"],
    ] as const
  ).map(([engine, label]) => ({
    engine,
    label,
    url: engineUrl(engine, query),
  }));
}

/**
 * Loose leads never start as high confidence.
 * They can rise to medium only when corroborated by an exact-mode signal
 * on the same site (or a live exact hit).
 */
export function resolveDorkConfidence(input: {
  matchMode: IndexSweepMatchMode;
  platformReliability: IndexSweepConfidence;
  corroborated: boolean;
}): IndexSweepConfidence {
  if (input.matchMode === "exact") {
    return input.platformReliability;
  }

  // Loose: show as lead — low by default; medium only if corroborated
  if (input.corroborated) return "medium";

  return "low";
}

function buildDorks(
  kind: "email" | "phone",
  identifiers: string[],
): IndexSweepDork[] {
  const platforms = platformsForQueryType(kind);
  const dorks: IndexSweepDork[] = [];
  const primary = identifiers[0]!;

  /** Platforms where unquoted (loose) search is worth showing as a lead. */
  const looseSiteIds = new Set([
    "linkedin",
    "instagram",
    "facebook",
    "github",
    "xing",
  ]);

  for (const platform of platforms) {
    // Phone: strict-quote EVERY format variant on every phone-capable site
    const idList = kind === "phone" ? identifiers : [primary];

    for (const identifier of idList) {
      const exact = `"${identifier}" site:${platform.site}`;

      dorks.push(
        makeDork({
          platform,
          platformId: platform.id,
          platformLabel: platform.label,
          matchMode: "exact",
          query: exact,
          identifier,
          note: platform.note,
          corroborated: false,
        }),
      );
    }

    // Loose site: leads (email only — phone loose is too noisy across variants)
    if (looseSiteIds.has(platform.id) && kind === "email") {
      const loose = `${primary} site:${platform.site}`;

      dorks.push(
        makeDork({
          platform,
          platformId: `${platform.id}-loose`,
          platformLabel: `${platform.label} (loose)`,
          matchMode: "loose",
          query: loose,
          identifier: primary,
          note:
            platform.id === "instagram"
              ? "Unquoted lead — often surfaces the matching @handle when exact quotes miss. Low confidence unless an exact hit corroborates."
              : "Unquoted lead — use when exact quotes return nothing. Low confidence unless corroborated by an exact-match result.",
          corroborated: false,
        }),
      );
    }
  }

  if (kind === "phone") {
    // Strict open-web for every phone format variant
    for (const identifier of identifiers) {
      const openExact = `"${identifier}"`;

      dorks.push(
        makeDork({
          platform: {
            id: "open-web",
            label: "Open Web",
            site: "*",
            supports: "both",
            reliability: "medium",
            note: "Exact-match open web.",
          },
          platformId: "open-web",
          platformLabel: "Open Web",
          matchMode: "exact",
          query: openExact,
          identifier,
          note: "Strict quoted open-web search for this format variant.",
          corroborated: false,
        }),
      );
    }

    // Single loose open-web lead on raw digits only
    dorks.push(
      makeDork({
        platform: {
          id: "open-web",
          label: "Open Web",
          site: "*",
          supports: "both",
          reliability: "medium",
          note: "Loose open web.",
        },
        platformId: "open-web-loose",
        platformLabel: "Open Web (loose)",
        matchMode: "loose",
        query: primary,
        identifier: primary,
        note: "Unquoted digits lead. Low confidence unless an exact quoted hit corroborates.",
        corroborated: false,
      }),
    );
  } else {
    const openExact = `"${primary}"`;

    dorks.push(
      makeDork({
        platform: {
          id: "open-web",
          label: "Open Web",
          site: "*",
          supports: "email",
          reliability: "medium",
          note: "Exact-match open web.",
        },
        platformId: "open-web",
        platformLabel: "Open Web",
        matchMode: "exact",
        query: openExact,
        identifier: primary,
        note: "Exact-match across the public web — directories, pastes, and mirrors.",
        corroborated: false,
      }),
    );

    dorks.push(
      makeDork({
        platform: {
          id: "open-web",
          label: "Open Web",
          site: "*",
          supports: "email",
          reliability: "medium",
          note: "Loose open web.",
        },
        platformId: "open-web-loose",
        platformLabel: "Open Web (loose)",
        matchMode: "loose",
        query: primary,
        identifier: primary,
        note: "Unquoted email lead (often finds LinkedIn + Instagram together). Low confidence unless an exact-match hit corroborates.",
        corroborated: false,
      }),
    );
  }

  return dorks;
}

function makeDork(input: {
  platform: IndexSweepPlatform | {
    id: string;
    label: string;
    site: string;
    supports: "email" | "phone" | "both";
    reliability: IndexSweepConfidence;
    note: string;
  };
  platformId: string;
  platformLabel: string;
  matchMode: IndexSweepMatchMode;
  query: string;
  identifier: string;
  note: string;
  corroborated: boolean;
}): IndexSweepDork {
  const platformReliability = input.platform.reliability;
  const confidence = resolveDorkConfidence({
    matchMode: input.matchMode,
    platformReliability,
    corroborated: input.corroborated,
  });

  return {
    platformId: input.platformId,
    platformLabel: input.platformLabel,
    site: input.platform.site,
    platformReliability,
    confidence,
    matchMode: input.matchMode,
    corroborated: input.corroborated,
    note: input.note,
    query: input.query,
    identifier: input.identifier,
    engines: pushEngineLinks(input.query),
  };
}

/**
 * After live exact hits arrive, upgrade matching loose dorks on the same site
 * to medium (corroborated) — still never high.
 */
function corroborateLooseWithLiveHits(
  dorks: IndexSweepDork[],
  hits: IndexSweepHit[],
): IndexSweepDork[] {
  const exactHitSites = new Set(
    hits
      .filter((h) => h.matchMode === "exact")
      .map((h) => h.site.toLowerCase()),
  );

  if (exactHitSites.size === 0) return dorks;

  return dorks.map((dork) => {
    if (dork.matchMode !== "loose") return dork;

    const site = dork.site === "*" ? null : dork.site.toLowerCase();
    const corroborated = site ? exactHitSites.has(site) : false;

    if (!corroborated) return dork;

    return {
      ...dork,
      corroborated: true,
      confidence: resolveDorkConfidence({
        matchMode: "loose",
        platformReliability: dork.platformReliability,
        corroborated: true,
      }),
      note: `${dork.note} Corroborated by an exact-match live hit on this site.`,
    };
  });
}

function decodeBasicEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

async function probeDuckDuckGoLinkedIn(
  query: string,
  matchMode: IndexSweepMatchMode,
): Promise<IndexSweepHit[]> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

  try {
    const res = await fetchWithTimeout(url, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html",
        "Accept-Language": "en-US,en;q=0.9",
      },
      cache: "no-store",
      timeoutMs: 10_000,
    });

    if (!res.ok) return [];

    const html = await res.text();
    const hits: IndexSweepHit[] = [];
    const re =
      /class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?class="result__snippet"[^>]*>([\s\S]*?)<\/(?:a|td|div)>/gi;

    let match: RegExpExecArray | null;

    while ((match = re.exec(html)) && hits.length < 8) {
      let href = decodeBasicEntities(match[1] ?? "");
      const title = decodeBasicEntities(
        (match[2] ?? "").replace(/<[^>]+>/g, "").trim(),
      );
      const snippet = decodeBasicEntities(
        (match[3] ?? "").replace(/<[^>]+>/g, "").trim(),
      );

      const uddg = href.match(/[?&]uddg=([^&]+)/);

      if (uddg?.[1]) {
        try {
          href = decodeURIComponent(uddg[1]);
        } catch {
          // keep href
        }
      }

      if (!href.includes("linkedin.com")) continue;

      const confidence =
        matchMode === "exact"
          ? ("high" as const)
          : resolveDorkConfidence({
              matchMode: "loose",
              platformReliability: "high",
              corroborated: false,
            });

      hits.push({
        platformLabel: "LinkedIn",
        site: "linkedin.com",
        title: title || "LinkedIn result",
        url: href,
        snippet: snippet || null,
        engine: "duckduckgo",
        matchMode,
        confidence,
        corroborated: matchMode === "exact",
      });
    }

    return hits;
  } catch {
    return [];
  }
}

export async function searchIndexSweep(input: {
  query: string;
  liveProbe?: boolean;
  /** Force email|phone when auto-detect is ambiguous. */
  kind?: "email" | "phone";
}): Promise<IndexSweepSearchResult> {
  const started = Date.now();
  const kind = input.kind ?? detectIndexSweepKind(input.query);

  if (!kind) {
    throw new Error(INDEX_SWEEP_INVALID_MESSAGE);
  }

  let normalized: string;
  let variants: string[];

  if (kind === "email") {
    const email = normalizeIndexSweepEmail(input.query);

    if (!email) throw new Error(INDEX_SWEEP_INVALID_MESSAGE);
    normalized = email;
    variants = [email];
  } else {
    const digits = normalizeIndexSweepPhoneDigits(input.query);

    if (!digits) throw new Error(INDEX_SWEEP_INVALID_MESSAGE);
    normalized = digits;
    variants = phoneSearchVariants(digits);
  }

  let dorks = buildDorks(kind, variants);
  const liveProbe = input.liveProbe !== false;

  let hits: IndexSweepHit[] = [];
  let locations: IndexSweepSearchResult["locations"] = [];
  let linkedInResolve: IndexSweepSearchResult["linkedInResolve"] = null;

  if (liveProbe) {
    const linkedInExact = dorks.find(
      (d) => d.platformId === "linkedin" && d.matchMode === "exact",
    );

    if (linkedInExact) {
      hits = await probeDuckDuckGoLinkedIn(linkedInExact.query, "exact");
    }

    if (kind === "email") {
      const [resolved, locationExtract] = await Promise.all([
        resolveLinkedInFromIdentifier({
          query: normalized,
          kind: "email",
        }),
        extractLocationsFromIdentifier({ identifier: normalized }),
      ]);

      linkedInResolve = {
        hits: resolved.hits,
        pivots: resolved.pivots,
        methodsTried: resolved.methodsTried,
        warning: toUserFacingSearchMessage(resolved.warning, {
          omitInternal: true,
        }) || undefined,
      };

      locations = locationExtract.findings.map((row) => ({
        url: row.url,
        domain: row.domain,
        title: row.title,
        addresses: row.addresses,
        phones: row.phones,
        snippet: row.snippet,
        proximity: row.proximity,
        confidence: row.confidence,
      }));

      // Promote high-confidence SERP LinkedIn hits into the live hit list.
      for (const hit of resolved.hits) {
        if (hit.confidence !== "high") continue;

        hits.push({
          platformLabel: "LinkedIn",
          site: "linkedin.com",
          title: hit.title || `LinkedIn · ${hit.publicIdentifier}`,
          url: hit.profileUrl,
          snippet: hit.snippet,
          engine: "google",
          matchMode: "exact",
          confidence: "high",
          corroborated: true,
        });
      }
    } else if (kind === "phone") {
      const locationExtract = await extractLocationsFromIdentifier({
        identifier: normalized,
        maxPages: 4,
      });

      locations = locationExtract.findings.map((row) => ({
        url: row.url,
        domain: row.domain,
        title: row.title,
        addresses: row.addresses,
        phones: row.phones,
        snippet: row.snippet,
        proximity: row.proximity,
        confidence: row.confidence,
      }));
    }
  }

  dorks = corroborateLooseWithLiveHits(dorks, hits);

  const durationMs = Date.now() - started;
  const unsupportedNote = INDEX_SWEEP_UNSUPPORTED.map(
    (u) => `${u.label}: ${u.reason}`,
  ).join(" ");

  const found = hits.map((hit) => ({
    siteName: hit.platformLabel,
    domain: hit.site,
    exists: true,
    rateLimit: false,
    emailrecovery: null as string | null,
    phoneNumber: kind === "phone" ? normalized : null,
    profileUrl: hit.url,
    others: {
      title: hit.title,
      ...(hit.snippet ? { snippet: hit.snippet } : {}),
      engine: hit.engine,
      matchMode: hit.matchMode,
      confidence: hit.confidence,
    } as Record<string, string>,
  }));

  const exactCount = dorks.filter((d) => d.matchMode === "exact").length;
  const looseCount = dorks.filter((d) => d.matchMode === "loose").length;

  const warningParts = [
    `Index Sweep built ${exactCount} strict (quoted) operators` +
      (kind === "phone"
        ? ` across ${variants.length} phone format variants`
        : "") +
      ` and ${looseCount} loose leads.`,
    "Loose results are shown as low-confidence leads unless corroborated by an exact-match live hit — they never score high on their own.",
    "Snapchat, Hinge, Tinder, Bumble, and TikTok remain app-walled for this method.",
  ];

  if (locations.length > 0) {
    warningParts.push(
      `Found ${locations.length} page(s) with location/contact signals next to this identifier.`,
    );
  } else if (hits.length === 0) {
    warningParts.push(
      "No live LinkedIn or location hits from the soft probe yet — strict operators remain available.",
    );
  }

  const source = {
    id: INDEX_SWEEP_SOURCE_ID,
    label: INDEX_SWEEP_SOURCE_LABEL,
    checked: dorks.length,
    count: found.length + locations.length,
    errors: 0,
    durationMs,
    found,
    warning: warningParts.join(" "),
  };

  return {
    query: input.query.trim(),
    kind,
    normalized,
    variants,
    dorks,
    hits,
    locations,
    linkedInResolve,
    unsupportedNote,
    sources: [source],
    durationMs,
    warning: source.warning,
  };
}

export { INDEX_SWEEP_INVALID_MESSAGE };
