import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";
import {
  runDiscordOsintSearch,
  type DiscordOsintProgressEvent,
} from "@/lib/discord-osint-search";
import type { DiscordRobloxLink } from "@/lib/discord-profile";
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
        runDiscordOsintSearch(query),
        OSINT_ROUTE_DEADLINE_MS,
      );

      return NextResponse.json(response);
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
      const send = (event: DiscordOsintProgressEvent) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      try {
        await withDeadline(
          runDiscordOsintSearch(query, send),
          OSINT_ROUTE_DEADLINE_MS,
        );
      } catch (err) {
        const message =
          err instanceof Error && err.message
            ? err.message
            : "Failed to resolve Discord profile";

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
