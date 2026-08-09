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

function parseDeepFlag(req: NextRequest): boolean {
  const deep = req.nextUrl.searchParams.get("deep")?.trim().toLowerCase();
  const moduleSlug = req.nextUrl.searchParams.get("moduleSlug")?.trim();

  return (
    deep === "1" ||
    deep === "true" ||
    moduleSlug === "email-presence-deep"
  );
}

export async function GET(req: NextRequest) {
  const deep = parseDeepFlag(req);
  const access = await requireOsintAccess(req, "email-presence", {
    forceModuleSlug: deep ? "email-presence-deep" : "email-presence",
  });

  if (access instanceof NextResponse) return access;

  const query = req.nextUrl.searchParams.get("query")?.trim();

  if (!query) {
    return NextResponse.json(
      {
        error:
          "Enter an email or phone number to run Contact Profiles.",
      },
      { status: 400 },
    );
  }

  const billingSlug = deep ? "email-presence-deep" : "email-presence";

  try {
    const result = await withDeadline(
      searchContactPresence({ query, deep }),
      OSINT_ROUTE_DEADLINE_MS,
    );

    if (result.rateLimited > 0 || result.errors > 0) {
      logOsintEvent({
        userId: access.userId,
        action: "search.email-presence",
        status: result.rateLimited > 0 ? "rate_limited" : "partial",
        moduleSlug: billingSlug,
        queryPreview: query,
        message: `deep=${deep} rateLimited=${result.rateLimited} errors=${result.errors} found=${result.count}`,
        meta: {
          deep,
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
        moduleSlug: billingSlug,
        queryPreview: query,
        message: `deep=${deep} ${result.count} hit(s)`,
      });
    }

    return NextResponse.json({ ...result, deep });
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
      moduleSlug: billingSlug,
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
