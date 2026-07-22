import { NextRequest, NextResponse } from "next/server";
import { requireOsintAccess } from "@/lib/osint-api-auth";
import {
  OSINT_ROUTE_DEADLINE_MS,
  osintFailureResponse,
  withDeadline,
} from "@/lib/osint-search-guard";
import { publicServiceUnavailable } from "@/lib/public-branding";
import {
  fetchSeonSanitized,
  isSeonEnabled,
  isSeonEndpoint,
  seonModuleSlugForEndpoint,
  type SeonEndpoint,
} from "@/lib/seon";
export const maxDuration = 60;
type RouteContext = { params: Promise<{ endpoint: string }> };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const PHONE_RE = /^\+?[0-9().\s-]{10,20}$/;
const IP_RE =
  /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$|^[0-9a-f:]+$/i;
const BIN_RE = /^\d{6,8}$/;
export async function GET(req: NextRequest, context: RouteContext) {
  const endpoint = (await context.params).endpoint?.trim().toLowerCase() ?? "";
  if (!isSeonEndpoint(endpoint))
    return NextResponse.json(
      { error: "Unknown SEON endpoint." },
      { status: 404 },
    );
  const seonEndpoint = endpoint as SeonEndpoint;
  const fallback = seonModuleSlugForEndpoint(seonEndpoint);
  const legacy =
    seonEndpoint === "email" || seonEndpoint === "email-verification"
      ? "seon-email"
      : seonEndpoint === "phone"
        ? "seon-phone"
        : fallback;
  let access = await requireOsintAccess(req, `seon/${seonEndpoint}`);
  if (access instanceof NextResponse && access.status === 400)
    access = await requireOsintAccess(req, fallback);
  if (access instanceof NextResponse && access.status === 400)
    access = await requireOsintAccess(req, legacy);
  if (access instanceof NextResponse) return access;
  if (!isSeonEnabled())
    return NextResponse.json(
      { error: publicServiceUnavailable() },
      { status: 503 },
    );
  const key =
    seonEndpoint === "phone"
      ? "phone"
      : seonEndpoint === "ip"
        ? "ip"
        : seonEndpoint === "bin"
          ? "bin"
          : "email";
  const query = (
    req.nextUrl.searchParams.get("query") ||
    req.nextUrl.searchParams.get(key) ||
    ""
  ).trim();
  if (!query)
    return NextResponse.json({ error: "Missing query." }, { status: 400 });
  const valid =
    seonEndpoint === "phone"
      ? PHONE_RE.test(query)
      : seonEndpoint === "ip"
        ? IP_RE.test(query)
        : seonEndpoint === "bin"
          ? BIN_RE.test(query)
          : EMAIL_RE.test(query);
  if (!valid)
    return NextResponse.json({ error: `Invalid ${key}.` }, { status: 400 });
  try {
    const data = await withDeadline(
      fetchSeonSanitized(seonEndpoint, query),
      OSINT_ROUTE_DEADLINE_MS,
    );
    return NextResponse.json({
      count: data.count,
      results: data.results,
      query: data.query,
      source: data.source,
      endpoint: seonEndpoint,
      ...(data.count ? {} : { message: "No results were found." }),
      ...(data.raw ? { raw: data.raw } : {}),
    });
  } catch (err) {
    return osintFailureResponse(err, {
      softEmpty: { count: 0, results: [], query, endpoint: seonEndpoint },
    });
  }
}
