import { NextRequest, NextResponse } from "next/server";

import { osintJson, requireOsintAccess } from "@/lib/osint-api-auth";
import {
  applyDataBlacklistToPayload,
  warmDataBlacklistCache,
} from "@/lib/data-blacklist";
import {
  BREACH_FANOUT_MAX_ROWS,
  runBreachesOsintSearch,
  type BreachesOsintProgressEvent,
  type BreachesOsintResult,
} from "@/lib/breaches-osint-search";
import { normalizeEmail } from "@/lib/proxynova-comb";
import {
  OSINT_LONG_ROUTE_DEADLINE_MS,
  OsintTimeoutError,
  osintFailureResponse,
  withDeadline,
} from "@/lib/osint-search-guard";

export const maxDuration = 120;

/** BH (~48s) + optional CSINT (~28s) + Comb need headroom under CF ~100s. */
const BREACHES_ROUTE_DEADLINE_MS = OSINT_LONG_ROUTE_DEADLINE_MS;

function wantsStream(req: NextRequest): boolean {
  const explicit = req.nextUrl.searchParams.get("stream")?.trim();

  if (explicit === "0" || explicit === "false") return false;
  if (explicit === "1" || explicit === "true") return true;

  const accept = req.headers.get("accept") ?? "";

  return accept.includes("application/x-ndjson");
}

function softEmpty(query: string, start: number): BreachesOsintResult {
  return {
    source: "Breached Data",
    query,
    totalMatches: 0,
    returned: 0,
    start,
    credentials: [],
    hasGodsEyeReport: false,
    hasBreachVipResults: false,
    breachVipCount: 0,
    csintCount: 0,
    breachHubCount: 0,
    osintCatCount: 0,
    godseyeSearchCount: 0,
  };
}

function parseKindHint(raw: string | null): string | null {
  const typeRaw = raw?.trim().toLowerCase() ?? "";

  return typeRaw === "email" ||
    typeRaw === "phone" ||
    typeRaw === "username" ||
    typeRaw === "ip" ||
    typeRaw === "domain" ||
    typeRaw === "hash" ||
    typeRaw === "password" ||
    typeRaw === "discord" ||
    typeRaw === "name" ||
    typeRaw === "url" ||
    typeRaw === "crypto" ||
    typeRaw === "auto"
    ? typeRaw
    : null;
}

function hasUsefulBreaches(result: BreachesOsintResult | null | undefined) {
  if (!result) return false;

  return (
    (result.credentials?.length ?? 0) > 0 ||
    result.hasGodsEyeReport ||
    result.hasBreachVipResults ||
    (result.csintCount ?? 0) > 0 ||
    (result.breachHubCount ?? 0) > 0 ||
    (result.osintCatCount ?? 0) > 0 ||
    (result.godseyeSearchCount ?? 0) > 0
  );
}

export async function GET(req: NextRequest) {
  const access = await requireOsintAccess(req, "breaches");

  if (access instanceof NextResponse) return access;

  const query = req.nextUrl.searchParams.get("query")?.trim();

  if (!query) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  if (query.length < 2) {
    return NextResponse.json(
      {
        error:
          "Enter an email, username, or search term (at least 2 characters).",
      },
      { status: 400 },
    );
  }

  const email = normalizeEmail(query);
  const start = Number(req.nextUrl.searchParams.get("start") ?? 0);
  const limit = Number(
    req.nextUrl.searchParams.get("limit") ?? BREACH_FANOUT_MAX_ROWS,
  );
  const kindHint = parseKindHint(req.nextUrl.searchParams.get("type"));
  const empty = softEmpty(email || query, start);

  const runSearch = (onEvent?: (event: BreachesOsintProgressEvent) => void) =>
    runBreachesOsintSearch(
      query,
      {
        start,
        limit,
        kindHint,
      },
      onEvent,
    );

  // Guests / teaser plans: full JSON so redactOsintTeaser stays consistent.
  if (!wantsStream(req) || access.isGuest || access.blurResults) {
    try {
      const response = await withDeadline(
        runSearch(),
        BREACHES_ROUTE_DEADLINE_MS,
      );

      return osintJson(access, response, undefined, {
        moduleSlug: "breaches",
        query,
        req,
      });
    } catch (err) {
      if (
        err instanceof Error &&
        /valid email address/i.test(err.message)
      ) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }

      return osintFailureResponse(err, {
        softEmpty: empty,
      });
    }
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      await warmDataBlacklistCache();

      const bestPartial: { current: BreachesOsintResult | null } = {
        current: null,
      };

      const send = (event: BreachesOsintProgressEvent) => {
        if (event.type === "partial" || event.type === "done") {
          const result = applyDataBlacklistToPayload(
            event.result,
          ) as BreachesOsintResult;

          if (hasUsefulBreaches(result)) {
            bestPartial.current = result;
          }

          controller.enqueue(
            encoder.encode(`${JSON.stringify({ ...event, result })}\n`),
          );

          return;
        }

        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      try {
        await withDeadline(runSearch(send), BREACHES_ROUTE_DEADLINE_MS);
      } catch (err) {
        const kept = bestPartial.current;

        // Prefer the best streamed partial over wiping the UI with softEmpty.
        if (err instanceof OsintTimeoutError && kept) {
          controller.enqueue(
            encoder.encode(
              `${JSON.stringify({
                type: "done",
                result: {
                  ...kept,
                  message:
                    kept.message ||
                    "Lookup timed out; showing results collected so far.",
                },
              })}\n`,
            ),
          );
        } else if (kept && hasUsefulBreaches(kept)) {
          controller.enqueue(
            encoder.encode(
              `${JSON.stringify({
                type: "done",
                result: kept,
              })}\n`,
            ),
          );
        } else {
          const message =
            err instanceof Error && err.message
              ? err.message
              : "Failed to search breach indexes";

          controller.enqueue(
            encoder.encode(
              `${JSON.stringify({
                type: "error",
                error: message,
                result: empty,
              })}\n`,
            ),
          );
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
