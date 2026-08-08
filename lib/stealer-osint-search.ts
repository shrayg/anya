/**
 * Stealer Logs OSINT fan-out — progressive multi-source assembly.
 *
 * Fans out to BreachHub stealer indexes, GodsEye/OsintCat, SeekNow, Wentyn,
 * DataVoid, OathNet, and Hudson Rock. For domain queries, also pulls Comb
 * breach credentials into a Breached Data subsection so domain searches are
 * not empty when only breach indexes have hits.
 *
 * Server-only — do not import from client modules (e.g. search-modules.ts).
 */

import {
  extractStealerArchives,
  fetchBreachHubSpecialty,
  fetchBreachHubStealerVictims,
  looksLikeVictimLogId,
  type StealerArchiveEntry,
} from "@/lib/breachhub";
import {
  filterBlacklistedCredentials,
  getCachedBlacklistSet,
  warmDataBlacklistCache,
} from "@/lib/data-blacklist";
import {
  fetchDatavoidSanitized,
  isDatavoidEnabled,
} from "@/lib/datavoid";
import { normalizeDomain } from "@/lib/domain-search";
import {
  detectHudsonRockEndpoint,
  fetchHudsonRockSanitized,
  isHudsonRockEnabled,
} from "@/lib/hudsonrock";
import {
  canContributeOathnet,
  fetchOathnetSanitized,
  isOathnetEnabled,
} from "@/lib/oathnet";
import type { PlanId } from "@/lib/plans";
import { mergeSanitizedResponses } from "@/lib/osintcat";
import { fetchCombinedStealerLogs } from "@/lib/osint-combined";
import {
  searchProxynovaCombForDomain,
  type CombSearchResult,
} from "@/lib/proxynova-comb";
import {
  fetchSeekNowSanitized,
  isSeekNowEnabled,
} from "@/lib/seeknow";
import {
  archivesFromStealerResults,
  extractStealerCredentialRows,
  mergeStealerArchives,
  type StealerCredentialRow,
} from "@/lib/stealer-logs-view";
import {
  fetchWentynSanitized,
  isWentynEnabled,
} from "@/lib/wentyn";

export type StealerOsintResult = {
  query: string;
  count: number;
  results: unknown[];
  credentials: StealerCredentialRow[];
  archives: StealerArchiveEntry[];
  sources: Record<string, { ok: boolean; count: number }>;
  /** Comb / breach-index hits for domain queries (shown as Breached Data). */
  breachedData?: CombSearchResult | null;
};

export type StealerOsintProgressEvent =
  | {
      type: "partial";
      module: string;
      done: number;
      total: number;
      result: StealerOsintResult;
    }
  | { type: "done"; result: StealerOsintResult };

