import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";
import {
  applyDataBlacklistToPayload,
  warmDataBlacklistCache,
} from "@/lib/data-blacklist";
import { isDiscordSnowflake } from "@/lib/osintcat";
import {
  OSINT_ROUTE_DEADLINE_MS,
  osintFailureResponse,
  withDeadline,
} from "@/lib/osint-search-guard";
import {
  runStealerOsintSearch,
  type StealerOsintProgressEvent,
} from "@/lib/stealer-osint-search";

export const maxDuration = 120;

function wantsStream(req: NextRequest): boolean {
  const explicit = req.nextUrl.searchParams.get("stream")?.trim();

  if (explicit === "0" || explicit === "false") return false;
  if (explicit === "1" || explicit === "true") return true;

  const accept = req.headers.get("accept") ?? "";

  return accept.includes("application/x-ndjson");
}

export async function GET(req: NextRequest) {
  const access = await requireOsintAccess(req, "stealer");

  if (access instanceof NextResponse) return access;

  const query = req.nextUrl.searchParams.get("query")?.trim();

  if (!query) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  if (isDiscordSnowflake(query)) {
    return NextResponse.json(
      {
        error:
          "Discord IDs are not supported in Stealer Logs. Use the Discord ID module.",
      },
      { status: 400 },
    );
  }

  const softEmpty = {
    query,
    count: 0,
    results: [] as unknown[],
    credentials: [] as unknown[],
    archives: [] as unknown[],
    sources: {} as Record<string, { ok: boolean; count: number }>,
    breachedData: null,
  };

  if (!wantsStream(req)) {
    try {
      const response = await withDeadline(
        runStealerOsintSearch(query),
        OSINT_ROUTE_DEADLINE_MS,
      );

      if (
        response.count === 0 &&
        response.credentials.length === 0 &&
        response.archives.length === 0 &&
        !(response.breachedData?.credentials?.length)
      ) {
        return NextResponse.json({
          ...response,
          message: "No results were found.",
        });
      }

      await warmDataBlacklistCache();

      return NextResponse.json(applyDataBlacklistToPayload(response));
    } catch (err) {
      return osintFailureResponse(err, {
        softEmpty,
        fallbackMessage: "Failed to search stealer indexes",
      });
    }
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      await warmDataBlacklistCache();

      const send = (event: StealerOsintProgressEvent) => {
        if (event.type === "partial" || event.type === "done") {
          const result = applyDataBlacklistToPayload(event.result);

          controller.enqueue(
            encoder.encode(`${JSON.stringify({ ...event, result })}\n`),
          );

          return;
        }

        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      try {
        await withDeadline(
          runStealerOsintSearch(query, send),
          OSINT_ROUTE_DEADLINE_MS,
        );
      } catch (err) {
        const message =
          err instanceof Error && err.message
            ? err.message
            : "Failed to search stealer indexes";

        controller.enqueue(
          encoder.encode(
            `${JSON.stringify({
              type: "error",
              error: message,
              result: softEmpty,
            })}\n`,
          ),
        );
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
