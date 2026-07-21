import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";
import {
  fetchBreachHubVictimArchiveBinary,
  fetchBreachHubVictimFile,
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
  const fileId = req.nextUrl.searchParams.get("fileId")?.trim();
  const action = req.nextUrl.searchParams.get("action")?.trim() || "manifest";

  if (!logId) {
    return NextResponse.json({ error: "Missing logId" }, { status: 400 });
  }

  try {
    if (action === "archive") {
      const archive = await withDeadline(
        fetchBreachHubVictimArchiveBinary(logId, 45_000),
        Math.max(OSINT_ROUTE_DEADLINE_MS, 50_000),
      );

      if (!archive) {
        return NextResponse.json({
          logId,
          available: false,
          message: "Archive download is not available for this device.",
        });
      }

      return new NextResponse(new Uint8Array(archive.bytes), {
        status: 200,
        headers: {
          "Content-Type": archive.contentType || "application/zip",
          "Content-Disposition": `attachment; filename="${archive.filename}"`,
          "Cache-Control": "no-store",
        },
      });
    }

    if (action === "file") {
      if (!fileId) {
        return NextResponse.json({ error: "Missing fileId" }, { status: 400 });
      }

      const file = await withDeadline(
        fetchBreachHubVictimFile(logId, fileId, 25_000),
        OSINT_ROUTE_DEADLINE_MS,
      );

      if (!file) {
        return NextResponse.json(
          {
            logId,
            fileId,
            available: false,
            message:
              "File content is not available. The upstream index returned no readable body for this file id.",
          },
          { status: 502 },
        );
      }

      return NextResponse.json({
        available: true,
        logId,
        fileId,
        filename: file.filename ?? null,
        content: file.content,
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
