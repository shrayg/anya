import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";

import {
  fetchCsintIntelxWithBuckets,
  isCsintEnabled,
} from "@/lib/csint";
import {
  DEFAULT_INTELX_BUCKET,
  isIntelxBucket,
} from "@/lib/intelx-buckets";
import {
  PUBLIC_INTEL_SOURCE,
  publicSearchError,
  publicServiceUnavailable,
  sanitizePublicText,
} from "@/lib/public-branding";
import { fetchGodsEyeRawExport, getGodsEyeExportApiKey } from "@/lib/godseye";

/** Docs call this System ID; param name is storageid. UUID form is accepted upstream. */
const UUID_RE =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
/** Docs example storage hash is long hex (typically 40–256 chars). */
const HEX_STORAGE_RE = /^[a-f0-9]{40,256}$/i;

function normalizeStorageId(raw: string): {
  storageId: string;
  idKind: "uuid" | "storage" | "invalid";
} {
  const trimmed = raw.trim();

  if (UUID_RE.test(trimmed)) {
    return { storageId: trimmed.toLowerCase(), idKind: "uuid" };
  }

  const hex = trimmed.replace(/[^a-f0-9]/gi, "");

  // Bare 32-char hex is a System ID without dashes — upstream returns 400 if undashed.
  if (/^[a-f0-9]{32}$/i.test(hex)) {
    const uuid = [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20),
    ]
      .join("-")
      .toLowerCase();
    return { storageId: uuid, idKind: "uuid" };
  }

  if (HEX_STORAGE_RE.test(hex)) {
    return { storageId: hex.toLowerCase(), idKind: "storage" };
  }

  return { storageId: hex || trimmed, idKind: "invalid" };
}

export async function GET(req: NextRequest) {
  const access = await requireOsintAccess(req, "intelx");
  if (access instanceof NextResponse) return access;

  const query = req.nextUrl.searchParams.get("query")?.trim();
  const bucketParam = req.nextUrl.searchParams.get("bucket")?.trim() || "";
  const preferredBucket = isIntelxBucket(bucketParam)
    ? bucketParam
    : DEFAULT_INTELX_BUCKET;

  if (!query) {
    return NextResponse.json(
      { error: "Missing IntelX System ID or Storage ID" },
      { status: 400 },
    );
  }

  const { storageId, idKind } = normalizeStorageId(query);

  if (idKind === "invalid") {
    return NextResponse.json(
      {
        error:
          "Enter an IntelX System ID (UUID) or Storage ID (long hex hash). Both are sent as storageid.",
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

  // Prefer CSINT first (dedicated /api/intelx, text/plain handling, IntelX daily quota).
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

    if (/HTTP 400|bad request/i.test(lastError)) {
      error = `${error} Tip: use a System ID (UUID with dashes) or a long Storage ID hex hash from the IntelX item.`;
    } else if (/HTTP 404|not found/i.test(lastError)) {
      error = `${error} Tip: ID was accepted but not found in tried buckets — pick the bucket that matches the IntelX item (e.g. leaks.private vs leaks.public).`;
    }

    return NextResponse.json(
      {
        storageId,
        idKind,
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
    idKind,
    bucket,
    source: `${PUBLIC_INTEL_SOURCE} · IntelX`,
    content,
    hasContent: true,
  });
}
