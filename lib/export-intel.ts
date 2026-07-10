import { siteConfig } from "@/config/site";
import type { CombCredential } from "@/lib/proxynova-comb";
import type { FormattedRecord } from "@/lib/search-utils";

const BRAND = siteConfig.name;

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
  const lines = [`#${record.index} · ${record.title}`];

  if (record.subtitle) {
    lines.push(record.subtitle);
  }

  if (record.badge && record.badge !== record.title) {
    lines.push(`Source: ${record.badge}`);
  }

  lines.push("");

  for (const field of record.fields) {
    lines.push(`${field.label}: ${field.value}`);
  }

  return lines.join("\n");
}

export function formatRecordsAsText(records: FormattedRecord[]) {
  return records.map((record) => formatRecordAsText(record)).join("\n\n---\n\n");
}

export function formatBreachCredentialAsText(row: CombCredential, index: number) {
  const lines = [`#${index} · Leaked credential`, "", `Email / login: ${row.identifier}`];

  if (row.secret) {
    lines.push(`Password: ${row.secret}`);
  }

  if (row.raw) {
    lines.push(`Raw: ${row.raw}`);
  }

  return lines.join("\n");
}

export function safeExportFilename(label: string) {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  const stamp = new Date().toISOString().slice(0, 10);

  return `anya-intel-${slug || "export"}-${stamp}.txt`;
}

export function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
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
