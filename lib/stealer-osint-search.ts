/**
 * Stealer Logs OSINT fan-out — progressive multi-source assembly.
 *
 * Fans out to BreachHub stealer indexes, GodsEye/OsintCat, SeekNow, Wentyn,
 * DataVoid, OathNet, and Hudson Rock. Emits partial snapshots as each module
 * settles so the UI can paint early (same pattern as Discord ID).
 *
 * Server-only — do not import from client modules (e.g. search-modules.ts).
 */

import {
  extractStealerArchives,
  fetchBreachHubStealerVictims,
  type StealerArchiveEntry,
} from "@/lib/breachhub";
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
  fetchOathnetSanitized,
  isOathnetEnabled,
} from "@/lib/oathnet";
import { mergeSanitizedResponses } from "@/lib/osintcat";
import { fetchCombinedStealerLogs } from "@/lib/osint-combined";
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
 */
export async function runStealerOsintSearch(
  rawQuery: string,
  onEvent?: (event: StealerOsintProgressEvent) => void,
): Promise<StealerOsintResult> {
  const domain = normalizeDomain(rawQuery);
  const query = domain ?? rawQuery.trim();
  const isDomain = Boolean(domain) || DOMAIN_RE.test(query);
  const isEmail = EMAIL_RE.test(query);
  const isIp = IPV4_RE.test(query) || query.includes(":");

  let combinedResults: unknown[] = [];
  let seeknowResults: unknown[] = [];
  let wentynResults: unknown[] = [];
  let datavoidResults: unknown[] = [];
  let oathnetStealerResults: unknown[] = [];
  let oathnetVictimsResults: unknown[] = [];
  let oathnetSubdomainResults: unknown[] = [];
  let hudsonResults: unknown[] = [];
  let victimArchives: StealerArchiveEntry[] = [];

  const sources: Record<string, { ok: boolean; count: number }> = {};

  const MODULE_TOTAL = 8;
  let doneCount = 0;

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

    return {
      query,
      count: Math.max(
        merged.count,
        results.length,
        mergedCredentials.length,
        archives.length,
      ),
      results,
      credentials: mergedCredentials,
      archives,
      sources: { ...sources },
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
      if (!isOathnetEnabled()) {
        markSource("oathnet-stealer", 0, false);
        markSource("oathnet-victims", 0, false);
        emit("oathnet");
        return;
      }

      try {
        const [stealer, victims] = await Promise.allSettled([
          fetchOathnetSanitized(
            { kind: "static", endpoint: "stealer" },
            { query },
          ),
          fetchOathnetSanitized(
            { kind: "static", endpoint: "victims" },
            { query },
          ),
        ]);

        if (stealer.status === "fulfilled") {
          oathnetStealerResults = asResults(stealer.value);
          markSource("oathnet-stealer", oathnetStealerResults.length);
        } else {
          markSource("oathnet-stealer", 0, false);
        }

        if (victims.status === "fulfilled") {
          oathnetVictimsResults = asResults(victims.value);
          markSource("oathnet-victims", oathnetVictimsResults.length);
        } else {
          markSource("oathnet-victims", 0, false);
        }
      } catch {
        markSource("oathnet-stealer", 0, false);
        markSource("oathnet-victims", 0, false);
      }
      emit("oathnet");
    })(),

    (async () => {
      if (!isOathnetEnabled() || !isDomain) {
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

  await Promise.all(tasks);

  const final = assemble();
  onEvent?.({ type: "done", result: final });

  return final;
}
