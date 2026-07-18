import { fetchCordCatQuery } from "@/lib/cordcat";
import {
  formatDsaDate,
  type DiscordDsaSanction,
} from "@/lib/discord-profile";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";

export { formatDsaDate };

const DSA_LOOKUP_BASE = "https://dsa.discord.food/api";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function firstString(
  record: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (Array.isArray(value)) {
      const hit = value.find(
        (entry) => typeof entry === "string" && entry.trim(),
      );
      if (typeof hit === "string") return hit.trim();
    }
  }
  return null;
}

function humanizeToken(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase())
    .trim();
}

function formatDecisionStatus(raw: string | null): string {
  if (!raw) return "Action taken";
  const cleaned = raw.replace(/^DECISION_/i, "").replace(/_/g, " ").trim();
  return humanizeToken(cleaned);
}

function formatSeverity(raw: string | null): string {
  if (!raw) return "Moderation";
  return humanizeToken(raw.replace(/^CATEGORY_/i, ""));
}

function parseSanction(
  entry: unknown,
  index: number,
): DiscordDsaSanction | null {
  const record = asRecord(entry);
  if (!record) return null;

  const id =
    firstString(record, ["uuid", "id", "puid", "platformUid", "platform_uid"]) ??
    `dsa-${index}`;

  const severity = formatSeverity(
    firstString(record, [
      "category",
      "severity",
      "categorySpecification",
      "type",
    ]),
  );

  const status = formatDecisionStatus(
    firstString(record, [
      "decisionAccount",
      "decision_account",
      "decisionProvision",
      "decision_provision",
      "decisionVisibility",
      "status",
      "type",
    ]),
  );

  const description =
    firstString(record, [
      "incompatibleContentExplanation",
      "incompatible_content_explanation",
      "illegalContentExplanation",
      "illegal_content_explanation",
      "decisionFacts",
      "decision_facts",
      "description",
      "reason",
      "explanation",
    ]) ?? "Enforcement action recorded in the EU DSA transparency database.";

  const date =
    firstString(record, [
      "applicationDate",
      "application_date",
      "contentDate",
      "content_date",
      "createdAt",
      "created_at",
      "date",
    ]) ?? new Date(0).toISOString();

  return {
    id,
    severity,
    status,
    description,
    date,
    details: record,
  };
}

function parseStatementList(value: unknown): DiscordDsaSanction[] {
  const list = Array.isArray(value)
    ? value
    : Array.isArray(asRecord(value)?.actions)
      ? (asRecord(value)!.actions as unknown[])
      : Array.isArray(asRecord(value)?.statements)
        ? (asRecord(value)!.statements as unknown[])
        : Array.isArray(asRecord(value)?.data)
          ? (asRecord(value)!.data as unknown[])
          : [];

  const out: DiscordDsaSanction[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < list.length; i += 1) {
    const sanction = parseSanction(list[i], i);
    if (!sanction) continue;
    if (seen.has(sanction.id)) continue;
    seen.add(sanction.id);
    out.push(sanction);
  }

  return out;
}

export function parseDiscordDsaFromStatements(
  statements: unknown,
): DiscordDsaSanction[] {
  return parseStatementList(statements);
}

export async function fetchPublicDsaSanctions(
  discordId: string,
): Promise<DiscordDsaSanction[]> {
  try {
    const url = new URL(`${DSA_LOOKUP_BASE}/search`);
    url.searchParams.set("parsedId", discordId);
    url.searchParams.set("limit", "20");
    url.searchParams.set("includeTotalCount", "true");

    const res = await fetchWithTimeout(url.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": "Anya.Int/1.0 (+https://anyaint.com)",
      },
      cache: "no-store",
      timeoutMs: 12_000,
    });

    if (!res.ok) return [];

    const payload = (await res.json()) as unknown;
    return parseStatementList(payload);
  } catch {
    return [];
  }
}

/** Resolve DSA sanctions for a Discord user — CordCat statements first, public lookup fallback. */
export async function fetchDiscordDsaSanctions(
  discordId: string,
): Promise<{ count: number; sanctions: DiscordDsaSanction[] }> {
  const cordQuery = await fetchCordCatQuery(discordId).catch(() => null);
  const fromCord = parseStatementList(cordQuery?.statements);

  if (fromCord.length > 0) {
    return { count: fromCord.length, sanctions: fromCord };
  }

  const fromPublic = await fetchPublicDsaSanctions(discordId);
  return { count: fromPublic.length, sanctions: fromPublic };
}
