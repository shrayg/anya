import { NextRequest, NextResponse } from "next/server";

import {
  CONTACT_PRESENCE_INVALID_MESSAGE,
  searchContactPresence,
} from "@/lib/email-presence";
import { requireOsintAccess } from "@/lib/osint-api-auth";
import { logOsintEvent } from "@/lib/osint-event-log";
import {
  isSoftProviderFailure,
  isTimeoutLike,
  OSINT_ROUTE_DEADLINE_MS,
  withDeadline,
} from "@/lib/osint-search-guard";
import { toUserFacingSearchMessage } from "@/lib/user-facing-errors";

export async function GET(req: NextRequest) {
  const access = await requireOsintAccess(req, "email-presence");

  if (access instanceof NextResponse) return access;

  const query = req.nextUrl.searchParams.get("query")?.trim();

  if (!query) {
    return NextResponse.json(
      {
        error:
          "Missing query. Enter an email or phone number for Contact Profiles.",
      },
      { status: 400 },
    );
  }

  try {
    const result = await withDeadline(
      searchContactPresence({ query }),
      OSINT_ROUTE_DEADLINE_MS,
    );

    if (result.rateLimited > 0 || result.errors > 0) {
      logOsintEvent({
        userId: access.userId,
        action: "search.email-presence",
        status: result.rateLimited > 0 ? "rate_limited" : "partial",
        moduleSlug: "email-presence",
        queryPreview: query,
        message: `rateLimited=${result.rateLimited} errors=${result.errors} found=${result.count}`,
        meta: {
          rateLimited: result.rateLimited,
          errors: result.errors,
          checked: result.checked,
        },
      });
    } else {
      logOsintEvent({
        userId: access.userId,
        action: "search.email-presence",
        status: "ok",
        moduleSlug: "email-presence",
        queryPreview: query,
        message: `${result.count} hit(s)`,
      });
    }

    return NextResponse.json(result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Contact Profiles search failed";

    if (message === CONTACT_PRESENCE_INVALID_MESSAGE) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    logOsintEvent({
      userId: access.userId,
      action: "search.email-presence",
      status: isSoftProviderFailure(err) ? "rate_limited" : "error",
      moduleSlug: "email-presence",
      queryPreview: query,
      message,
    });

    if (isTimeoutLike(err) || isSoftProviderFailure(err)) {
      return NextResponse.json(
        {
          error: toUserFacingSearchMessage(message, {
            fallback: "Search could not complete. Try again shortly.",
          }),
        },
        { status: 502 },
      );
    }

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
