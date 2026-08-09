import { NextRequest, NextResponse } from "next/server";

import {
  INDEX_SWEEP_INVALID_MESSAGE,
  searchIndexSweep,
} from "@/lib/index-sweep";
import { requireOsintAccess } from "@/lib/osint-api-auth";
import { logOsintEvent } from "@/lib/osint-event-log";
import {
  isSoftProviderFailure,
  OSINT_ROUTE_DEADLINE_MS,
  withDeadline,
} from "@/lib/osint-search-guard";
import { toUserFacingSearchMessage } from "@/lib/user-facing-errors";

export async function GET(req: NextRequest) {
  const access = await requireOsintAccess(req, "index-sweep");

  if (access instanceof NextResponse) return access;

  const query = req.nextUrl.searchParams.get("query")?.trim();
  const live = req.nextUrl.searchParams.get("live") !== "0";
  const kindParam = req.nextUrl.searchParams.get("kind")?.trim().toLowerCase();
  const kind =
    kindParam === "email" || kindParam === "phone" ? kindParam : undefined;

  if (!query) {
    return NextResponse.json(
      {
        error:
          "Enter an email or phone number to run Index Sweep.",
      },
      { status: 400 },
    );
  }

  try {
    const result = await withDeadline(
      searchIndexSweep({ query, liveProbe: live, kind }),
      OSINT_ROUTE_DEADLINE_MS,
    );

    logOsintEvent({
      userId: access.userId,
      action: "search.index-sweep",
      status: "ok",
      moduleSlug: "index-sweep",
      queryPreview: query,
      message: `hits=${result.hits.length} locations=${result.locations.length}`,
      meta: {
        hits: result.hits.length,
        locations: result.locations.length,
        kind: result.kind,
      },
    });

    return NextResponse.json({
      ...result,
      warning: toUserFacingSearchMessage(result.warning, { omitInternal: true }),
      linkedInResolve: result.linkedInResolve
        ? {
            ...result.linkedInResolve,
            warning: toUserFacingSearchMessage(
              result.linkedInResolve.warning,
              { omitInternal: true },
            ) || undefined,
          }
        : null,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Index Sweep search failed";

    if (message === INDEX_SWEEP_INVALID_MESSAGE) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    logOsintEvent({
      userId: access.userId,
      action: "search.index-sweep",
      status: isSoftProviderFailure(err) ? "rate_limited" : "error",
      moduleSlug: "index-sweep",
      queryPreview: query,
      message,
    });

    return NextResponse.json(
      {
        error: toUserFacingSearchMessage(message, {
          fallback: "Search could not complete. Try again shortly.",
        }),
      },
      { status: 502 },
    );
  }
}
