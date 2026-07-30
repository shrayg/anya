/**
 * Discord ID OSINT fan-out — progressive module assembly.
 *
 * Prefer BreachHub specialty (SeekNow / Reconly / Seekria / CordCat / …)
 * before CSINT mirrors. Emits partial DiscordSearchResult snapshots as each
 * module settles so the UI can paint early.
 */

import { fetchBreachVipSanitized } from "@/lib/breachvip";
import {
  fetchBreachHubDiscord,
  fetchBreachHubRaw,
  fetchBreachHubSpecialty,
} from "@/lib/breachhub";
import {
  fetchCordCatQuery,
  type CordCatQueryResponse,
} from "@/lib/cordcat";
import {
  extractCsintDiscordLookupLeaks,
  fetchCsintDiscordLookup,
  fetchCsintDiscordOsint,
} from "@/lib/csint";
import { mergeDiscordOsintEnrichment } from "@/lib/discord-enrichment";
import {
  parseDiscordDsaFromStatements,
  fetchPublicDsaSanctions,
} from "@/lib/discord-dsa";
import {
  fetchDiscordProfile,
  snowflakeCreatedAt,
  type DiscordSearchResult,
} from "@/lib/discord-profile";
import { fetchFivemIntel } from "@/lib/fivem-search";
import { fetchOathnetDiscordToRoblox } from "@/lib/gateway-fallback";
import { fetchGodsEyeSearchSafe, sanitizeGodsEyeSearch } from "@/lib/godseye";
import {
  fetchOsintCatEndpoint,
  filterDiscordResultsForId,
  mergeSanitizedResponses,
  type SanitizedBreachResponse,
} from "@/lib/osintcat";
import { withPrimaryFallback } from "@/lib/provider-dedupe";
import { consolidateDiscordLeakResults } from "@/lib/intel-record";

export type DiscordOsintProgressEvent =
  | {
      type: "partial";
      module: string;
      done: number;
      total: number;
      result: DiscordSearchResult;
    }
  | { type: "done"; result: DiscordSearchResult };

function cordCatFivemRecords(query: CordCatQueryResponse | null) {
  const results = query?.fivem?.data?.results;

  return Array.isArray(results) ? results : [];
}

function cordCatBreachLeaks(
  query: CordCatQueryResponse | null,
): { count: number; results: unknown[] } {
  const breach = query?.breach;

  if (!breach) return { count: 0, results: [] };

  const data = breach.data;

  if (Array.isArray(data) && data.length > 0) {
    return { count: data.length, results: data };
  }

  if (data && typeof data === "object" && !Array.isArray(data)) {
    const nested = (data as Record<string, unknown>).results;

    if (Array.isArray(nested) && nested.length > 0) {
      return { count: nested.length, results: nested };
    }
  }

  return { count: 0, results: [] };
}

function normalizeRobloxLink(
  link: Record<string, unknown> | null,
  discordId: string,
): DiscordSearchResult["robloxLink"] {
  if (!link) return null;

  const username =
    typeof link.username === "string" && link.username.trim()
      ? link.username.trim()
      : undefined;
  const userId =
    typeof link.userId === "string" && link.userId.trim()
      ? link.userId.trim()
      : typeof link.user_id === "string" && link.user_id.trim()
        ? link.user_id.trim()
        : undefined;
  const profileUrl =
    typeof link.profileUrl === "string" && link.profileUrl.trim()
      ? link.profileUrl.trim()
      : typeof link.profile_url === "string" && link.profile_url.trim()
        ? link.profile_url.trim()
        : undefined;

  if (!username && !userId && !profileUrl) return null;

  return {
    ...(username ? { username } : {}),
    ...(userId ? { userId } : {}),
    ...(profileUrl ? { profileUrl } : {}),
    discord_id: discordId,
  };
}

async function resolveDsa(discordId: string, cordStatements: unknown) {
  const fromCord = parseDiscordDsaFromStatements(cordStatements);

  if (fromCord.length > 0) {
    return { count: fromCord.length, sanctions: fromCord };
  }

  const fromPublic = await fetchPublicDsaSanctions(discordId);

  return { count: fromPublic.length, sanctions: fromPublic };
}

