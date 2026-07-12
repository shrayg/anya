import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";

import { fetchGodsEyeEmailReport } from "@/lib/godseye";
import {
  normalizeEmail,
  searchProxynovaCombForEmail,
} from "@/lib/proxynova-comb";

export async function GET(req: NextRequest) {
  const access = await requireOsintAccess(req, "breaches");
  if (access instanceof NextResponse) return access;

  const query = req.nextUrl.searchParams.get("query")?.trim();

  if (!query) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  const email = normalizeEmail(query);

  if (!email) {
    return NextResponse.json(
      { error: "Enter a valid email address." },
      { status: 400 },
    );
  }

  const start = Number(req.nextUrl.searchParams.get("start") ?? 0);
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 100);

  const [combResult, godseyeReport] = await Promise.all([
    searchProxynovaCombForEmail(email, { start, limit }),
    fetchGodsEyeEmailReport(email),
  ]);

  const response = {
    ...combResult,
    godseyeReport,
    hasGodsEyeReport: Boolean(godseyeReport),
  };

  if (combResult.returned === 0 && !godseyeReport) {
    return NextResponse.json({
      ...response,
      message: "No results were found.",
    });
  }

  return NextResponse.json(response);
}
