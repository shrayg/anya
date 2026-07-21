import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";
import { fetchCsintReddit, flattenCsintEntity } from "@/lib/csint";
import { fetchGodsEyeOnlySearch } from "@/lib/osint-combined";
import { mergeSanitizedResponses } from "@/lib/osintcat";
import { osintFailureResponse } from "@/lib/osint-search-guard";
import { withPrimaryFallback } from "@/lib/provider-dedupe";
import {
  fetchRoom101Sanitized,
  isRoom101Enabled,
} from "@/lib/room101";

export async function GET(req: NextRequest) {
  const access = await requireOsintAccess(req, "reddit");

  if (access instanceof NextResponse) return access;

  const query = req.nextUrl.searchParams.get("query")?.trim();

  if (!query) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  try {
    const [indexData, profile] = await Promise.all([
      fetchGodsEyeOnlySearch(query, "reddit").catch(() => ({
        count: 0,
        results: [] as unknown[],
      })),
      // Room101 (BH or direct) first for Reddit username profile; CSINT only after miss.
      (async () => {
        const { value } = await withPrimaryFallback(
          async () => {
            if (!isRoom101Enabled()) return null;

            const data = await fetchRoom101Sanitized("user", {
              username: query,
            });

            if (data.count <= 0) return null;

            const first = data.results[0];

            if (first && typeof first === "object" && !Array.isArray(first)) {
              return first as Record<string, unknown>;
            }

            return { results: data.results, count: data.count };
          },
          async () => flattenCsintEntity(await fetchCsintReddit(query)),
          (row) => Boolean(row && Object.keys(row).length > 0),
        );

        return value;
      })(),
    ]);

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
        ...(profile ? { profile } : {}),
      });
    }

    return NextResponse.json({
      query,
      ...merged,
      ...(profile ? { profile } : {}),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to reach API";

    return osintFailureResponse(
      err instanceof Error ? err : new Error(String(message)),
    );
  }
}
