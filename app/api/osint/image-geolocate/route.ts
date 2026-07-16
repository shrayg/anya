import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";

import { fetchCsintImageGeolocate } from "@/lib/csint";
import { fetchGodsEyeGeolocate } from "@/lib/godseye";
import {
  PUBLIC_INTEL_SOURCE,
  publicSearchError,
  publicServiceUnavailable,
} from "@/lib/public-branding";

/**
 * Image geolocation — accepts a public image URL in `query`.
 * The server fetches the image and forwards base64 to the intelligence provider.
 */
export async function GET(req: NextRequest) {
  const access = await requireOsintAccess(req, "image-geolocate");
  if (access instanceof NextResponse) return access;

  const query = req.nextUrl.searchParams.get("query")?.trim();

  if (!query) {
    return NextResponse.json(
      { error: "Paste a direct image URL to geolocate." },
      { status: 400 },
    );
  }

  if (!/^https?:\/\//i.test(query)) {
    return NextResponse.json(
      { error: "Enter a full http(s) image URL." },
      { status: 400 },
    );
  }

  try {
    const imageRes = await fetch(query, {
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });

    if (!imageRes.ok) {
      return NextResponse.json(
        { error: "Could not download that image URL." },
        { status: 400 },
      );
    }

    const contentType = imageRes.headers.get("content-type") || "image/jpeg";
    if (!contentType.startsWith("image/")) {
      return NextResponse.json(
        { error: "URL did not return an image." },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await imageRes.arrayBuffer());
    if (buffer.byteLength < 2_000) {
      return NextResponse.json(
        { error: "Image is too small. Use a real photo URL, not an icon." },
        { status: 400 },
      );
    }
    if (buffer.byteLength > 4 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Image is too large (max 4MB)." },
        { status: 400 },
      );
    }

    const base64 = buffer.toString("base64");

    try {
      const data = await fetchCsintImageGeolocate(base64);
      return NextResponse.json(data);
    } catch (csintErr) {
      const fallback = await fetchGodsEyeGeolocate({
        image: `data:${contentType};base64,${base64}`,
      });
      if (!fallback) {
        throw csintErr instanceof Error
          ? csintErr
          : new Error(publicServiceUnavailable());
      }
      return NextResponse.json({
        source: PUBLIC_INTEL_SOURCE,
        ...fallback,
      });
    }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : publicSearchError();
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  const access = await requireOsintAccess(req, "image-geolocate");
  if (access instanceof NextResponse) return access;

  let body: { image?: string };
  try {
    body = (await req.json()) as { image?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.image) {
    return NextResponse.json(
      { error: "Provide image (base64 data URL) in the request body." },
      { status: 400 },
    );
  }

  try {
    const data = await fetchCsintImageGeolocate(body.image);
    return NextResponse.json(data);
  } catch (err) {
    const fallback = await fetchGodsEyeGeolocate({ image: body.image });
    if (fallback) {
      return NextResponse.json({
        source: PUBLIC_INTEL_SOURCE,
        ...fallback,
      });
    }
    const message =
      err instanceof Error ? err.message : publicSearchError();
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
