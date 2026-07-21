import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";
import {
  isSoftProviderFailure,
  isTimeoutLike,
  OSINT_ROUTE_DEADLINE_MS,
  withDeadline,
} from "@/lib/osint-search-guard";
import { searchHandleSweep } from "@/lib/handle-sweep";
import { USERNAME_ACCOUNTS_INVALID_MESSAGE } from "@/lib/username-accounts";
import {
  mapHandleSweepSource,
  type AccountPresenceSearchResult,
} from "@/lib/account-presence";

export async function GET(req: NextRequest) {
  const access = await requireOsintAccess(req, "handle-sweep");

  if (access instanceof NextResponse) return access;

  const query = req.nextUrl.searchParams.get("query")?.trim();

  if (!query) {
    return NextResponse.json(
      { error: "Missing query. Enter a username for Handle Sweep." },
      { status: 400 },
    );
  }

  try {
    const sweep = await withDeadline(
      searchHandleSweep({ query }),
      OSINT_ROUTE_DEADLINE_MS,
    );
    const source = mapHandleSweepSource(sweep);
    const payload: AccountPresenceSearchResult = {
      query: sweep.query,
      username: sweep.username,
      count: source.count,
      checked: source.checked,
      sources: [source],
      durationMs: sweep.durationMs,
      warning: sweep.warning,
    };

    return NextResponse.json(payload);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Handle Sweep search failed";

    if (message === USERNAME_ACCOUNTS_INVALID_MESSAGE) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    if (isTimeoutLike(err) || isSoftProviderFailure(err)) {
      return NextResponse.json(
        { error: "Handle Sweep timed out. Try again shortly." },
        { status: 502 },
      );
    }

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
