import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";

import { PUBLIC_INTEL_SOURCE, publicServiceUnavailable } from "@/lib/public-branding";
import { fetchGodsEyeGeolocate } from "@/lib/godseye";

export async function GET(req: NextRequest) {
  const access = await requireOsintAccess(req, "geolocate");
  if (access instanceof NextResponse) return access;

  const ip = req.nextUrl.searchParams.get("ip")?.trim();
  const query = req.nextUrl.searchParams.get("query")?.trim();
  const target = ip || query;

  if (!target) {
    return NextResponse.json(
      { error: "Provide an ip or query parameter." },
      { status: 400 },
    );
  }

  const data = await fetchGodsEyeGeolocate({ ip: target });

  if (!data) {
    return NextResponse.json(
      { error: publicServiceUnavailable() },
      { status: 502 },
    );
  }

  return NextResponse.json({ ip: target, source: PUBLIC_INTEL_SOURCE, ...data });
}

export async function POST(req: NextRequest) {
  const access = await requireOsintAccess(req, "geolocate");
  if (access instanceof NextResponse) return access;

  let body: { image?: string; ip?: string };

  try {
    body = (await req.json()) as { image?: string; ip?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.image && !body.ip) {
    return NextResponse.json(
      { error: "Provide image (base64) or ip in the request body." },
      { status: 400 },
    );
  }

  const data = await fetchGodsEyeGeolocate(body);

  if (!data) {
    return NextResponse.json(
      { error: publicServiceUnavailable() },
      { status: 502 },
    );
  }

  return NextResponse.json({ source: PUBLIC_INTEL_SOURCE, ...data });
}
