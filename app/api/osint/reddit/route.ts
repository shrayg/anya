import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";

import { fetchCsintReddit, flattenCsintEntity } from "@/lib/csint";
import { fetchGodsEyeOnlySearch } from "@/lib/osint-combined";
import { mergeSanitizedResponses } from "@/lib/osintcat";

export async function GET(req: NextRequest) {
  const access = await requireOsintAccess(req, "reddit");
  if (access instanceof NextResponse) return access;

  const query = req.nextUrl.searchParams.get("query")?.trim();

  if (!query) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  try {
    const [indexData, profilePayload] = await Promise.all([
      fetchGodsEyeOnlySearch(query, "reddit").catch(() => ({
        count: 0,
        results: [] as unknown[],
      })),
      fetchCsintReddit(query),
    ]);

    const profile = flattenCsintEntity(profilePayload);
    const parts = [indexData];
    if (profile) {
      parts.push({ count: 1, results: [profile] });
    }

    const merged = mergeSanitizedResponses(...parts);

    if (merged.count === 0) {
      return NextResponse.json({
        query,
        count: 0,
        results: [],
        message: "No results were found.",
        ...(profilePayload && !profile
          ? {}
          : profile
            ? { profile }
            : {}),
      });
    }

    return NextResponse.json({
      query,
      ...merged,
      ...(profile ? { profile } : {}),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to reach API";

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
