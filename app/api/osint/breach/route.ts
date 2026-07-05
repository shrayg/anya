import { NextRequest, NextResponse } from "next/server";

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
  const query = req.nextUrl.searchParams.get("query")?.trim();
  const scope = req.nextUrl.searchParams.get("scope");

  if (!query) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  if (isDiscordSnowflake(query)) {
    return NextResponse.json(
      {
        error:
          "Discord IDs are not supported in Stealer Logs. Use the Discord ID module.",
      },
      { status: 400 },
    );
  }

  const platform = getPlatformSearchConfig(scope);

  if (platform) {
    try {
      const data = isGodsEyeOnlyPlatformConfig(platform)
        ? await fetchGodsEyeOnlySearch(query, platform.godseyeType)
        : await fetchCombinedPlatformSearch(
            query,
            platform.osintCatEndpoint,
            platform.godseyeType,
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
