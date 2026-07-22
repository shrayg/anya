import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";
import {
  buildMelissaParams,
  fetchMelissaSanitized,
  isMelissaEnabled,
  MELISSA_PARAM_KEYS,
  type MelissaLookupBody,
} from "@/lib/melissa";
import {
  OSINT_ROUTE_DEADLINE_MS,
  osintFailureResponse,
  withDeadline,
} from "@/lib/osint-search-guard";
import { publicServiceUnavailable } from "@/lib/public-branding";

export const maxDuration = 60;

/**
 * GET /api/melissa?query=…&input=…&email=…&phone=…&first=…&last=…
 *
 * Proxies Melissa contact enrichment (direct MELISSA_API_KEY, BreachHub, or CSINT).
 */
export async function GET(req: NextRequest) {
  const access = await requireOsintAccess(req, "melissa");

  if (access instanceof NextResponse) {
    if (access.status === 400) {
      const retry = await requireOsintAccess(req, "contact-enrich");

      if (retry instanceof NextResponse) return retry;
    } else {
      return access;
    }
  }

  if (!isMelissaEnabled()) {
    return NextResponse.json(
      { error: publicServiceUnavailable() },
      { status: 503 },
    );
  }

  const body: MelissaLookupBody = {};

  for (const key of MELISSA_PARAM_KEYS) {
    const value = req.nextUrl.searchParams.get(key)?.trim();

    if (value) body[key] = value;
  }

  const params = buildMelissaParams(body);

  if (Object.keys(params).length === 0) {
    return NextResponse.json(
      {
        error:
          "Enter a name, email, phone, IP, or address to look up (query or input).",
      },
      { status: 400 },
    );
  }

  try {
    const data = await withDeadline(
      fetchMelissaSanitized(body),
      OSINT_ROUTE_DEADLINE_MS,
    );

    if (data.count === 0) {
      return NextResponse.json({
        count: 0,
        results: [],
        query: data.query,
        source: data.source,
        message: "No results were found.",
      });
    }

    return NextResponse.json({
      count: data.count,
      results: data.results,
      query: data.query,
      source: data.source,
    });
  } catch (err) {
    return osintFailureResponse(err, {
      softEmpty: {
        count: 0,
        results: [],
        query: params.input || params.email || params.phone || params.ip || "",
      },
    });
  }
}
