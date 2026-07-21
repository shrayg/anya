import { NextRequest, NextResponse } from "next/server";

import { hingeLiveDisabledResponse } from "@/lib/hinge-live/api-guard";
import {
  parseHingeLiveQuery,
  runHingeLiveSearch,
} from "@/lib/hinge-live/search";
import { requireOsintAccess } from "@/lib/osint-api-auth";
import {
  isSoftProviderFailure,
  isTimeoutLike,
  OSINT_ROUTE_DEADLINE_MS,
  withDeadline,
} from "@/lib/osint-search-guard";

export async function GET(req: NextRequest) {
  const disabled = hingeLiveDisabledResponse();

  if (disabled) return disabled;

  const access = await requireOsintAccess(req, "hinge-live");

  if (access instanceof NextResponse) return access;

  const query = req.nextUrl.searchParams.get("query")?.trim();

  if (!query) {
    return NextResponse.json(
      {
        error:
          "Missing query. Example: 40.7128,-74.0060 ageMin=22 ageMax=35 distanceMi=25 gender=1 q=alex",
      },
      { status: 400 },
    );
  }

  try {
    const input = parseHingeLiveQuery(query);
    const result = await withDeadline(
      runHingeLiveSearch(input, query),
      OSINT_ROUTE_DEADLINE_MS,
    );

    return NextResponse.json(result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Hinge Live search failed";

    if (isTimeoutLike(err) || isSoftProviderFailure(err)) {
      return NextResponse.json(
        {
          error:
            "Hinge Live is slow or unavailable. Session credentials may be expired — refresh HINGE_AUTHORIZATION / device headers.",
        },
        { status: 502 },
      );
    }

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
