import { NextRequest, NextResponse } from "next/server";

import {
  fetchDiscordApiSanitized,
  isDiscordApiEnabled,
  isDiscordApiEndpoint,
  pickDiscordId,
  type DiscordApiEndpoint,
} from "@/lib/discord-api";
import { requireOsintAccess } from "@/lib/osint-api-auth";
import {
  OSINT_ROUTE_DEADLINE_MS,
  osintFailureResponse,
  withDeadline,
} from "@/lib/osint-search-guard";
import { publicServiceUnavailable } from "@/lib/public-branding";

export const maxDuration = 60;

type RouteParams = {
  params: Promise<{ endpoint: string }>;
};

/**
 * GET /api/discord/{user|history|export|snowflake}?query=…
 *
 * Proxies BreachHub Discord specialty endpoints with local fallbacks
 * (profile resolve, OathNet history, ID decode, composed export).
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { endpoint: rawEndpoint } = await params;
  const endpointRaw = rawEndpoint?.trim().toLowerCase() ?? "";

  if (!isDiscordApiEndpoint(endpointRaw)) {
    return NextResponse.json(
      {
        error:
          "Unknown Discord endpoint. Use user, history, export, or snowflake.",
      },
      { status: 404 },
    );
  }

  const endpoint = endpointRaw as DiscordApiEndpoint;
  const access = await requireOsintAccess(req, `discord/${endpoint}`);

  if (access instanceof NextResponse) {
    if (access.status === 400) {
      const retry = await requireOsintAccess(req, "discord");

      if (retry instanceof NextResponse) return retry;
    } else {
      return access;
    }
  }

  if (!isDiscordApiEnabled()) {
    return NextResponse.json(
      { error: publicServiceUnavailable() },
      { status: 503 },
    );
  }

  const input: Record<string, string> = {};

  for (const [key, value] of req.nextUrl.searchParams.entries()) {
    if (value.trim()) input[key] = value.trim();
  }

  const discordId = pickDiscordId(input);

  if (!discordId) {
    return NextResponse.json(
      { error: "Missing Discord ID (query, id, or discord_id)." },
      { status: 400 },
    );
  }

  try {
    const data = await withDeadline(
      fetchDiscordApiSanitized(endpoint, discordId),
      OSINT_ROUTE_DEADLINE_MS,
    );

    if (data.count === 0) {
      return NextResponse.json({
        count: 0,
        results: [],
        query: data.query,
        endpoint,
        source: data.source,
        message: "No results were found.",
        ...(data.raw ? { raw: data.raw } : {}),
      });
    }

    return NextResponse.json({
      count: data.count,
      results: data.results,
      query: data.query,
      endpoint,
      source: data.source,
      ...(data.raw ? { raw: data.raw } : {}),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    if (
      /valid Discord ID/i.test(message) ||
      /Missing Discord ID/i.test(message)
    ) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return osintFailureResponse(err, {
      softEmpty: {
        count: 0,
        results: [],
        query: discordId,
        endpoint,
      },
    });
  }
}
