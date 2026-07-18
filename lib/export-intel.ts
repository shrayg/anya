import { siteConfig } from "@/config/site";
import type { CombCredential } from "@/lib/proxynova-comb";
import {
  sanitizePublicContent,
  sanitizePublicText,
} from "@/lib/public-branding";
import type { FormattedRecord } from "@/lib/search-utils";

const BRAND = siteConfig.name;

export type ExportFormat = "json" | "jsonl" | "csv" | "txt" | "html";

export const EXPORT_FORMATS: readonly ExportFormat[] = [
  "json",
  "jsonl",
  "csv",
  "txt",
  "html",
] as const;

export const EXPORT_FORMAT_LABELS: Record<ExportFormat, string> = {
  json: "Export as JSON",
  jsonl: "Export as JSONL",
  csv: "Export as CSV",
  txt: "Export as TXT",
  html: "Export as HTML",
};

export function wrapBrandedExport(body: string, label?: string) {
  const divider = "=".repeat(BRAND.length);
  const lines = [BRAND, divider];

  if (label?.trim()) {
    lines.push(label.trim(), "");
  }

  lines.push(body.trim(), "", "---", `searched with ${BRAND}`);

  return lines.join("\n");
}

export function formatRecordAsText(record: FormattedRecord) {
  const title = sanitizePublicText(record.title);
  const lines = [`#${record.index} · ${title}`];

  if (record.subtitle) {
    const subtitle = sanitizePublicText(record.subtitle);
    if (subtitle) lines.push(subtitle);
  }

  if (record.badge && record.badge !== record.title) {
    const badge = sanitizePublicText(record.badge);
    if (badge) lines.push(`Collection: ${badge}`);
  }

  lines.push("");

  for (const field of record.fields) {
    const value = sanitizePublicText(field.value);
    if (!value) continue;
    lines.push(`${sanitizePublicText(field.label) || field.label}: ${value}`);
  }

  return lines.join("\n");
}

export function formatRecordsAsText(records: FormattedRecord[]) {
  return records.map((record) => formatRecordAsText(record)).join("\n\n---\n\n");
}

export function formatBreachCredentialAsText(row: CombCredential, index: number) {
  const lines = [
    `#${index} · Leaked credential`,
    "",
    `Email / login: ${sanitizePublicText(row.identifier)}`,
  ];

  if (row.secret) {
    lines.push(`Password: ${sanitizePublicText(row.secret)}`);
  }

  if (row.raw) {
    const raw = sanitizePublicText(row.raw);
    if (raw) lines.push(`Raw: ${raw}`);
  }

  return lines.join("\n");
}

