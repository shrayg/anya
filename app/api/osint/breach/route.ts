import { NextRequest, NextResponse } from "next/server";

import { osintJson, requireOsintAccess } from "@/lib/osint-api-auth";
import {
  extractStealerArchives,
  fetchBreachHubStealerVictims,
} from "@/lib/breachhub";
import { normalizeDomain } from "@/lib/domain-search";
import { isDiscordSnowflake } from "@/lib/osintcat";
import {
  fetchCombinedPlatformSearch,
  fetchCombinedStealerLogs,
  fetchGodsEyeOnlySearch,
} from "@/lib/osint-combined";
import {
  OSINT_ROUTE_DEADLINE_MS,
  osintFailureResponse,
  withDeadline,
} from "@/lib/osint-search-guard";
import {
  getPlatformSearchConfig,
  isGodsEyeOnlyPlatformConfig,
} from "@/lib/platform-search";
import {
  archivesFromStealerResults,
  extractStealerCredentialRows,
  mergeStealerArchives,
} from "@/lib/stealer-logs-view";

export async function GET(req: NextRequest) {
  const access = await requireOsintAccess(req, "breach");

  if (access instanceof NextResponse) return access;

  const query = req.nextUrl.searchParams.get("query")?.trim();
  const scope = req.nextUrl.searchParams.get("scope");
  const moduleSlug =
    req.nextUrl.searchParams.get("moduleSlug")?.trim() ||
    scope ||
    "stealer-logs";

  const vaultOpts = {
    moduleSlug,
    query: query ?? "",
    req,
  };

  if (!query) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  const platform = getPlatformSearchConfig(scope);

  if (!platform && isDiscordSnowflake(query)) {
    return NextResponse.json(
      {
        error:
          "Discord IDs are not supported in Stealer Logs. Use the Discord ID module.",
      },
      { status: 400 },
    );
  }

  const softEmpty = {
    count: 0,
    results: [] as unknown[],
    query,
    credentials: [] as unknown[],
    archives: [] as unknown[],
  };

  if (platform) {
    try {
      const data = await withDeadline(
        isGodsEyeOnlyPlatformConfig(platform)
          ? fetchGodsEyeOnlySearch(
              query,
              platform.godseyeType,
              platform.breachVipField,
              platform.breachHubScope,
            )
          : fetchCombinedPlatformSearch(
              query,
              platform.osintCatEndpoint,
              platform.godseyeType,
              platform.breachVipField,
              platform.breachHubScope,
            ),
        OSINT_ROUTE_DEADLINE_MS,
      );

      if (data.count === 0) {
        return osintJson(
          access,
          {
            ...data,
            message: "No results were found.",
          },
          undefined,
          vaultOpts,
        );
      }

      return osintJson(access, data, undefined, vaultOpts);
    } catch (err) {
      return osintFailureResponse(err, { softEmpty });
    }
  }

  const domain = normalizeDomain(query);
  const searchQuery = domain ?? query;
  const isStealerModule = !scope || moduleSlug === "stealer-logs";

  try {
    const [data, victims] = await withDeadline(
      Promise.all([
        fetchCombinedStealerLogs(searchQuery, scope),
        isStealerModule
          ? fetchBreachHubStealerVictims(searchQuery, 18_000).catch(() => [])
          : Promise.resolve([]),
      ]),
      OSINT_ROUTE_DEADLINE_MS,
    );

    const results = Array.isArray(data.results) ? data.results : [];
    const credentials = extractStealerCredentialRows(results, searchQuery);
    const archives = mergeStealerArchives(
      victims,
      extractStealerArchives({ results }),
      archivesFromStealerResults(results),
    );

    // Prefer nested credentials from victim archives when flat rows are empty.
    const mergedCredentials =
      credentials.length > 0
        ? credentials
        : extractStealerCredentialRows(
            archives.flatMap((a) => a.credentials ?? []),
          );

    if (data.count === 0 && mergedCredentials.length === 0 && archives.length === 0) {
      return osintJson(
        access,
        {
          ...data,
          credentials: [],
          archives: [],
          message: "No results were found.",
        },
        undefined,
        vaultOpts,
      );
    }

    return osintJson(
      access,
      {
        ...data,
        count: Math.max(
          typeof data.count === "number" ? data.count : 0,
          results.length,
          mergedCredentials.length,
        ),
        credentials: mergedCredentials,
        archives,
      },
      undefined,
      vaultOpts,
    );
  } catch (err) {
    return osintFailureResponse(err, { softEmpty });
  }
}
