import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";
import {
  fetchBreachHubVictimArchiveUrl,
  fetchBreachHubVictimManifest,
  isBreachHubEnabled,
} from "@/lib/breachhub";
import {
  OSINT_ROUTE_DEADLINE_MS,
  osintFailureResponse,
  withDeadline,
} from "@/lib/osint-search-guard";
import { publicServiceUnavailable } from "@/lib/public-branding";

export async function GET(req: NextRequest) {
  const access = await requireOsintAccess(req, "breach");

  if (access instanceof NextResponse) return access;

  if (!isBreachHubEnabled()) {
    return NextResponse.json(
      { error: publicServiceUnavailable() },
      { status: 503 },
    );
  }

  const logId = req.nextUrl.searchParams.get("logId")?.trim();
  const action = req.nextUrl.searchParams.get("action")?.trim() || "manifest";

  if (!logId) {
    return NextResponse.json({ error: "Missing logId" }, { status: 400 });
  }

  try {
    if (action === "archive") {
      const archive = await withDeadline(
        fetchBreachHubVictimArchiveUrl(logId, 25_000),
        OSINT_ROUTE_DEADLINE_MS,
      );

      if (!archive) {
        return NextResponse.json({
          logId,
          available: false,
          message: "Archive download is not available for this device.",
        });
      }

      return NextResponse.json({
        logId,
        available: true,
        downloadUrl: archive.downloadUrl ?? null,
        payload: archive.payload ?? null,
      });
    }

    const manifest = await withDeadline(
      fetchBreachHubVictimManifest(logId, 25_000),
      OSINT_ROUTE_DEADLINE_MS,
    );

    if (!manifest) {
      return NextResponse.json({
        logId,
        available: false,
        message: "File manifest is not available for this device.",
        files: [],
      });
    }

    return NextResponse.json({
      available: true,
      logId,
      label: manifest.label,
      machineId: manifest.machineId,
      os: manifest.os,
      date: manifest.date,
      malware: manifest.malware,
      country: manifest.country,
      credentials: manifest.credentials,
      summary: manifest.summary,
      properties: manifest.properties,
      cookies: manifest.cookies,
      files: manifest.files,
    });
  } catch (err) {
    return osintFailureResponse(err, {
      softEmpty: {
        logId,
        available: false,
        files: [],
        message: "File manifest is not available for this device.",
      },
    });
  }
}
