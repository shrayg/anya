import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";
import {
  fetchBreachVipSanitized,
  resolveMinecraftBreachVipFields,
} from "@/lib/breachvip";
import { fetchBreachHubSpecialty, isBreachHubEnabled } from "@/lib/breachhub";
import { fetchCsintMinecraft } from "@/lib/csint";
import { fetchGodsEyeSearchResult, getGodsEyeApiKey } from "@/lib/godseye";
import { isCsintEnabled } from "@/lib/csint";
import { mergeSanitizedResponses } from "@/lib/osintcat";
import { publicServiceUnavailable } from "@/lib/public-branding";
import { osintFailureResponse } from "@/lib/osint-search-guard";

function detectMinecraftCsintType(
  query: string,
): "username" | "email" | "ip" | "uuid" {
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(query)) return "email";
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(query)) return "ip";
  if (
    /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i.test(
      query,
    )
  ) {
    return "uuid";
  }

  return "username";
}

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

    const [godseyeResult, breachVipResult, csintResult, breachHubResult] =
      await Promise.allSettled([
        hasGodsEye
          ? fetchGodsEyeSearchResult("minecraft", query, 12_000)
          : Promise.resolve({ count: 0, results: [] as unknown[] }),
        fetchBreachVipSanitized(query, breachVipFields, { timeoutMs: 12_000 }),
        fetchCsintMinecraft(query, detectMinecraftCsintType(query)),
        fetchBreachHubSpecialty("minecraft", query),
      ]);

    const parts = [];

    if (godseyeResult.status === "fulfilled" && godseyeResult.value.count > 0) {
      parts.push(godseyeResult.value);
    }

    if (
      breachVipResult.status === "fulfilled" &&
      breachVipResult.value.count > 0
    ) {
      parts.push(breachVipResult.value);
    }

    if (
      csintResult.status === "fulfilled" &&
      csintResult.value &&
      csintResult.value.count > 0
    ) {
      parts.push(csintResult.value);
    }

    if (
      breachHubResult.status === "fulfilled" &&
      breachHubResult.value &&
      breachHubResult.value.count > 0
    ) {
      parts.push(breachHubResult.value);
    }

    if (parts.length > 0) {
      const data = mergeSanitizedResponses(...parts);

      return NextResponse.json(data);
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

    return osintFailureResponse(
      err instanceof Error ? err : new Error(String(message)),
    );
  }
}