export type StealerOsintSearchOpts = {
  /** Ultimate+ native OathNet contribution (stealer / victims / subdomain). */
  includeOathnet?: boolean;
  plan?: PlanId | null;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const IPV4_RE = /^(?:\d{1,3}\.){3}\d{1,3}$/;
const DOMAIN_RE =
  /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i;

function emptyResult(query: string): StealerOsintResult {
  return {
    query,
    count: 0,
    results: [],
    credentials: [],
    archives: [],
    sources: {},
    breachedData: null,
  };
}

function asResults(
  data: { count?: number; results?: unknown[] } | null | undefined,
): unknown[] {
  return Array.isArray(data?.results) ? data.results : [];
}

/**
 * Run the full stealer fan-out. Calls `onEvent` as each module settles so
 * callers can stream NDJSON / update UI progressively.
 *
 * OathNet stealer / victims / subdomain require Ultimate+ (`includeOathnet`).
 */
export async function runStealerOsintSearch(
  rawQuery: string,
  onEventOrOpts?:
    | ((event: StealerOsintProgressEvent) => void)
    | StealerOsintSearchOpts,
  maybeOnEvent?: (event: StealerOsintProgressEvent) => void,
): Promise<StealerOsintResult> {
  const opts: StealerOsintSearchOpts =
    onEventOrOpts && typeof onEventOrOpts === "object" ? onEventOrOpts : {};
  const onEvent =
    typeof onEventOrOpts === "function" ? onEventOrOpts : maybeOnEvent;
  const includeOathnet =
    opts.includeOathnet === true &&
    (opts.plan ? canContributeOathnet(opts.plan) : isOathnetEnabled());

  const domain = normalizeDomain(rawQuery);
  const query = domain ?? rawQuery.trim();
  const isDomain = Boolean(domain) || DOMAIN_RE.test(query);
  const isEmail = EMAIL_RE.test(query);
  const isIp = IPV4_RE.test(query) || query.includes(":");
  const isVictimIdQuery =
    !isEmail &&
    !isDomain &&
    !isIp &&
    looksLikeVictimLogId(query);

  let combinedResults: unknown[] = [];
  let seeknowResults: unknown[] = [];
  let wentynResults: unknown[] = [];
  let datavoidResults: unknown[] = [];
  let oathnetStealerResults: unknown[] = [];
  let oathnetVictimsResults: unknown[] = [];
  let oathnetSubdomainResults: unknown[] = [];
  let oathnetExtractResults: unknown[] = [];
  let domainSpecialtyResults: unknown[] = [];
  let hudsonResults: unknown[] = [];
  let victimArchives: StealerArchiveEntry[] = [];
  let breachedData: CombSearchResult | null = null;

  const sources: Record<string, { ok: boolean; count: number }> = {};

  // Domain adds Comb. Always emit oathnet-extract + domain-specialty slots
  // (no-op when not applicable) so progressive totals stay honest.
  const MODULE_TOTAL = isDomain ? 11 : 10;
  let doneCount = 0;

  await warmDataBlacklistCache();

  const assemble = (): StealerOsintResult => {
    const merged = mergeSanitizedResponses(
      { count: combinedResults.length, results: combinedResults },
      { count: seeknowResults.length, results: seeknowResults },
      { count: wentynResults.length, results: wentynResults },
      { count: datavoidResults.length, results: datavoidResults },
      { count: oathnetStealerResults.length, results: oathnetStealerResults },
      { count: oathnetVictimsResults.length, results: oathnetVictimsResults },
      {
        count: oathnetSubdomainResults.length,
        results: oathnetSubdomainResults,
      },
      {
        count: oathnetExtractResults.length,
        results: oathnetExtractResults,
      },
      {
        count: domainSpecialtyResults.length,
        results: domainSpecialtyResults,
      },
      { count: hudsonResults.length, results: hudsonResults },
    );

    const results = Array.isArray(merged.results) ? merged.results : [];
    const credentials = extractStealerCredentialRows(results, query);
    const archives = mergeStealerArchives(
      victimArchives,
      extractStealerArchives({ results }),
      archivesFromStealerResults(results),
    );

    const mergedCredentials =
      credentials.length > 0
        ? credentials
        : extractStealerCredentialRows(
            archives.flatMap((a) => a.credentials ?? []),
            query,
          );

    const breachCount = breachedData?.credentials?.length ?? 0;

    return {
      query,
      count: Math.max(
        merged.count,
        results.length,
        mergedCredentials.length,
        archives.length,
        breachCount,
      ),
      results,
      credentials: mergedCredentials,
      archives,
      sources: { ...sources },
      breachedData,
    };
  };

  const emit = (module: string) => {
    doneCount += 1;
    onEvent?.({
      type: "partial",
      module,
      done: doneCount,
      total: MODULE_TOTAL,
      result: assemble(),
    });
  };

  const markSource = (id: string, count: number, ok = true) => {
    sources[id] = { ok, count };
  };

  const tasks: Promise<void>[] = [
    fetchCombinedStealerLogs(query, "stealer-logs")
      .then((data) => {
        combinedResults = asResults(data);
        markSource("combined", combinedResults.length);
        emit("combined");
      })
      .catch(() => {
        markSource("combined", 0, false);
        emit("combined");
      }),

    fetchBreachHubStealerVictims(query, 18_000)
      .then((archives) => {
        victimArchives = Array.isArray(archives) ? archives : [];
        markSource("victims", victimArchives.length);
        emit("victims");
      })
      .catch(() => {
        markSource("victims", 0, false);
        emit("victims");
      }),

    (async () => {
      if (!isSeekNowEnabled()) {
        markSource("seeknow", 0, false);
        emit("seeknow");
        return;
      }

      try {
        const data = await fetchSeekNowSanitized("stealer", { query });
        seeknowResults = asResults(data);
        markSource("seeknow", seeknowResults.length);
      } catch {
        markSource("seeknow", 0, false);
      }
      emit("seeknow");
    })(),

    (async () => {
      if (!isWentynEnabled() || (!isEmail && !isDomain)) {
        markSource("wentyn", 0, false);
        emit("wentyn");
        return;
      }

      try {
        const data = await fetchWentynSanitized(query);
        wentynResults = asResults(data);
        markSource("wentyn", wentynResults.length);
      } catch {
        markSource("wentyn", 0, false);
      }
      emit("wentyn");
    })(),

    (async () => {
      if (!isDatavoidEnabled()) {
        markSource("datavoid", 0, false);
        emit("datavoid");
        return;
      }

      try {
        const data = await fetchDatavoidSanitized("stealer", { query });
        datavoidResults = asResults(data);
        markSource("datavoid", datavoidResults.length);
      } catch {
        markSource("datavoid", 0, false);
      }
      emit("datavoid");
    })(),

    (async () => {
      if (!includeOathnet) {
        markSource("oathnet-stealer", 0, false);
        markSource("oathnet-victims", 0, false);
        emit("oathnet");
        return;
      }

      try {
        const jobs: Array<Promise<unknown>> = [
          fetchOathnetSanitized(
            { kind: "static", endpoint: "stealer" },
            { query },
          ),
          fetchOathnetSanitized(
            { kind: "static", endpoint: "victims" },
            { query },
          ),
        ];

        // Pasted log / victim id → also fetch that victim manifest directly.
        if (isVictimIdQuery) {
          jobs.push(
            fetchOathnetSanitized(
              { kind: "victims-log", logId: query },
              { query },
            ),
          );
        }

        const settled = await Promise.allSettled(jobs);
        const stealer = settled[0] as PromiseSettledResult<{
          results?: unknown[];
          raw?: Record<string, unknown>;
        }>;
        const victims = settled[1] as PromiseSettledResult<{
          results?: unknown[];
          raw?: Record<string, unknown>;
        }>;
        const victimLog = isVictimIdQuery
          ? (settled[2] as PromiseSettledResult<{
              results?: unknown[];
              raw?: Record<string, unknown>;
            }>)
          : null;

        if (stealer.status === "fulfilled") {
          oathnetStealerResults = asResults(stealer.value);
          markSource("oathnet-stealer", oathnetStealerResults.length);
          victimArchives = mergeStealerArchives(
            victimArchives,
            extractStealerArchives({ results: oathnetStealerResults }),
            archivesFromStealerResults(oathnetStealerResults),
          );
        } else {
          markSource("oathnet-stealer", 0, false);
        }

        if (victims.status === "fulfilled") {
          oathnetVictimsResults = asResults(victims.value);
          markSource("oathnet-victims", oathnetVictimsResults.length);
          victimArchives = mergeStealerArchives(
            victimArchives,
            extractStealerArchives({ results: oathnetVictimsResults }),
            extractStealerArchives(victims.value.raw ?? {}),
          );
        } else {
          markSource("oathnet-victims", 0, false);
        }

        if (victimLog?.status === "fulfilled") {
          victimArchives = mergeStealerArchives(
            victimArchives,
            extractStealerArchives({ results: asResults(victimLog.value) }),
            extractStealerArchives(victimLog.value.raw ?? {}),
            archivesFromStealerResults(asResults(victimLog.value)),
          );
        }
      } catch {
        markSource("oathnet-stealer", 0, false);
        markSource("oathnet-victims", 0, false);
      }
      emit("oathnet");
    })(),

    (async () => {
      if (!includeOathnet || !isDomain) {
        markSource("oathnet-subdomain", 0, false);
        emit("oathnet-subdomain");
        return;
      }

      try {
        const data = await fetchOathnetSanitized(
          { kind: "static", endpoint: "stealer-subdomain" },
          { query },
        );
        oathnetSubdomainResults = asResults(data);
        markSource("oathnet-subdomain", oathnetSubdomainResults.length);
      } catch {
        markSource("oathnet-subdomain", 0, false);
      }
      emit("oathnet-subdomain");
    })(),

    (async () => {
      if (!includeOathnet || !isDomain) {
        markSource("oathnet-extract", 0, false);
        emit("oathnet-extract");
        return;
      }

      try {
        const data = await fetchOathnetSanitized(
          { kind: "static", endpoint: "extract-subdomain" },
          { domain: query, query },
        );
        oathnetExtractResults = asResults(data);
        markSource("oathnet-extract", oathnetExtractResults.length);
      } catch {
        markSource("oathnet-extract", 0, false);
      }
      emit("oathnet-extract");
    })(),

    (async () => {
      if (!isDomain) {
        markSource("domain-specialty", 0, false);
        emit("domain-specialty");
        return;
      }

      try {
        const data = await fetchBreachHubSpecialty("domain", query);
        domainSpecialtyResults = asResults(data);
        markSource("domain-specialty", domainSpecialtyResults.length);
      } catch {
        markSource("domain-specialty", 0, false);
      }
      emit("domain-specialty");
    })(),

    (async () => {
      if (!isHudsonRockEnabled()) {
        markSource("hudsonrock", 0, false);
        emit("hudsonrock");
        return;
      }

      const endpoint = detectHudsonRockEndpoint(query);
      const input: Record<string, string> = { query };

      if (isEmail) input.email = query;
      if (isIp) input.ip = query;
      if (isDomain) input.domain = query;

      // Fan out to every Hudson Rock surface that fits the query shape
      // (login / keyword / infection), not only the primary detector hit.
      const hudsonJobs: Array<Promise<unknown[]>> = [
        fetchHudsonRockSanitized(endpoint, input)
          .then(asResults)
          .catch(() => []),
        fetchHudsonRockSanitized("search-by-stealer/infection-analysis", {
          stealer: query,
          query,
        })
          .then(asResults)
          .catch(() => []),
      ];

      if (isEmail) {
        hudsonJobs.push(
          fetchHudsonRockSanitized("search-by-login/emails", {
            email: query,
            query,
          })
            .then(asResults)
            .catch(() => []),
        );
      } else if (isIp) {
        hudsonJobs.push(
          fetchHudsonRockSanitized("search-by-ip", { ip: query, query })
            .then(asResults)
            .catch(() => []),
        );
      } else if (isDomain) {
        hudsonJobs.push(
          fetchHudsonRockSanitized("search-by-domain", {
            domain: query,
            query,
          })
            .then(asResults)
            .catch(() => []),
        );
      } else {
        hudsonJobs.push(
          fetchHudsonRockSanitized("search-by-login/usernames", {
            username: query,
            query,
          })
            .then(asResults)
            .catch(() => []),
          fetchHudsonRockSanitized("search-by-keyword", {
            keyword: query,
            query,
          })
            .then(asResults)
            .catch(() => []),
          fetchHudsonRockSanitized("search-by-keyword/urls", {
            keyword: query,
            query,
          })
            .then(asResults)
            .catch(() => []),
        );
      }

      try {
        const chunks = await Promise.all(hudsonJobs);
        hudsonResults = chunks.flat();
        markSource("hudsonrock", hudsonResults.length);
      } catch {
        markSource("hudsonrock", 0, false);
      }
      emit("hudsonrock");
    })(),
  ];

  if (isDomain) {
    tasks.push(
      searchProxynovaCombForDomain(query, {
        limit: 250_000,
        budgetMs: 48_000,
      })
        .then((comb) => {
          const credentials = filterBlacklistedCredentials(
            comb.credentials ?? [],
            getCachedBlacklistSet(),
          );
          breachedData = {
            ...comb,
            credentials,
            totalMatches: credentials.length,
            returned: credentials.length,
          };
          markSource("comb-breach", credentials.length);
          emit("comb-breach");
        })
        .catch(() => {
          breachedData = null;
          markSource("comb-breach", 0, false);
          emit("comb-breach");
        }),
    );
  }

  await Promise.all(tasks);

  const final = assemble();
  onEvent?.({ type: "done", result: final });

  return final;
}
