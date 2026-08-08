import { NextRequest, NextResponse } from "next/server";

import {
  fetchOathnetSanitized,
  isOathnetEnabled,
  resolveOathnetPath,
} from "@/lib/oathnet";
import { requireOsintAccess } from "@/lib/osint-api-auth";
import {
  OSINT_ROUTE_DEADLINE_MS,
  osintFailureResponse,
  withDeadline,
} from "@/lib/osint-search-guard";
import { publicServiceUnavailable } from "@/lib/public-branding";

export const maxDuration = 60;

type RouteContext = { params: Promise<{ path: string[] }> };

/**
 * GET /api/oathnet/<endpoint>
 * Full OathNet surface including victims/{log_id}[/files/{file_id}|/archive].
 * Plan gate: Ultimate / Enterprise only (`forceModuleSlug: "oathnet"`).
 * Tools are surfaced inside category modules — this route is the shared backend.
 */
export async function GET(req: NextRequest, context: RouteContext) {
  const { path: pathParts } = await context.params;
  const resolved = resolveOathnetPath(pathParts ?? []);

  if (!resolved) {
    return NextResponse.json(
      { error: "Unknown endpoint." },
      { status: 404 },
    );
  }

  const endpointKey =
    resolved.kind === "static"
      ? resolved.endpoint
      : resolved.kind === "victims-log"
        ? `victims/${resolved.logId}`
        : resolved.kind === "victims-file"
          ? `victims/${resolved.logId}/files/${resolved.fileId}`
          : `victims/${resolved.logId}/archive`;

  // Dedicated OathNet surface is Ultimate / Enterprise only — do not honor
  // parent moduleSlug (breaches / stealer-logs / discord-id) to bypass the gate.
  const access = await requireOsintAccess(req, `oathnet/${endpointKey}`, {
    forceModuleSlug: "oathnet",
  });
  if (access instanceof NextResponse) return access;

  if (!isOathnetEnabled()) {
    return NextResponse.json(
      { error: publicServiceUnavailable() },
      { status: 503 },
    );
  }

  const input: Record<string, string> = {};

  for (const [key, value] of req.nextUrl.searchParams.entries()) {
    if (value.trim()) input[key] = value.trim();
  }

  // Path-param follow-ups don't need query string.
  if (
    resolved.kind === "static" &&
    Object.keys(input).length === 0
  ) {
    return NextResponse.json({ error: "Missing query." }, { status: 400 });
  }

  try {
    const data = await withDeadline(
      fetchOathnetSanitized(resolved, input),
      OSINT_ROUTE_DEADLINE_MS,
    );

    if (resolved.kind === "static" && !data.query) {
      return NextResponse.json(
        { error: "Missing required parameter." },
        { status: 400 },
      );
    }

    return NextResponse.json({
      count: data.count,
      results: data.results,
      query: data.query,
      source: data.source,
      endpoint: data.endpoint,
      ...(data.count ? {} : { message: "No results were found." }),
    });
  } catch (err) {
    return osintFailureResponse(err, {
      softEmpty: {
        count: 0,
        results: [],
        query: input.query || input.discord_id || input.email || "",
        endpoint: endpointKey,
      },
    });
  }
}
