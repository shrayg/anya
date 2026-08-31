import "server-only";

import type {
  CheatingReportAnswer,
  CheatingReportField,
  CheatingReportPayload,
  CheatingReportRecord,
} from "@/lib/cheating-funnel-report-types";

import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";

const MAX_RECORDS = 100;
const MAX_FIELDS_PER_RECORD = 36;
const MAX_ANSWERS = 12;
const MAX_TEXT = 700;

function cleanText(value: unknown, max = MAX_TEXT) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    // pdf-lib WinAnsi cannot encode most Unicode — replace unsupported glyphs.
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, "?")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function cleanField(field: CheatingReportField): CheatingReportField | null {
  const label = cleanText(field?.label, 100);
  const value = cleanText(field?.value);

  if (!label || !value) return null;

  return {
    label,
    value,
    group: cleanText(field?.group, 80) || undefined,
  };
}

function cleanRecord(
  record: CheatingReportRecord,
): CheatingReportRecord | null {
  const title = cleanText(record?.title, 180);

  if (!title) return null;

  return {
    title,
    subtitle: cleanText(record?.subtitle, 220) || undefined,
    badge: cleanText(record?.badge, 80) || undefined,
    fields: Array.isArray(record?.fields)
      ? record.fields
          .slice(0, MAX_FIELDS_PER_RECORD)
          .map(cleanField)
          .filter((field): field is CheatingReportField => Boolean(field))
      : [],
  };
}

function cleanAnswer(
  answer: CheatingReportAnswer,
): CheatingReportAnswer | null {
  const question = cleanText(answer?.question, 240);
  const response = cleanText(answer?.answer, 240);

  if (!question || !response) return null;

  return { question, answer: response };
}

export function sanitizeCheatingReportPayload(
  input: CheatingReportPayload,
): CheatingReportPayload {
  const campaignId = cleanText(input?.campaignId, 24);
  const audience = input?.audience === "men" ? "men" : "women";
  const generatedAt = Number.isNaN(Date.parse(input?.generatedAt))
    ? new Date().toISOString()
    : new Date(input.generatedAt).toISOString();
  const records = Array.isArray(input?.records)
    ? input.records
        .slice(0, MAX_RECORDS)
        .map(cleanRecord)
        .filter((record): record is CheatingReportRecord => Boolean(record))
    : [];

  return {
    campaignId: campaignId || "REL-PHONE",
    audience,
    hook: cleanText(input?.hook, 240) || "Public connection report",
    searchedPhone: cleanText(input?.searchedPhone, 60) || "Not shown",
    generatedAt,
    answers: Array.isArray(input?.answers)
      ? input.answers
          .slice(0, MAX_ANSWERS)
          .map(cleanAnswer)
          .filter((answer): answer is CheatingReportAnswer => Boolean(answer))
      : [],
    records,
    totalCount: Math.max(
      records.length,
      Number.isFinite(input?.totalCount)
        ? Math.min(100_000, Math.max(0, Math.floor(input.totalCount)))
        : records.length,
    ),
    vaultId: cleanText(input?.vaultId, 64) || undefined,
  };
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;

    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate;

      continue;
    }

    if (line) lines.push(line);

    if (font.widthOfTextAtSize(word, size) <= maxWidth) {
      line = word;

      continue;
    }

    let fragment = "";

    for (const char of word) {
      const next = fragment + char;

      if (font.widthOfTextAtSize(next, size) > maxWidth && fragment) {
        lines.push(fragment);
        fragment = char;
      } else {
        fragment = next;
      }
    }

    line = fragment;
  }

  if (line) lines.push(line);

  return lines.length > 0 ? lines : [""];
}

