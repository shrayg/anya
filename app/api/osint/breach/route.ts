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

  // Stealer Logs (no platform scope) must not accept Discord snowflakes.
  // Platform modules (Steam ID64, numeric Telegram IDs, etc.) are allowed through.
  if (!platform && isDiscordSnowflake(query)) {
    return NextResponse.json(
      {
        error:
          "Discord IDs are not supported in Stealer Logs. Use the Discord ID module.",
      },
      { status: 400 },
    );
  }


  if (platform) {
    try {
      const data = isGodsEyeOnlyPlatformConfig(platform)
        ? await fetchGodsEyeOnlySearch(
            query,
            platform.godseyeType,
            platform.breachVipField,
          )
        : await fetchCombinedPlatformSearch(
            query,
            platform.osintCatEndpoint,
            platform.godseyeType,
            platform.breachVipField,
          );

      if (data.count === 0) {
        return NextResponse.json({
          ...data,
          message: "No results were found.",
        });
      }

      return NextResponse.json(data);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to reach search sources";

      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  const domain = normalizeDomain(query);
  const searchQuery = domain ?? query;

  try {
    const data = await fetchCombinedStealerLogs(searchQuery, scope);
    return NextResponse.json(data);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to reach search sources";

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
