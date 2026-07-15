import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";

import {
  fetchBreachVipSanitized,
  resolveMinecraftBreachVipFields,
} from "@/lib/breachvip";
import {
  fetchGodsEyeSearchResult,
  getGodsEyeApiKey,
} from "@/lib/godseye";
import { mergeSanitizedResponses } from "@/lib/osintcat";
import { publicServiceUnavailable } from "@/lib/public-branding";

export async function GET(req: NextRequest) {
  const access = await requireOsintAccess(req, "minecraft");
  if (access instanceof NextResponse) return access;

  const query = req.nextUrl.searchParams.get("query")?.trim();

  if (!query) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  try {
    const hasGodsEye = Boolean(getGodsEyeApiKey());
    const breachVipFields = resolveMinecraftBreachVipFields(query);

    const [godseyeResult, breachVipResult] = await Promise.allSettled([
      hasGodsEye
        ? fetchGodsEyeSearchResult("minecraft", query, 12_000)
        : Promise.resolve({ count: 0, results: [] as unknown[] }),
      fetchBreachVipSanitized(query, breachVipFields, { timeoutMs: 12_000 }),
    ]);

    const parts = [];

    if (
      godseyeResult.status === "fulfilled" &&
      godseyeResult.value.count > 0
    ) {
      parts.push(godseyeResult.value);
    }

    if (
      breachVipResult.status === "fulfilled" &&
      breachVipResult.value.count > 0
    ) {
      parts.push(breachVipResult.value);
    }

    if (parts.length > 0) {
      const data = mergeSanitizedResponses(...parts);
      return NextResponse.json(data);
    }

    if (!hasGodsEye && breachVipResult.status === "rejected") {
      throw new Error(publicServiceUnavailable());
    }

    if (
      godseyeResult.status === "rejected" &&
      godseyeResult.reason instanceof Error
    ) {
      throw godseyeResult.reason;
    }

    return NextResponse.json({
      count: 0,
      results: [],
      message: "No results were found.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to reach API";

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
