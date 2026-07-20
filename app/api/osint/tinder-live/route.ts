import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";
import {
  isSoftProviderFailure,
  isTimeoutLike,
  OSINT_ROUTE_DEADLINE_MS,
  withDeadline,
} from "@/lib/osint-search-guard";
import { tinderLiveDisabledResponse } from "@/lib/tinder-live/api-guard";
import {
  parseTinderLiveQuery,
  runTinderLiveSearch,
} from "@/lib/tinder-live/search";

export async function GET(req: NextRequest) {
  const disabled = tinderLiveDisabledResponse();

  if (disabled) return disabled;

  const access = await requireOsintAccess(req, "tinder-live");

  if (access instanceof NextResponse) return access;

  const query = req.nextUrl.searchParams.get("query")?.trim();

  if (!query) {
    return NextResponse.json(
      {
        error:
          "Missing query. Example: 40.7128,-74.0060 ageMin=22 ageMax=35 distanceKm=40 gender=1",
      },
      { status: 400 },
    );
  }

  try {
    const input = parseTinderLiveQuery(query);
    const result = await withDeadline(
      runTinderLiveSearch(input, query),
      OSINT_ROUTE_DEADLINE_MS,
    );

    return NextResponse.json(result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Tinder Live search failed";

    if (isTimeoutLike(err) || isSoftProviderFailure(err)) {
      return NextResponse.json(
        {
          error:
            "Tinder Live is slow or unavailable. Tokens may be expired — refresh X-AUTH-TOKEN.",
        },
        { status: 502 },
      );
    }

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
