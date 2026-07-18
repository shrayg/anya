import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";

import {
  fetchCsintIntelx,
  fetchCsintIntelxWithBuckets,
  isCsintEnabled,
} from "@/lib/csint";
import {
  DEFAULT_INTELX_BUCKET,
  isIntelxBucket,
} from "@/lib/intelx-buckets";
import {
  PUBLIC_BRAND,
  publicSearchError,
  publicServiceUnavailable,
  sanitizePublicContent,
  sanitizePublicText,
} from "@/lib/public-branding";
import { isBrandPlaceholderValue } from "@/lib/intel-record";
import { fetchGodsEyeRawExport, getGodsEyeExportApiKey } from "@/lib/godseye";

/** IntelX System ID shape (UUID). API accepts this as storageid when it is a real item id. */
const UUID_RE =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
/** Docs example storage hash is long hex (typically 40–256 chars). */
const HEX_STORAGE_RE = /^[a-f0-9]{40,256}$/i;

const WEBSITE_DID_UNSUPPORTED =
  "Nothing found. intelx.io share links (?did=…) use a website ID that cannot be downloaded via the API. Paste the Storage ID (long hex hash) from the IntelX item / download API instead — not the link’s did parameter.";

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

/**
 * Parse pasted intelx.io URLs and raw IDs.
 * Website `did` is not a downloadable storageid — refuse without burning quota.
 */
function parseIntelxQuery(raw: string): {
  storageId: string;
  idKind: "uuid" | "storage" | "invalid";
  fromWebsiteDid: boolean;
} {
  const trimmed = raw.trim();

  const looksLikeUrl =
    /intelx\.io/i.test(trimmed) ||
    /^https?:\/\//i.test(trimmed) ||
    /[?&](did|storageid|systemid|sid)=/i.test(trimmed);

  if (looksLikeUrl) {
    try {
      const url = new URL(
        /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`,
      );
      const did = url.searchParams.get("did")?.trim() || "";
      const storageParam =
        url.searchParams.get("storageid")?.trim() ||
        url.searchParams.get("systemid")?.trim() ||
        url.searchParams.get("sid")?.trim() ||
        "";

      if (storageParam) {
        const normalized = normalizeStorageId(storageParam);
        return { ...normalized, fromWebsiteDid: false };
      }

      if (did) {
        return {
          storageId: did.toLowerCase(),
          idKind: "uuid",
          fromWebsiteDid: true,
        };
      }
    } catch {
      // Fall through to raw ID parsing.
    }
  }

  const normalized = normalizeStorageId(trimmed);
  return { ...normalized, fromWebsiteDid: false };
}

export async function GET(req: NextRequest) {
  const access = await requireOsintAccess(req, "intelx");
  if (access instanceof NextResponse) return access;

  const query = req.nextUrl.searchParams.get("query")?.trim();
  // Bucket is optional — UI no longer exposes a picker; we auto-try common buckets.
  const bucketParam = req.nextUrl.searchParams.get("bucket")?.trim() || "";
  const preferredBucket = isIntelxBucket(bucketParam)
    ? bucketParam
    : DEFAULT_INTELX_BUCKET;

  if (!query) {
    return NextResponse.json(
      { error: "Missing IntelX Storage ID (long hex) or System ID" },
      { status: 400 },
    );
  }

  const { storageId, idKind, fromWebsiteDid } = parseIntelxQuery(query);

  if (fromWebsiteDid) {
    return NextResponse.json(
      {
        storageId,
        idKind,
        bucket: preferredBucket,
        source: `${PUBLIC_BRAND} · IntelX`,
        content: "",
        error: WEBSITE_DID_UNSUPPORTED,
        hasContent: false,
        rejectedWebsiteDid: true,
      },
      { status: 404 },
    );
  }

  if (idKind === "invalid") {
    return NextResponse.json(
      {
        error:
          "Enter an IntelX Storage ID (long hex hash) from the item download API. intelx.io ?did= share links are not supported.",
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
  // UUIDs: one bucket only — bare website did UUIDs 404 everywhere and must not burn quota.
  if (hasCsint) {
    const csint =
      idKind === "uuid"
        ? await fetchCsintIntelx(storageId, preferredBucket)
        : await fetchCsintIntelxWithBuckets(storageId, preferredBucket);
    if (csint.content.trim()) {
      content = csint.content;
      bucket = isIntelxBucket(csint.bucket) ? csint.bucket : preferredBucket;
    } else if (csint.error) {
      lastError = csint.error;
    }
  }

  if (!content && hasGodsEyeExport) {
    // GodsEye already tries known leak buckets internally; avoid hammering capacity.
    // No second-bucket retry for UUIDs (same hopeless-did problem).
    const godseye = await fetchGodsEyeRawExport(storageId, preferredBucket);
    if (godseye.content.trim()) {
      content = godseye.content;
      bucket = preferredBucket;
      lastError = "";
    } else if (godseye.error) {
      lastError = godseye.error;
      if (
        idKind === "storage" &&
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

  // Defense in depth: strip upstream credits / "powered by csint tools" footers.
  content = sanitizePublicContent(content).trim();

  // Provider-name scrubbing must never leave the product brand as fake "content".
  if (content && isBrandPlaceholderValue(content)) {
    content = "";
    if (!lastError) {
      lastError = "No IntelX export content returned.";
    }
  }

  if (!content) {
    let error =
      sanitizePublicText(lastError) ||
      publicSearchError("No IntelX export content returned.");

    if (/HTTP 400|bad request/i.test(lastError)) {
      error = `${error} Tip: use a long Storage ID hex hash from the IntelX item (not an intelx.io ?did= link).`;
    } else if (/HTTP 404|not found/i.test(lastError)) {
      error =
        idKind === "uuid"
          ? "Nothing found. If this UUID came from an intelx.io share link (?did=), it cannot be downloaded via the API — use the Storage ID (long hex) from the item instead."
          : `${error} Tip: Storage ID was accepted but not found in common leak buckets — confirm the ID is a downloadable Storage ID (long hex), not a website share link.`;
    }

    return NextResponse.json(
      {
        storageId,
        idKind,
        bucket,
        source: `${PUBLIC_BRAND} · IntelX`,
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
    source: `${PUBLIC_BRAND} · IntelX`,
    content,
    poweredBy: PUBLIC_BRAND,
    hasContent: true,
  });
}
