import { NextRequest, NextResponse } from "next/server";

import { PUBLIC_INTEL_SOURCE, publicSearchError, sanitizePublicText } from "@/lib/public-branding";
import { fetchGodsEyeRawExport } from "@/lib/godseye";

const HEX_ID_RE = /^[a-f0-9]{32,64}$/i;

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("query")?.trim();
  const bucket = req.nextUrl.searchParams.get("bucket")?.trim() || "leaks.public";

  if (!query) {
    return NextResponse.json({ error: "Missing IntelX storage ID" }, { status: 400 });
  }

  const storageId = query.replace(/[^a-f0-9]/gi, "");

  if (!HEX_ID_RE.test(storageId)) {
    return NextResponse.json(
      { error: "Enter a valid IntelX system identifier (hex UUID)." },
      { status: 400 },
    );
  }

  const { content, error } = await fetchGodsEyeRawExport(storageId, bucket);

  if (error && !content) {
    return NextResponse.json({ error: sanitizePublicText(error) }, { status: 502 });
  }

  return NextResponse.json({
    storageId,
    bucket,
    source: `${PUBLIC_INTEL_SOURCE} · IntelX`,
    content,
    error,
    hasContent: content.length > 0,
  });
}
