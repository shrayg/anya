import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";
import {
  fetchBreachVipSanitized,
  resolveMinecraftBreachVipFields,
} from "@/lib/breachvip";
import { getGodsEyeApiKey } from "@/lib/godseye";
import { isBreachHubEnabled } from "@/lib/breachhub";
import { isCsintEnabled } from "@/lib/csint";
import { mergeSanitizedResponses } from "@/lib/osintcat";
import { fetchGodsEyeOnlySearch } from "@/lib/osint-combined";
import { shouldUseDirectBreachVip } from "@/lib/provider-dedupe";
import { publicServiceUnavailable } from "@/lib/public-branding";
import { osintFailureResponse } from "@/lib/osint-search-guard";

export async function GET(req: NextRequest) {
  const access = await requireOsintAccess(req, "minecraft");

  if (access instanceof NextResponse) return access;

  const query = req.nextUrl.searchParams.get("query")?.trim();

  if (!query) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  try {
    const hasGodsEye = Boolean(getGodsEyeApiKey());
    const hasCsint = isCsintEnabled();
    const hasBreachHub = isBreachHubEnabled();
    const breachVipFields = resolveMinecraftBreachVipFields(query);

    // GodsEye ∥ BreachHub specialty→CSINT (sequential, no vendor double-hit).
    // Direct BreachVIP only when BH is not primary.
    const [platformResult, breachVipResult] = await Promise.allSettled([
      fetchGodsEyeOnlySearch(query, "minecraft", undefined, "minecraft"),
      shouldUseDirectBreachVip()
        ? fetchBreachVipSanitized(query, breachVipFields, { timeoutMs: 12_000 })
        : Promise.resolve({ count: 0, results: [] as unknown[] }),
    ]);

    const parts = [];

    if (
      platformResult.status === "fulfilled" &&
      platformResult.value.count > 0
    ) {
      parts.push(platformResult.value);
    }

    if (
      breachVipResult.status === "fulfilled" &&
      breachVipResult.value.count > 0
    ) {
      parts.push(breachVipResult.value);
    }

    if (parts.length > 0) {
      return NextResponse.json(mergeSanitizedResponses(...parts));
    }

    if (
      !hasGodsEye &&
      !hasCsint &&
      !hasBreachHub &&
      breachVipResult.status === "rejected"
    ) {
      throw new Error(publicServiceUnavailable());
    }

    if (
      platformResult.status === "rejected" &&
      platformResult.reason instanceof Error
    ) {
      throw platformResult.reason;
    }

    return NextResponse.json({
      count: 0,
      results: [],
      message: "No results were found.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to reach API";

    return osintFailureResponse(
      err instanceof Error ? err : new Error(String(message)),
    );
  }
}
