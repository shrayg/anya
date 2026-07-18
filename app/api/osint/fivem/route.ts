import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";

import { fetchDiscordProfile } from "@/lib/discord-profile";
import {
  buildFivemSearchResult,
  fetchFivemIntel,
  fivemErrorMessage,
  fivemHasResults,
} from "@/lib/fivem-search";
import { publicServiceUnavailable, sanitizePublicText } from "@/lib/public-branding";
import { getGodsEyeApiKey } from "@/lib/godseye";
import { isDiscordSnowflake } from "@/lib/osintcat";
import { osintFailureResponse } from "@/lib/osint-search-guard";

export async function GET(req: NextRequest) {
  const access = await requireOsintAccess(req, "fivem");
  if (access instanceof NextResponse) return access;

  const query = req.nextUrl.searchParams.get("query")?.trim();

  if (!query) {
    return NextResponse.json({ error: "Missing query parameter" }, { status: 400 });
  }

  if (!isDiscordSnowflake(query)) {
    return NextResponse.json(
      { error: "Enter a valid Discord snowflake ID (17–20 digits)." },
      { status: 400 },
    );
  }

  if (!getGodsEyeApiKey()) {
    return NextResponse.json(
      {
        error: publicServiceUnavailable(),
        code: "MISSING_KEY",
      },
      { status: 503 },
    );
  }

  try {
    const [intel, profile] = await Promise.all([
      fetchFivemIntel(query),
      fetchDiscordProfile(query).catch(() => null),
    ]);

    const response = buildFivemSearchResult({
      discordId: query,
      searchData: intel.searchData,
      records: intel.records,
      profile,
      warning: intel.warning,
    });

    if (!fivemHasResults(response)) {
      const message = fivemErrorMessage(response);

      return NextResponse.json({
        ...response,
        message: message ? sanitizePublicText(message) : response.message,
        error: message ? sanitizePublicText(message) : response.message,
      });
    }

    return NextResponse.json(response);
  } catch (err) {
    const message = sanitizePublicText(
      err instanceof Error ? err.message : "Failed to resolve FiveM lookup",
    );

    return osintFailureResponse(err instanceof Error ? err : new Error(String(message)));
  }
}
