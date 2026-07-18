import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";

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

export async function GET(req: NextRequest) {
  const access = await requireOsintAccess(req, "breach");
  if (access instanceof NextResponse) return access;

  const query = req.nextUrl.searchParams.get("query")?.trim();
  const scope = req.nextUrl.searchParams.get("scope");

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
  };

  if (platform) {
    try {
      const data = await withDeadline(
        isGodsEyeOnlyPlatformConfig(platform)
          ? fetchGodsEyeOnlySearch(
              query,
              platform.godseyeType,
              platform.breachVipField,
            )
          : fetchCombinedPlatformSearch(
              query,
              platform.osintCatEndpoint,
              platform.godseyeType,
              platform.breachVipField,
            ),
        OSINT_ROUTE_DEADLINE_MS,
      );

      if (data.count === 0) {
        return NextResponse.json({
          ...data,
          message: "No results were found.",
        });
      }

      return NextResponse.json(data);
    } catch (err) {
      return osintFailureResponse(err, { softEmpty });
    }
  }

  const domain = normalizeDomain(query);
  const searchQuery = domain ?? query;

  try {
    const data = await withDeadline(
      fetchCombinedStealerLogs(searchQuery, scope),
      OSINT_ROUTE_DEADLINE_MS,
    );
    return NextResponse.json(data);
  } catch (err) {
    return osintFailureResponse(err, { softEmpty });
  }
}
