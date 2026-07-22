import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";
import {
  OSINT_ROUTE_DEADLINE_MS,
  osintFailureResponse,
  withDeadline,
} from "@/lib/osint-search-guard";
import { publicServiceUnavailable } from "@/lib/public-branding";
import {
  fetchInf0secSanitized,
  isInf0secEnabled,
  isInf0secModule,
  normalizeInf0secModule,
} from "@/lib/inf0sec";

export const maxDuration = 60;

/**
 * GET /api/inf0sec?module=leaks|ip-info|domain|username|hlr|npd|discord|cfx&query=…
 *
 * Proxies Inf0sec (direct INF0SEC_API_KEY or BreachHub).
 * `module` is optional — inferred from the query (or scope/moduleSlug) when omitted.
 * NPD accepts firstname + lastname (catalog specialty).
 */
export async function GET(req: NextRequest) {
  const access = await requireOsintAccess(req, "inf0sec");

  if (access instanceof NextResponse) {
    if (access.status === 400) {
      const retry = await requireOsintAccess(req, "breaches");

      if (retry instanceof NextResponse) return retry;
    } else {
      return access;
    }
  }

  if (!isInf0secEnabled()) {
    return NextResponse.json(
      { error: publicServiceUnavailable() },
      { status: 503 },
    );
  }

  const query =
    req.nextUrl.searchParams.get("query")?.trim() ||
    req.nextUrl.searchParams.get("email")?.trim() ||
    req.nextUrl.searchParams.get("username")?.trim() ||
    req.nextUrl.searchParams.get("phone")?.trim() ||
    req.nextUrl.searchParams.get("ip")?.trim() ||
    req.nextUrl.searchParams.get("domain")?.trim() ||
    req.nextUrl.searchParams.get("text")?.trim() ||
    null;

  const firstname = req.nextUrl.searchParams.get("firstname")?.trim() || null;
  const lastname = req.nextUrl.searchParams.get("lastname")?.trim() || null;

  if (!query && !firstname && !lastname) {
    return NextResponse.json({ error: "Missing query." }, { status: 400 });
  }

  const explicitModule =
    req.nextUrl.searchParams.get("module")?.trim() ||
    req.nextUrl.searchParams.get("inf0sec_module")?.trim() ||
    req.nextUrl.searchParams.get("type")?.trim() ||
    null;

  if (explicitModule && !isInf0secModule(explicitModule)) {
    return NextResponse.json(
      {
        error:
          "Invalid module. Use leaks, ip-info, domain, username, hlr, npd, discord, or cfx.",
      },
      { status: 400 },
    );
  }

  const scopeOrSlug =
    req.nextUrl.searchParams.get("scope")?.trim() ||
    req.nextUrl.searchParams.get("moduleSlug")?.trim() ||
    null;
  const typeHint =
    explicitModule ||
    (scopeOrSlug && normalizeInf0secModule(scopeOrSlug) ? scopeOrSlug : null);

  try {
    const data = await withDeadline(
      fetchInf0secSanitized({
        query,
        module: explicitModule,
        firstname,
        lastname,
        typeHint,
      }),
      OSINT_ROUTE_DEADLINE_MS,
    );

    if (data.count === 0) {
      return NextResponse.json({
        count: 0,
        results: [],
        query: data.query,
        module: data.module,
        source: data.source,
        message: "No results were found.",
      });
    }

    return NextResponse.json({
      count: data.count,
      results: data.results,
      query: data.query,
      module: data.module,
      source: data.source,
    });
  } catch (err) {
    return osintFailureResponse(err, {
      softEmpty: {
        count: 0,
        results: [],
        query: query || [firstname, lastname].filter(Boolean).join(" "),
        module: explicitModule
          ? normalizeInf0secModule(explicitModule)
          : undefined,
      },
    });
  }
}
