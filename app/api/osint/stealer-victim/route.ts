import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";
import {
  fetchBreachHubVictimArchiveBinary,
  fetchBreachHubVictimFile,
  fetchBreachHubVictimManifest,
  isBreachHubEnabled,
} from "@/lib/breachhub";
import { hasDirectOathnetKey } from "@/lib/oathnet";
import {
  OSINT_ROUTE_DEADLINE_MS,
  osintFailureResponse,
  withDeadline,
} from "@/lib/osint-search-guard";
import { publicServiceUnavailable } from "@/lib/public-branding";

export async function GET(req: NextRequest) {
  const access = await requireOsintAccess(req, "breach");

  if (access instanceof NextResponse) return access;

  if (!isBreachHubEnabled() && !hasDirectOathnetKey()) {
    return NextResponse.json(
      {
        error: publicServiceUnavailable(),
        message:
          "Archive file access is not configured. Set the archive provider API key on the server.",
      },
      { status: 503 },
    );
  }

  const logId = req.nextUrl.searchParams.get("logId")?.trim();
  const machineId = req.nextUrl.searchParams.get("machineId")?.trim();
  const victimId = req.nextUrl.searchParams.get("victimId")?.trim();
  const archiveHash = req.nextUrl.searchParams.get("archiveHash")?.trim();
  const fileId = req.nextUrl.searchParams.get("fileId")?.trim();
  const action = req.nextUrl.searchParams.get("action")?.trim() || "manifest";
  const idOpts = { machineId, victimId, archiveHash };

  if (!logId) {
    return NextResponse.json({ error: "Missing logId" }, { status: 400 });
  }

  try {
    if (action === "archive") {
      const archive = await withDeadline(
        fetchBreachHubVictimArchiveBinary(logId, 45_000, idOpts),
        Math.max(OSINT_ROUTE_DEADLINE_MS, 50_000),
      );

      if (!archive) {
        return NextResponse.json({
          logId,
          available: false,
          message: !hasDirectOathnetKey()
            ? "Archive download is not available. Configure the archive provider API key on the server, or try again later."
            : "Archive download is not available for this device.",
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
        fetchBreachHubVictimFile(logId, fileId, 25_000, idOpts),
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
      fetchBreachHubVictimManifest(logId, 25_000, idOpts),
      OSINT_ROUTE_DEADLINE_MS,
    );

    if (!manifest) {
      return NextResponse.json(
        {
          logId,
          available: false,
          message: !hasDirectOathnetKey()
            ? "File manifest is not available. Configure the archive provider API key on the server."
            : "File manifest is not available for this device. Upstream returned no victim tree.",
          files: [],
        },
        { status: 502 },
      );
    }

    if (manifest.archiveOnly) {
      return NextResponse.json({
        available: true,
        archiveOnly: true,
        logId: manifest.logId || logId,
        label: manifest.label ?? null,
        machineId: manifest.machineId ?? null,
        victimId: manifest.victimId ?? victimId ?? null,
        archiveHash: manifest.archiveHash ?? archiveHash ?? null,
        os: manifest.os,
        date: manifest.date,
        malware: manifest.malware,
        country: manifest.country,
        credentials: manifest.credentials,
        summary: manifest.summary,
        properties: manifest.properties,
        cookies: manifest.cookies,
        files: [],
        message:
          manifest.message ||
          "File tree is too large to browse online. Download the full archive instead.",
      });
    }

    if (!manifest.files?.length) {
      return NextResponse.json(
        {
          logId: manifest.logId || logId,
          available: false,
          label: manifest.label ?? null,
          machineId: manifest.machineId ?? null,
          message:
            "File manifest is empty for this device. Upstream responded but included no file tree.",
          files: [],
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      available: true,
      logId: manifest.logId || logId,
      label: manifest.label,
      machineId: manifest.machineId,
      victimId: manifest.victimId ?? victimId ?? null,
      archiveHash: manifest.archiveHash ?? archiveHash ?? null,
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
    const message =
      err instanceof Error && err.message.trim()
        ? err.message.trim()
        : "File manifest is not available for this device.";

    return osintFailureResponse(err, {
      softEmpty: {
        logId,
        available: false,
        files: [],
        message,
      },
    });
  }
}