export async function buildCheatingReportPdf(
  rawPayload: CheatingReportPayload,
) {
  const payload = sanitizeCheatingReportPayload(rawPayload);
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const mono = await pdf.embedFont(StandardFonts.Courier);
  const pageSize: [number, number] = [612, 792];
  const margin = 48;
  const contentWidth = pageSize[0] - margin * 2;
  let page: PDFPage;
  let y: number;

  pdf.setTitle(`Anya public connection report — ${payload.campaignId}`);
  pdf.setAuthor("Anya");
  pdf.setSubject("Public-source identity and connection report");
  pdf.setCreator("Anya");
  pdf.setProducer("Anya");
  pdf.setCreationDate(new Date(payload.generatedAt));

  const addPage = () => {
    page = pdf.addPage(pageSize);
    y = pageSize[1] - margin;
    page.drawText("ANYA", {
      x: margin,
      y,
      font: bold,
      size: 11,
      color: rgb(0.82, 0.89, 0.98),
    });
    page.drawText("PUBLIC CONNECTION REPORT", {
      x: pageSize[0] - margin - 176,
      y,
      font: mono,
      size: 8,
      color: rgb(0.44, 0.49, 0.57),
    });
    y -= 18;
    page.drawLine({
      start: { x: margin, y },
      end: { x: pageSize[0] - margin, y },
      thickness: 1,
      color: rgb(0.72, 0.8, 0.91),
    });
    y -= 28;
  };

  const ensureSpace = (height: number) => {
    if (y - height < margin + 24) addPage();
  };

  const drawWrapped = (
    text: string,
    opts: {
      font?: PDFFont;
      size?: number;
      color?: ReturnType<typeof rgb>;
      indent?: number;
      gapAfter?: number;
      lineHeight?: number;
    } = {},
  ) => {
    const font = opts.font ?? regular;
    const size = opts.size ?? 10;
    const indent = opts.indent ?? 0;
    const lineHeight = opts.lineHeight ?? size * 1.42;
    const lines = wrapText(text, font, size, contentWidth - indent);

    for (const line of lines) {
      ensureSpace(lineHeight + 2);
      page.drawText(line, {
        x: margin + indent,
        y,
        font,
        size,
        color: opts.color ?? rgb(0.12, 0.15, 0.19),
      });
      y -= lineHeight;
    }

    y -= opts.gapAfter ?? 0;
  };

  const drawSection = (label: string) => {
    ensureSpace(34);
    y -= 5;
    drawWrapped(label.toUpperCase(), {
      font: mono,
      size: 8,
      color: rgb(0.29, 0.42, 0.58),
      gapAfter: 8,
    });
  };

  addPage();
  drawWrapped(payload.hook, {
    font: bold,
    size: 22,
    lineHeight: 27,
    color: rgb(0.06, 0.08, 0.11),
    gapAfter: 10,
  });
  drawWrapped(
    `Campaign ${payload.campaignId}  •  Generated ${new Date(payload.generatedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}`,
    { font: mono, size: 8, color: rgb(0.4, 0.45, 0.52), gapAfter: 16 },
  );
  drawWrapped(`Searched number: ${payload.searchedPhone}`, {
    font: bold,
    size: 10,
    gapAfter: 4,
  });
  drawWrapped(
    `${payload.totalCount.toLocaleString()} public-source record${payload.totalCount === 1 ? "" : "s"} reported.`,
    { size: 10, gapAfter: 14 },
  );

  drawSection("What this report means");
  drawWrapped(
    "This report organizes public-source identity and connection signals. It cannot read private messages, identify who someone is currently speaking with, or prove infidelity. Treat each result as a lead to verify, not a verdict.",
    { size: 9.5, color: rgb(0.24, 0.28, 0.34), gapAfter: 12 },
  );

  if (payload.answers.length > 0) {
    drawSection("Your context");

    for (const answer of payload.answers) {
      drawWrapped(answer.question, { font: bold, size: 9, gapAfter: 2 });
      drawWrapped(answer.answer, {
        size: 9,
        color: rgb(0.29, 0.34, 0.4),
        indent: 10,
        gapAfter: 8,
      });
    }
  }

  drawSection("Public results");

  if (payload.records.length === 0) {
    drawWrapped(
      "No public-source records were returned for this search. That absence does not confirm or rule out any relationship or conversation.",
      { size: 10, gapAfter: 10 },
    );
  } else {
    payload.records.forEach((record, index) => {
      ensureSpace(76);
      page.drawRectangle({
        x: margin,
        y: y - 9,
        width: 3,
        height: 18,
        color: rgb(0.42, 0.6, 0.8),
      });
      drawWrapped(`${index + 1}. ${record.title}`, {
        font: bold,
        size: 11,
        indent: 12,
        gapAfter: 2,
      });

      if (record.subtitle) {
        drawWrapped(record.subtitle, {
          size: 8.5,
          color: rgb(0.39, 0.43, 0.49),
          indent: 12,
          gapAfter: 5,
        });
      }

      for (const field of record.fields) {
        drawWrapped(`${field.label}: ${field.value}`, {
          size: 8.5,
          color: rgb(0.18, 0.22, 0.27),
          indent: 12,
          gapAfter: 2,
        });
      }

      y -= 10;
    });
  }

  ensureSpace(80);
  drawSection("A grounded next step");
  drawWrapped(
    "Wanting clarity does not make you unreasonable. Review the source trail, separate what is verified from what is assumed, and give yourself time before deciding what the findings mean. If a conversation would put you at risk, prioritize your safety and speak with someone you trust.",
    { size: 9.5, color: rgb(0.24, 0.28, 0.34) },
  );

  return pdf.save();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function buildCheatingReportEmailHtml(
  rawPayload: CheatingReportPayload,
) {
  const payload = sanitizeCheatingReportPayload(rawPayload);

  return `
    <div style="margin:0;background:#07090d;padding:32px 16px;font-family:Arial,sans-serif;color:#f4f7fb">
      <div style="max-width:620px;margin:0 auto;border:1px solid #293442;background:#0d1118;padding:32px">
        <p style="margin:0 0 24px;color:#b8cce5;font-size:12px;letter-spacing:2px">ANYA / PUBLIC CONNECTION REPORT</p>
        <h1 style="margin:0 0 12px;font-size:28px;line-height:1.15">${escapeHtml(payload.hook)}</h1>
        <p style="margin:0 0 24px;color:#aeb7c4;line-height:1.6">Your private report is attached as a PDF. It contains ${payload.totalCount.toLocaleString()} public-source record${payload.totalCount === 1 ? "" : "s"} and the context you chose in the guided check.</p>
        <div style="border-left:3px solid #9ebde0;background:#111824;padding:16px 18px;margin:0 0 24px">
          <strong style="display:block;margin-bottom:6px">Keep the result in perspective</strong>
          <span style="color:#b8c0cb;line-height:1.55">Public records can add identity context. They cannot read private messages or prove a relationship. Review each source as a lead, not a verdict.</span>
        </div>
        <p style="margin:0;color:#b8c0cb;line-height:1.6">Wanting clarity does not make you unreasonable. Take your time, separate facts from assumptions, and prioritize your safety.</p>
        <p style="margin:28px 0 0;color:#697585;font-size:12px">Campaign ${escapeHtml(payload.campaignId)} · Generated ${escapeHtml(new Date(payload.generatedAt).toLocaleString("en-US"))}</p>
      </div>
    </div>
  `;
}
