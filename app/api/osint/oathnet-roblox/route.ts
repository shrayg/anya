import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";

import {
  fetchCsintOathnetDiscordToRoblox,
  isCsintEnabled,
} from "@/lib/csint";
import { isDiscordSnowflake } from "@/lib/osintcat";
import {
  OSINT_ROUTE_DEADLINE_MS,
  osintFailureResponse,
  withDeadline,
} from "@/lib/osint-search-guard";
import {
  publicSearchError,
  publicServiceUnavailable,
} from "@/lib/public-branding";

const NO_RESULTS = {
  count: 0,
  results: [] as unknown[],
  message: "No results were found.",
};

export async function GET(req: NextRequest) {
  const access = await requireOsintAccess(req, "oathnet-roblox");
  if (access instanceof NextResponse) return access;

  const query = req.nextUrl.searchParams.get("query")?.trim();

  if (!query) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  if (!isDiscordSnowflake(query)) {
    return NextResponse.json(
      { error: "Enter a valid Discord snowflake ID (17–20 digits)." },
      { status: 400 },
    );
  }

  if (!isCsintEnabled()) {
    return NextResponse.json(
      { error: publicServiceUnavailable() },
      { status: 503 },
    );
  }

  try {
    const account = await withDeadline(
      fetchCsintOathnetDiscordToRoblox(query),
      OSINT_ROUTE_DEADLINE_MS,
    );

    if (!account) {
      return NextResponse.json({ ...NO_RESULTS, query });
    }

    return NextResponse.json({
      query,
      count: 1,
      results: [account],
    });
  } catch (err) {
    return osintFailureResponse(err, {
      softEmpty: { ...NO_RESULTS, query },
      fallbackMessage: publicSearchError(),
    });
  }
}
