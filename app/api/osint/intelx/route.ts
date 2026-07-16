import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";

import {
  fetchCsintIntelxWithBuckets,
  isCsintEnabled,
} from "@/lib/csint";
import {
  PUBLIC_INTEL_SOURCE,
  publicSearchError,
  publicServiceUnavailable,
  sanitizePublicText,
} from "@/lib/public-branding";
import { fetchGodsEyeRawExport, getGodsEyeExportApiKey } from "@/lib/godseye";

/** IntelX storage IDs are long hex; UUID-shaped values are usually system IDs. */
const HEX_ID_RE = /^[a-f0-9]{32,256}$/i;
const UUID_RE =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

function normalizeStorageId(raw: string): {
  storageId: string;
  looksLikeUuid: boolean;
} {
  const trimmed = raw.trim();
  const looksLikeUuid = UUID_RE.test(trimmed);
  const storageId = trimmed.replace(/[^a-f0-9]/gi, "");
  return { storageId, looksLikeUuid };
}

export async function GET(req: NextRequest) {
  const access = await requireOsintAccess(req, "intelx");
  if (access instanceof NextResponse) return access;

  const query = req.nextUrl.searchParams.get("query")?.trim();
  const preferredBucket =
    req.nextUrl.searchParams.get("bucket")?.trim() || "leaks.public";

  if (!query) {
    return NextResponse.json(
      { error: "Missing IntelX storage ID" },
      { status: 400 },
    );
  }

  const { storageId, looksLikeUuid } = normalizeStorageId(query);

  if (!HEX_ID_RE.test(storageId)) {
    return NextResponse.json(
      {
        error:
          "Enter a valid IntelX storage ID (32–256 hex characters). UUIDs with dashes are usually system IDs — paste the longer storage hash instead.",
      },
      { status: 400 },
    );
  }

  const hasGodsEyeExport = Boolean(getGodsEyeExportApiKey());
  const hasCsint = isCsintEnabled();

  if (!hasGodsEyeExport && !hasCsint) {
    return NextResponse.json(
      { error: publicServiceUnavailable() },
      { status: 502 },
    );
  }

  let content = "";
  let bucket = preferredBucket;
  let lastError = "";

  // Prefer CSINT first when available (dedicated IntelX quota).
  if (hasCsint) {
    const csint = await fetchCsintIntelxWithBuckets(storageId, preferredBucket);
    if (csint.content.trim()) {
      content = csint.content;
      bucket = csint.bucket;
    } else if (csint.error) {
      lastError = csint.error;
    }
  }

  if (!content && hasGodsEyeExport) {
    // GodsEye already tries known leak buckets internally; avoid hammering capacity.
    const godseye = await fetchGodsEyeRawExport(storageId, preferredBucket);
    if (godseye.content.trim()) {
      content = godseye.content;
      bucket = preferredBucket;
      lastError = "";
    } else if (godseye.error) {
      lastError = godseye.error;
      if (
        !/capacity|rate limit|429|quota/i.test(godseye.error) &&
        preferredBucket !== "leaks.private"
      ) {
        const retry = await fetchGodsEyeRawExport(storageId, "leaks.private");
        if (retry.content.trim()) {
          content = retry.content;
          bucket = "leaks.private";
          lastError = "";
        } else if (retry.error) {
          lastError = retry.error;
        }
      }
    }
  }

  if (!content) {
    let error =
      sanitizePublicText(lastError) ||
      publicSearchError("No IntelX export content returned.");

    if (looksLikeUuid || storageId.length <= 32) {
      error =
        `${error} Tip: this looks like a short system/UUID id. IntelX downloads usually need the longer storage hash from the IntelX item.`;
    }

    return NextResponse.json(
      {
        storageId,
        bucket,
        source: `${PUBLIC_INTEL_SOURCE} · IntelX`,
        content: "",
        error,
        hasContent: false,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    storageId,
    bucket,
    source: `${PUBLIC_INTEL_SOURCE} · IntelX`,
    content,
    hasContent: true,
  });
}