export function escapeCsvCell(value: unknown): string {
  const str = value == null ? "" : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function recordToPlainObject(record: FormattedRecord) {
  return {
    index: record.index,
    title: sanitizePublicText(record.title),
    subtitle: record.subtitle ? sanitizePublicText(record.subtitle) || null : null,
    collection: record.badge ? sanitizePublicText(record.badge) || null : null,
    fields: Object.fromEntries(
      record.fields
        .map((field) => [field.key, sanitizePublicText(field.value)])
        .filter(([, value]) => Boolean(value)),
    ),
  };
}

function credentialToPlainObject(row: CombCredential, index: number) {
  return {
    index,
    identifier: sanitizePublicText(row.identifier),
    secret: row.secret ? sanitizePublicText(row.secret) || null : null,
    raw: row.raw ? sanitizePublicText(row.raw) || null : null,
  };
}

export function formatRecordsAsJson(records: FormattedRecord[]) {
  return JSON.stringify(records.map(recordToPlainObject), null, 2);
}

export function formatRecordAsJson(record: FormattedRecord) {
  return JSON.stringify(recordToPlainObject(record), null, 2);
}

export function formatRecordsAsJsonl(records: FormattedRecord[]) {
  return records.map((record) => JSON.stringify(recordToPlainObject(record))).join("\n");
}

export function formatRecordAsJsonl(record: FormattedRecord) {
  return JSON.stringify(recordToPlainObject(record));
}

export function formatRecordsAsCsv(records: FormattedRecord[]) {
  const fieldKeys = new Map<string, string>();

  for (const record of records) {
    for (const field of record.fields) {
      if (!fieldKeys.has(field.key)) {
        fieldKeys.set(field.key, field.label);
      }
    }
  }

  const keys = [...fieldKeys.keys()];
  const headers = [
    "index",
    "title",
    "subtitle",
    "collection",
    ...keys.map((key) => fieldKeys.get(key)!),
  ];
  const rows = records.map((record) => {
    const byKey = Object.fromEntries(
      record.fields.map((field) => [field.key, sanitizePublicText(field.value)]),
    );
    return [
      record.index,
      sanitizePublicText(record.title),
      record.subtitle ? sanitizePublicText(record.subtitle) : "",
      record.badge ? sanitizePublicText(record.badge) : "",
      ...keys.map((key) => byKey[key] ?? ""),
    ]
      .map(escapeCsvCell)
      .join(",");
  });

  return ["\uFEFF" + headers.map(escapeCsvCell).join(","), ...rows].join("\n");
}

export function formatRecordAsCsv(record: FormattedRecord) {
  return formatRecordsAsCsv([record]);
}

function wrapHtmlDocument(title: string, body: string, label?: string) {
  const heading = escapeHtml(label?.trim() || title);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; font-family: ui-sans-serif, system-ui, sans-serif; background: #0a0a0b; color: #e4e4e7; line-height: 1.5; }
  main { max-width: 56rem; margin: 0 auto; padding: 2rem 1.25rem 3rem; }
  h1 { font-size: 1.15rem; font-weight: 600; color: #f0a4b8; margin: 0 0 0.35rem; }
  .meta { color: #a1a1aa; font-size: 0.875rem; margin-bottom: 1.5rem; }
  article { border: 1px solid rgba(255,255,255,0.1); border-radius: 0.75rem; padding: 1rem 1.1rem; margin-bottom: 0.85rem; background: rgba(255,255,255,0.03); }
  h2 { margin: 0 0 0.25rem; font-size: 0.95rem; color: #fafafa; }
  .sub { color: #a1a1aa; font-size: 0.8rem; margin-bottom: 0.75rem; }
  dl { margin: 0; display: grid; gap: 0.45rem; }
  dt { color: #71717a; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.06em; }
  dd { margin: 0; color: #e4e4e7; font-family: ui-monospace, monospace; font-size: 0.82rem; white-space: pre-wrap; word-break: break-word; }
  table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
  th, td { border: 1px solid rgba(255,255,255,0.1); padding: 0.45rem 0.55rem; text-align: left; vertical-align: top; }
  th { background: rgba(255,255,255,0.05); color: #a1a1aa; font-weight: 500; }
  pre { white-space: pre-wrap; word-break: break-word; font-family: ui-monospace, monospace; font-size: 0.82rem; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 0.6rem; padding: 1rem; }
  footer { margin-top: 2rem; color: #71717a; font-size: 0.75rem; }
</style>
</head>
<body>
<main>
  <h1>${escapeHtml(BRAND)}</h1>
  <p class="meta">${heading}</p>
  ${body}
  <footer>searched with ${escapeHtml(BRAND)}</footer>
</main>
</body>
</html>`;
}

export function formatRecordsAsHtml(records: FormattedRecord[], label?: string) {
  const body = records
    .map((record) => {
      const fields = record.fields
        .map((field) => {
          const value = sanitizePublicText(field.value);
          if (!value) return "";
          return `<div><dt>${escapeHtml(sanitizePublicText(field.label) || field.label)}</dt><dd>${escapeHtml(value)}</dd></div>`;
        })
        .join("");
      const sub = [
        record.subtitle ? sanitizePublicText(record.subtitle) : "",
        record.badge ? sanitizePublicText(record.badge) : "",
      ]
        .filter(Boolean)
        .join(" · ");
      return `<article>
  <h2>#${escapeHtml(record.index)} · ${escapeHtml(sanitizePublicText(record.title))}</h2>
  ${sub ? `<p class="sub">${escapeHtml(sub)}</p>` : ""}
  <dl>${fields}</dl>
</article>`;
    })
    .join("\n");

  return wrapHtmlDocument(label || "Export", body, label);
}

export function formatRecordAsHtml(record: FormattedRecord, label?: string) {
  return formatRecordsAsHtml([record], label);
}

export function formatBreachCredentialsAsJson(rows: CombCredential[]) {
  return JSON.stringify(
    rows.map((row, index) => credentialToPlainObject(row, index + 1)),
    null,
    2,
  );
}

export function formatBreachCredentialAsJson(row: CombCredential, index: number) {
  return JSON.stringify(credentialToPlainObject(row, index), null, 2);
}

export function formatBreachCredentialsAsJsonl(rows: CombCredential[]) {
  return rows
    .map((row, index) => JSON.stringify(credentialToPlainObject(row, index + 1)))
    .join("\n");
}

export function formatBreachCredentialAsJsonl(row: CombCredential, index: number) {
  return JSON.stringify(credentialToPlainObject(row, index));
}

export function formatBreachCredentialsAsCsv(rows: CombCredential[]) {
  const headers = ["index", "identifier", "secret", "raw"];
  const body = rows.map((row, index) =>
    [
      index + 1,
      sanitizePublicText(row.identifier),
      row.secret ? sanitizePublicText(row.secret) : "",
      row.raw ? sanitizePublicText(row.raw) : "",
    ]
      .map(escapeCsvCell)
      .join(","),
  );

  return ["\uFEFF" + headers.map(escapeCsvCell).join(","), ...body].join("\n");
}

export function formatBreachCredentialAsCsv(row: CombCredential, index: number) {
  const headers = ["index", "identifier", "secret", "raw"];
  const line = [
    index,
    sanitizePublicText(row.identifier),
    row.secret ? sanitizePublicText(row.secret) : "",
    row.raw ? sanitizePublicText(row.raw) : "",
  ]
    .map(escapeCsvCell)
    .join(",");

  return ["\uFEFF" + headers.map(escapeCsvCell).join(","), line].join("\n");
}

export function formatBreachCredentialsAsHtml(rows: CombCredential[], label?: string) {
  const body = rows
    .map((row, index) => {
      const fields = [
        ["Email / login", sanitizePublicText(row.identifier)],
        row.secret ? ["Password", sanitizePublicText(row.secret)] : null,
        row.raw ? ["Raw", sanitizePublicText(row.raw)] : null,
      ]
        .filter(Boolean)
        .map(
          (pair) =>
            `<div><dt>${escapeHtml((pair as string[])[0])}</dt><dd>${escapeHtml((pair as string[])[1])}</dd></div>`,
        )
        .join("");

      return `<article>
  <h2>#${index + 1} · Leaked credential</h2>
  <dl>${fields}</dl>
</article>`;
    })
    .join("\n");

  return wrapHtmlDocument(label || "Export", body, label);
}

export function formatBreachCredentialAsHtml(
  row: CombCredential,
  index: number,
  label?: string,
) {
  const fields = [
    ["Email / login", sanitizePublicText(row.identifier)],
    row.secret ? ["Password", sanitizePublicText(row.secret)] : null,
    row.raw ? ["Raw", sanitizePublicText(row.raw)] : null,
  ]
    .filter(Boolean)
    .map(
      (pair) =>
        `<div><dt>${escapeHtml((pair as string[])[0])}</dt><dd>${escapeHtml((pair as string[])[1])}</dd></div>`,
    )
    .join("");

  const body = `<article>
  <h2>#${escapeHtml(index)} · Leaked credential</h2>
  <dl>${fields}</dl>
</article>`;

  return wrapHtmlDocument(label || "Export", body, label);
}

function flattenObject(
  value: unknown,
  prefix = "",
  out: Record<string, string> = {},
): Record<string, string> {
  if (value == null || typeof value !== "object") {
    out[prefix || "value"] = value == null ? "" : String(value);
    return out;
  }

  if (Array.isArray(value)) {
    out[prefix || "value"] = JSON.stringify(value);
    return out;
  }

  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    if (nested != null && typeof nested === "object" && !Array.isArray(nested)) {
      flattenObject(nested, nextKey, out);
    } else if (Array.isArray(nested)) {
      out[nextKey] = JSON.stringify(nested);
    } else {
      out[nextKey] = nested == null ? "" : String(nested);
    }
  }

  return out;
}

function normalizeToRowObjects(data: unknown): Record<string, string>[] {
  if (Array.isArray(data)) {
    return data.map((item) => flattenObject(item));
  }

  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;

    for (const key of [
      "results",
      "credentials",
      "findings",
      "records",
      "banks",
      "providers",
      "cases",
      "hits",
    ]) {
      if (Array.isArray(obj[key]) && (obj[key] as unknown[]).length > 0) {
        return (obj[key] as unknown[]).map((item) => flattenObject(item));
      }
    }

    return [flattenObject(obj)];
  }

  return [{ value: data == null ? "" : String(data) }];
}

export function formatJsonValueAsCsv(data: unknown): string {
  const rows = normalizeToRowObjects(data);
  if (rows.length === 0) {
    return "\uFEFFvalue\n";
  }

  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const lines = rows.map((row) =>
    headers.map((header) => escapeCsvCell(row[header] ?? "")).join(","),
  );

  return ["\uFEFF" + headers.map(escapeCsvCell).join(","), ...lines].join("\n");
}

export function formatJsonValueAsJsonl(data: unknown): string {
  if (Array.isArray(data)) {
    return data.map((item) => JSON.stringify(item)).join("\n");
  }

  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    for (const key of ["results", "credentials", "findings", "records"]) {
      if (Array.isArray(obj[key])) {
        return (obj[key] as unknown[]).map((item) => JSON.stringify(item)).join("\n");
      }
    }
  }

  return JSON.stringify(data);
}

export function formatJsonValueAsHtml(data: unknown, label?: string): string {
  const rows = normalizeToRowObjects(data);
  if (rows.length === 0) {
    return wrapHtmlDocument(
      label || "Export",
      `<pre>${escapeHtml(JSON.stringify(data, null, 2))}</pre>`,
      label,
    );
  }

  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const thead = `<tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>`;
  const tbody = rows
    .map(
      (row) =>
        `<tr>${headers.map((header) => `<td>${escapeHtml(row[header] ?? "")}</td>`).join("")}</tr>`,
    )
    .join("");

  return wrapHtmlDocument(
    label || "Export",
    `<table><thead>${thead}</thead><tbody>${tbody}</tbody></table>`,
    label,
  );
}

export function formatRawAsExport(raw: string, format: ExportFormat, label?: string) {
  if (format === "txt") {
    return wrapBrandedExport(raw, label);
  }

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }

  if (format === "json") {
    if (parsed !== null) {
      return JSON.stringify(parsed, null, 2);
    }
    return JSON.stringify({ content: raw }, null, 2);
  }

  if (format === "jsonl") {
    if (parsed !== null) {
      return formatJsonValueAsJsonl(parsed);
    }
    return JSON.stringify({ content: raw });
  }

  if (format === "csv") {
    if (parsed !== null) {
      return formatJsonValueAsCsv(parsed);
    }
    return ["\uFEFFcontent", escapeCsvCell(raw)].join("\n");
  }

  // html
  if (parsed !== null) {
    return formatJsonValueAsHtml(parsed, label);
  }

  return wrapHtmlDocument(
    label || "Export",
    `<pre>${escapeHtml(raw)}</pre>`,
    label,
  );
}

export function formatRecordsAsExport(
  records: FormattedRecord[],
  format: ExportFormat,
  label?: string,
) {
  let body: string;
  switch (format) {
    case "txt":
      body = wrapBrandedExport(formatRecordsAsText(records), label);
      break;
    case "json":
      body = formatRecordsAsJson(records);
      break;
    case "jsonl":
      body = formatRecordsAsJsonl(records);
      break;
    case "csv":
      body = formatRecordsAsCsv(records);
      break;
    case "html":
      body = formatRecordsAsHtml(records, label);
      break;
  }
  return sanitizePublicContent(body);
}

export function formatRecordAsExport(
  record: FormattedRecord,
  format: ExportFormat,
  label?: string,
) {
  let body: string;
  switch (format) {
    case "txt":
      body = wrapBrandedExport(formatRecordAsText(record), label);
      break;
    case "json":
      body = formatRecordAsJson(record);
      break;
    case "jsonl":
      body = formatRecordAsJsonl(record);
      break;
    case "csv":
      body = formatRecordAsCsv(record);
      break;
    case "html":
      body = formatRecordAsHtml(record, label);
      break;
  }
  return sanitizePublicContent(body);
}

export function formatBreachCredentialsAsExport(
  rows: CombCredential[],
  format: ExportFormat,
  label?: string,
) {
  let body: string;
  switch (format) {
    case "txt":
      body = wrapBrandedExport(
        rows
          .map((row, index) => formatBreachCredentialAsText(row, index + 1))
          .join("\n\n---\n\n"),
        label,
      );
      break;
    case "json":
      body = formatBreachCredentialsAsJson(rows);
      break;
    case "jsonl":
      body = formatBreachCredentialsAsJsonl(rows);
      break;
    case "csv":
      body = formatBreachCredentialsAsCsv(rows);
      break;
    case "html":
      body = formatBreachCredentialsAsHtml(rows, label);
      break;
  }
  return sanitizePublicContent(body);
}

export function formatBreachCredentialAsExport(
  row: CombCredential,
  index: number,
  format: ExportFormat,
  label?: string,
) {
  let body: string;
  switch (format) {
    case "txt":
      body = wrapBrandedExport(formatBreachCredentialAsText(row, index), label);
      break;
    case "json":
      body = formatBreachCredentialAsJson(row, index);
      break;
    case "jsonl":
      body = formatBreachCredentialAsJsonl(row, index);
      break;
    case "csv":
      body = formatBreachCredentialAsCsv(row, index);
      break;
    case "html":
      body = formatBreachCredentialAsHtml(row, index, label);
      break;
  }
  return sanitizePublicContent(body);
}

export function safeExportFilename(label: string, format: ExportFormat = "txt") {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  const stamp = new Date().toISOString().slice(0, 10);

  return `${slug || "export"}-${stamp}.${format}`;
}

const EXPORT_MIME: Record<ExportFormat, string> = {
  json: "application/json;charset=utf-8",
  jsonl: "application/x-ndjson;charset=utf-8",
  csv: "text/csv;charset=utf-8",
  txt: "text/plain;charset=utf-8",
  html: "text/html;charset=utf-8",
};

export function downloadTextFile(filename: string, content: string) {
  downloadExportFile(filename, content, "txt");
}

export function downloadExportFile(
  filename: string,
  content: string,
  format: ExportFormat,
) {
  const blob = new Blob([content], { type: EXPORT_MIME[format] });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
