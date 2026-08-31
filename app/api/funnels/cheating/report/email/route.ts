import type { CheatingReportPayload } from "@/lib/cheating-funnel-report-types";

import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { getSessionCookie } from "@/app/lib/session";
import { assertCheatingReportExportAccess } from "@/lib/cheating-funnel-export-auth";
import {
  buildCheatingReportEmailHtml,
  buildCheatingReportPdf,
  sanitizeCheatingReportPayload,
} from "@/lib/cheating-funnel-report";
import { consumeRateLimit } from "@/lib/simple-rate-limit";

export const runtime = "nodejs";

function normalizeEmail(value: unknown) {
  const email = String(value ?? "")
    .trim()
    .toLowerCase();

  if (!email || email.length > 254) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;

  return email;
}

function safeCampaignId(value: unknown) {
  return String(value ?? "report")
    .replace(/[^a-z0-9-]/gi, "-")
    .slice(0, 32);
}

export async function POST(request: NextRequest) {
  const session = await getSessionCookie();

  if (!session?.userId) {
    return NextResponse.json(
      { error: "Sign in and unlock the results before emailing a report." },
      { status: 401 },
    );
  }

  const userId = session.userId as number;
  const rate = consumeRateLimit(
    `cheating-report:email:${userId}`,
    5,
    60 * 60 * 1000,
  );

  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many report emails. Try again later." },
      { status: 429 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    email?: unknown;
    report?: CheatingReportPayload;
  } | null;
  const recipient = normalizeEmail(body?.email);

  if (!recipient) {
    return NextResponse.json(
      { error: "Enter a valid email address." },
      { status: 400 },
    );
  }

  if (!body?.report || !Array.isArray(body.report.records)) {
    return NextResponse.json(
      { error: "Invalid report data." },
      { status: 400 },
    );
  }

  const access = await assertCheatingReportExportAccess({
    userId,
    vaultId: body.report.vaultId,
  });

  if (!access.ok) {
    return NextResponse.json(
      { error: access.error },
      { status: access.status },
    );
  }

  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.REPORT_FROM_EMAIL?.trim();

  if (!resendApiKey || !from) {
    return NextResponse.json(
      {
        error:
          "Email delivery is not configured yet. Download the PDF instead.",
      },
      { status: 503 },
    );
  }

  const report = sanitizeCheatingReportPayload({
    ...body.report,
    vaultId: access.vaultId,
  });
  const pdf = await buildCheatingReportPdf(report);
  const campaignId = safeCampaignId(report.campaignId);
  const idempotencyKey = createHash("sha256")
    .update(
      `${userId}:${recipient}:${report.campaignId}:${report.generatedAt}`,
    )
    .digest("hex");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `cheating-report-${idempotencyKey}`,
    },
    body: JSON.stringify({
      from,
      to: [recipient],
      subject: `Your private Anya report — ${report.campaignId}`,
      html: buildCheatingReportEmailHtml(report),
      attachments: [
        {
          filename: `anya-public-connection-${campaignId}.pdf`,
          content: Buffer.from(pdf).toString("base64"),
        },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");

    console.error("Cheating funnel report email failed", {
      status: response.status,
      detail: detail.slice(0, 500),
    });

    return NextResponse.json(
      { error: "The report could not be emailed. Download the PDF instead." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
