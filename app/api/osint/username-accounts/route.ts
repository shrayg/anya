import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";
import {
  isSoftProviderFailure,
  isTimeoutLike,
  OSINT_ROUTE_DEADLINE_MS,
  withDeadline,
} from "@/lib/osint-search-guard";
import {
  searchUsernameAccounts,
  USERNAME_ACCOUNTS_INVALID_MESSAGE,
} from "@/lib/username-accounts";

export async function GET(req: NextRequest) {
  const access = await requireOsintAccess(req, "username-accounts");

  if (access instanceof NextResponse) return access;

  const query = req.nextUrl.searchParams.get("query")?.trim();
  const category = req.nextUrl.searchParams.get("category")?.trim() || null;

  if (!query) {
    return NextResponse.json(
      { error: "Missing query. Enter a username to scan public profiles." },
      { status: 400 },
    );
  }

  try {
    const result = await withDeadline(
      searchUsernameAccounts({ query, category }),
      OSINT_ROUTE_DEADLINE_MS,
    );

    return NextResponse.json(result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Account finder search failed";

    if (message === USERNAME_ACCOUNTS_INVALID_MESSAGE) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    if (isTimeoutLike(err) || isSoftProviderFailure(err)) {
      return NextResponse.json(
        {
          error:
            "Account finder timed out before finishing the platform scan. Try again or filter by category.",
        },
        { status: 502 },
      );
    }

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