async function fetchOsintCatDiscordStalker(
  discordId: string,
): Promise<Record<string, unknown> | null> {
  try {
    const data = await fetchOsintCatEndpoint("discord-stalker", discordId);

    return data && typeof data === "object"
      ? (data as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function emptyDiscordResult(discordId: string): DiscordSearchResult {
  return {
    id: discordId,
    profile: {
      id: discordId,
      username: "Unknown",
      globalName: null,
      displayName: discordId,
      avatarUrl: "",
      bannerUrl: null,
      bannerColor: null,
      accentColor: null,
      createdAt: snowflakeCreatedAt(discordId),
      badges: [],
      discriminator: "0",
      bio: null,
      nitro: false,
      clanTag: null,
      clanBadgeUrl: null,
      avatarDecorationUrl: null,
      nameplate: null,
      profilePreviewUrl: `https://discord.com/users/${encodeURIComponent(discordId)}`,
    },
    leaks: { count: 0, results: [] },
    fivem: { count: 0, accounts: [], bans: [] },
    dsa: { count: 0, sanctions: [] },
    enrichment: null,
    robloxLink: null,
    guilds: { count: 0, items: [] },
    connections: [],
    contacts: undefined,
    usernameHistory: [],
  };
}

function isNonEmptySanitized(value: SanitizedBreachResponse): boolean {
  return (value.count ?? 0) > 0 || (value.results?.length ?? 0) > 0;
}

/**
 * Run the full Discord ID fan-out. Calls `onEvent` as each module settles so
 * callers can stream NDJSON / update UI progressively.
 */
export async function runDiscordOsintSearch(
  discordId: string,
  onEvent?: (event: DiscordOsintProgressEvent) => void,
): Promise<DiscordSearchResult> {
  const query = discordId.trim();
  let profile: DiscordSearchResult["profile"] | null = null;
  let osintLeaks: SanitizedBreachResponse = { count: 0, results: [] };
  let godseyeLeaks: SanitizedBreachResponse = { count: 0, results: [] };
  let breachVipLeaks: SanitizedBreachResponse = { count: 0, results: [] };
  let csintOsint: SanitizedBreachResponse | null = null;
  let csintLookup: Record<string, unknown> | null = null;
  let robloxLink: Record<string, unknown> | null = null;
  let fivemIntel: Awaited<ReturnType<typeof fetchFivemIntel>> = {
    searchData: null,
    records: [],
  };
  let cordQuery: CordCatQueryResponse | null = null;
  let cordStatements: unknown;
  let breachHubLeaks: SanitizedBreachResponse | null = null;
  let breachHubFivem: SanitizedBreachResponse | null = null;
  let osintCatStalker: Record<string, unknown> | null = null;
  let bhStalker: Record<string, unknown> | null = null;
  let bhLookup: Record<string, unknown> | null = null;
  let bhSeeknowUser: Record<string, unknown> | null = null;
  let bhUserInfo: Record<string, unknown> | null = null;
  let bhUsernameHistory: Record<string, unknown> | null = null;
  let dsa: DiscordSearchResult["dsa"] = { count: 0, sanctions: [] };

  const MODULE_TOTAL = 12;
  let doneCount = 0;

  const assemble = (): DiscordSearchResult => {
    const mergedLeaks = mergeSanitizedResponses(
      osintLeaks,
      godseyeLeaks,
      breachVipLeaks,
      csintOsint ?? { count: 0, results: [] },
      extractCsintDiscordLookupLeaks(csintLookup, query),
      cordCatBreachLeaks(cordQuery),
      breachHubLeaks ?? { count: 0, results: [] },
    );
    const leakRows = consolidateDiscordLeakResults(mergedLeaks.results, query);
    const leaks = { count: leakRows.length, results: leakRows };

    const fivemFromGodsEye = fivemIntel.records ?? [];
    const fivemFromCord = cordCatFivemRecords(cordQuery);
    const fivemFromBh =
      breachHubFivem && Array.isArray(breachHubFivem.results)
        ? breachHubFivem.results
        : [];
    const fivemRaw =
      fivemFromGodsEye.length > 0
        ? fivemFromGodsEye
        : fivemFromBh.length > 0
          ? fivemFromBh
          : fivemFromCord;
    const fivemMerged = consolidateDiscordLeakResults(fivemRaw, query);
    const cordFivemTotal =
      typeof cordQuery?.fivem?.data?.total === "number"
        ? cordQuery.fivem.data.total
        : fivemFromCord.length;

    const osintEnrichment = mergeDiscordOsintEnrichment(
      osintCatStalker,
      bhStalker,
      bhLookup,
      bhSeeknowUser,
      bhUserInfo,
      bhUsernameHistory,
      cordQuery,
      csintLookup,
      csintOsint,
      ...(breachHubLeaks?.results ?? []),
    );

    const hasContacts = Boolean(
      osintEnrichment.contacts.email ||
        osintEnrichment.contacts.phone ||
        osintEnrichment.contacts.ip,
    );

    return {
      id: query,
      profile: profile ?? emptyDiscordResult(query).profile,
      leaks,
      fivem: {
        count: Math.max(
          fivemMerged.length,
          cordFivemTotal,
          breachHubFivem?.count ?? 0,
        ),
        accounts: fivemMerged,
        bans: [],
      },
      dsa,
      enrichment: csintLookup,
      robloxLink: normalizeRobloxLink(robloxLink, query),
      guilds: {
        count: osintEnrichment.mutualServersCount,
        items: osintEnrichment.guilds,
      },
      connections:
        osintEnrichment.connections.length > 0
          ? osintEnrichment.connections
          : undefined,
      contacts: hasContacts ? osintEnrichment.contacts : undefined,
      usernameHistory:
        osintEnrichment.usernameHistory.length > 0
          ? osintEnrichment.usernameHistory
          : undefined,
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

  const tasks: Promise<void>[] = [
    fetchDiscordProfile(query)
      .then((value) => {
        profile = value;
        emit("profile");
      })
      .catch(() => {
        profile = null;
        emit("profile");
      }),

    fetchOsintCatEndpoint("discord", query)
      .then((data) => filterDiscordResultsForId(query, data))
      .catch(() => ({ count: 0, results: [] as unknown[] }))
      .then((value) => {
        osintLeaks = value;
        emit("osintcat");
      }),

    fetchGodsEyeSearchSafe("discord", query)
      .then((data) => sanitizeGodsEyeSearch(data))
      .catch(() => ({ count: 0, results: [] as unknown[] }))
      .then((value) => {
        godseyeLeaks = value;
        emit("godseye");
      }),

    // BreachHub specialty first (Seekria / Reconly / SeekNow / CordCat / …),
    // then CSINT only when BH returned nothing — never CSINT ∥ BH.
    (async () => {
      const { value: bh } = await withPrimaryFallback(
        () => fetchBreachHubDiscord(query),
        async () => null,
        isNonEmptySanitized,
      );
      breachHubLeaks = bh;

      if (!bh || !isNonEmptySanitized(bh)) {
        const { value: csint } = await withPrimaryFallback(
          () => fetchCsintDiscordOsint(query),
          async () => null,
          (v) =>
            Boolean(
              v &&
                typeof v === "object" &&
                ((v as SanitizedBreachResponse).count ?? 0) > 0,
            ),
        );
        csintOsint =
          csint && typeof csint === "object"
            ? (csint as SanitizedBreachResponse)
            : null;
      }

      emit("breachhub");
    })(),

    fetchBreachVipSanitized(query, "discordid")
      .catch(() => ({ count: 0, results: [] as unknown[] }))
      .then((value) => {
        breachVipLeaks = value;
        emit("breachvip");
      }),

    fetchCsintDiscordLookup(query)
      .catch(() => null)
      .then((value) => {
        csintLookup = value;
        emit("csint-lookup");
      }),

    fetchOathnetDiscordToRoblox(query)
      .catch(() => null)
      .then((value) => {
        robloxLink = value;
        emit("roblox");
      }),

    fetchFivemIntel(query)
      .catch(() => ({ searchData: null, records: [] as unknown[] }))
      .then((value) => {
        fivemIntel = value;
        emit("fivem");
      }),

    fetchCordCatQuery(query)
      .catch(() => null)
      .then((value) => {
        cordQuery = value;
        cordStatements = value?.statements;
        emit("cordcat");
      }),

    fetchBreachHubSpecialty("fivem", query)
      .catch(() => null)
      .then((value) => {
        breachHubFivem = value;
        emit("fivem-indexes");
      }),

    // Enrichment payloads (guilds / connections / history). Specialty already
    // hits these for leak rows; these raw calls keep structured parsers fed.
    Promise.all([
      fetchOsintCatDiscordStalker(query),
      fetchBreachHubRaw("discord-stalker", { query }).catch(() => null),
      fetchBreachHubRaw("discord-lookup", { query }).catch(() => null),
      fetchBreachHubRaw("seeknow-discord-user", {
        discord_id: query,
      }).catch(() => null),
      fetchBreachHubRaw("oathnet-discord-userinfo", {
        discord_id: query,
      }).catch(() => null),
      fetchBreachHubRaw("oathnet-discord-history", {
        discord_id: query,
      }).catch(() => null),
    ]).then(
      ([stalker, bhS, bhL, bhSeek, bhInfo, bhHist]) => {
        osintCatStalker = stalker;
        bhStalker = bhS;
        bhLookup = bhL;
        bhSeeknowUser = bhSeek;
        bhUserInfo = bhInfo;
        bhUsernameHistory = bhHist;
        emit("enrichment");
      },
    ),
  ];

  await Promise.allSettled(tasks);

  dsa = await resolveDsa(query, cordStatements).catch(() => ({
    count: 0,
    sanctions: [],
  }));
  emit("dsa");

  const finalResult = assemble();
  onEvent?.({ type: "done", result: finalResult });

  return finalResult;
}
