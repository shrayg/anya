import { NextRequest, NextResponse } from "next/server";

import {
  finalizeOsintStreamResult,
  osintJson,
  redactOsintStreamPartial,
  requireOsintAccess,
} from "@/lib/osint-api-auth";
import {
  runDiscordOsintSearch,
  type DiscordOsintProgressEvent,
} from "@/lib/discord-osint-search";
import type { DiscordRobloxLink } from "@/lib/discord-profile";
import { canContributeOathnet } from "@/lib/oathnet";
import { isDiscordSnowflake } from "@/lib/osintcat";
import {
  OSINT_ROUTE_DEADLINE_MS,
  osintFailureResponse,
  withDeadline,
} from "@/lib/osint-search-guard";

export const maxDuration = 120;

function wantsStream(req: NextRequest): boolean {
  const explicit = req.nextUrl.searchParams.get("stream")?.trim();

  if (explicit === "0" || explicit === "false") return false;
  if (explicit === "1" || explicit === "true") return true;

  const accept = req.headers.get("accept") ?? "";

  return accept.includes("application/x-ndjson");
}

export async function GET(req: NextRequest) {
  const access = await requireOsintAccess(req, "discord");

  if (access instanceof NextResponse) return access;

  const query = req.nextUrl.searchParams.get("query")?.trim();

  if (!query) {
    return NextResponse.json(
      { error: "Missing query parameter" },
      { status: 400 },
    );
  }

  if (!isDiscordSnowflake(query)) {
    return NextResponse.json(
      { error: "Enter a valid Discord ID (17–20 digits)." },
      { status: 400 },
    );
  }

  const softEmpty = {
    id: query,
    profile: null,
    leaks: { count: 0, results: [] },
    fivem: { count: 0, accounts: [], bans: [] },
    dsa: { count: 0, sanctions: [] },
    robloxLink: null as DiscordRobloxLink | null,
    enrichment: null,
    guilds: { count: 0, items: [] },
    connections: [],
    contacts: null,
    usernameHistory: [],
  };

  if (!wantsStream(req)) {
    try {
      const response = await withDeadline(
        runDiscordOsintSearch(query, {
          includeOathnet: canContributeOathnet(access.plan),
          plan: access.plan ?? null,
        }),
        OSINT_ROUTE_DEADLINE_MS,
      );

      return osintJson(access, response, undefined, {
        moduleSlug: "discord-id",
        query,
        req,
      });
    } catch (err) {
      return osintFailureResponse(err, {
        softEmpty,
        fallbackMessage: "Failed to resolve Discord profile",
      });
    }
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enqueue = (payload: unknown) => {
        controller.enqueue(
          encoder.encode(`${JSON.stringify(payload)}\n`),
        );
      };

      let best: unknown = null;

      const sendPartial = (event: DiscordOsintProgressEvent) => {
        if (event.type !== "partial") return;

        best = event.result;
        enqueue({
          ...event,
          result: redactOsintStreamPartial(access, event.result),
        });
      };

      try {
        const finalResult = await withDeadline(
          runDiscordOsintSearch(
            query,
            {
              includeOathnet: canContributeOathnet(access.plan),
              plan: access.plan ?? null,
            },
            sendPartial,
          ),
          OSINT_ROUTE_DEADLINE_MS,
        );
        best = finalResult;

        const finalized = await finalizeOsintStreamResult(
          access,
          finalResult,
          {
            moduleSlug: "discord-id",
            query,
            req,
          },
        );

        enqueue({
          type: "done",
          result: finalized,
        });
      } catch (err) {
        if (best) {
          const finalized = await finalizeOsintStreamResult(access, best, {
            moduleSlug: "discord-id",
            query,
            req,
          });

          enqueue({
            type: "done",
            result: finalized,
          });
        } else {
          const message =
            err instanceof Error && err.message
              ? err.message
              : "Failed to resolve Discord profile";

          enqueue({
            type: "error",
            error: message,
            result: softEmpty,
          });
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
