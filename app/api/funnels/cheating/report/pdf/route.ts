import type { CheatingReportPayload } from "@/lib/cheating-funnel-report-types";

import { NextRequest, NextResponse } from "next/server";

import { getSessionCookie } from "@/app/lib/session";
import { assertCheatingReportExportAccess } from "@/lib/cheating-funnel-export-auth";
import { buildCheatingReportPdf } from "@/lib/cheating-funnel-report";
import { consumeRateLimit } from "@/lib/simple-rate-limit";

export const runtime = "nodejs";

function safeCampaignId(value: unknown) {
  return String(value ?? "report")
    .replace(/[^a-z0-9-]/gi, "-")
    .slice(0, 32);
}

export async function POST(request: NextRequest) {
  const session = await getSessionCookie();

  if (!session?.userId) {
    return NextResponse.json(
      { error: "Sign in and unlock the results before exporting." },
      { status: 401 },
    );
  }

  const userId = session.userId as number;
  const rate = consumeRateLimit(
    `cheating-report:pdf:${userId}`,
    20,
    60 * 60 * 1000,
  );

  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many report exports. Try again later." },
      { status: 429 },
    );
  }

  const body = (await request
    .json()
    .catch(() => null)) as CheatingReportPayload | null;

  if (!body || !Array.isArray(body.records)) {
    return NextResponse.json(
      { error: "Invalid report data." },
      { status: 400 },
    );
  }

  const access = await assertCheatingReportExportAccess({
    userId,
    vaultId: body.vaultId,
  });

  if (!access.ok) {
    return NextResponse.json(
      { error: access.error },
      { status: access.status },
    );
  }

  const pdf = await buildCheatingReportPdf({
    ...body,
    vaultId: access.vaultId,
  });
  const campaignId = safeCampaignId(body.campaignId);

  return new NextResponse(Buffer.from(pdf), {
    status: 200,
    headers: {
      "Cache-Control": "no-store, private",
      "Content-Disposition": `attachment; filename="anya-public-connection-${campaignId}.pdf"`,
      "Content-Type": "application/pdf",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
