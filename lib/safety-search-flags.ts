/**
 * Server-side heuristics for abuse/safety moderation.
 * Defensive only — flags concerning queries for staff review (esp. underage targeting).
 * Prefer precision over recall: skip pure IDs/emails/usernames without risk phrases.
 */

export type SafetyMatchRule = {
  id: string;
  label: string;
};

export type SafetyQueryAssessment = {
  flagged: boolean;
  category: "underage_risk";
  reasonCode: "underage_search";
  rules: SafetyMatchRule[];
  reason: string;
};

const DISCORD_SNOWFLAKE = /^\d{17,20}$/;
const EMAIL_ONLY = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_ONLY = /^\+?[\d\s().-]{7,20}$/;
const UUID_ONLY =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HANDLE_LIKE = /^@?[a-z0-9._-]{2,32}$/i;
const IP_ONLY =
  /^(?:\d{1,3}\.){3}\d{1,3}$|^(?:[0-9a-f]{1,4}:){2,7}[0-9a-f]{1,4}$/i;

const HARD_RISK_PATTERNS: Array<{ id: string; label: string; re: RegExp }> = [
  {
    id: "underage_word",
    label: "Explicit underage / minor wording",
    re: /\b(under[\s-]?age|underage|minor(?:s)?)\b/i,
  },
  {
    id: "csam_terms",
    label: "CSAM / child-exploitation terms",
    re: /\b(csam|child\s*porn(?:ography)?|pedo(?:phile|philia)?|paedo(?:phile|philia)?|hebephile|ephebophile)\b/i,
  },
  {
    id: "school_child_role",
    label: "Schoolchild / little-girl/boy role phrasing",
    re: /\b(school[\s-]?girl|school[\s-]?boy|little\s+girl|little\s+boy|baby\s+girl|baby\s+boy)\b/i,
  },
  {
    id: "child_kid_terms",
    label: "Child / kid targeting terms",
    re: /\b(child(?:ren)?|kid(?:s|do)?|toddler|infant|pre[\s-]?teen)\b/i,
  },
];

const AGE_UNDER_18_PATTERNS: Array<{ id: string; label: string; re: RegExp }> = [
  {
    id: "age_years_old",
    label: "Age stated under 18 (years old)",
    re: /\b(?:aged?\s*)?(?:1[0-7]|[1-9])\s*(?:yo|y\/o|yrs?\.?|years?\s*old)\b/i,
  },
  {
    id: "age_equals",
    label: "Age field under 18",
    re: /\bage\s*[:=]?\s*(?:1[0-7]|[1-9])\b/i,
  },
  {
    id: "age_of",
    label: "Age of under 18",
    re: /\bage\s+of\s+(?:1[0-7]|[1-9])\b/i,
  },
];

const TEEN_WITH_CONTEXT = /\bteens?(?:ager)?s?\b/i;
const CONCERNING_CONTEXT =
  /\b(nude|naked|porn|sex|sexual|dating|girlfriend|boyfriend|nudes?|onlyfans|escort|loli|shota)\b/i;

function looksLikeIdentifierOnly(query: string): boolean {
  const q = query.trim();
  if (!q) return true;
  if (DISCORD_SNOWFLAKE.test(q)) return true;
  if (EMAIL_ONLY.test(q)) return true;
  if (PHONE_ONLY.test(q) && !/[a-z]/i.test(q)) return true;
  if (UUID_ONLY.test(q)) return true;
  if (IP_ONLY.test(q)) return true;
  if (HANDLE_LIKE.test(q) && !/\s/.test(q)) return true;
  return false;
}

function stripModulePrefix(query: string): string {
  return query.replace(/^\[[^\]]+\]\s*/, "").trim();
}

/**
 * Assess whether a search query should create an underage-risk safety flag.
 * Silent by design — callers should not tip off the searching user at search time.
 */
export function assessSearchQueryForSafety(
  rawQuery: string,
): SafetyQueryAssessment {
  const query = stripModulePrefix(String(rawQuery ?? ""));
  const empty: SafetyQueryAssessment = {
    flagged: false,
    category: "underage_risk",
    reasonCode: "underage_search",
    rules: [],
    reason: "",
  };

  if (!query || looksLikeIdentifierOnly(query)) {
    return empty;
  }

  const rules: SafetyMatchRule[] = [];

  for (const pattern of HARD_RISK_PATTERNS) {
    if (pattern.re.test(query)) {
      rules.push({ id: pattern.id, label: pattern.label });
    }
  }

  for (const pattern of AGE_UNDER_18_PATTERNS) {
    if (pattern.re.test(query)) {
      rules.push({ id: pattern.id, label: pattern.label });
    }
  }

  if (TEEN_WITH_CONTEXT.test(query) && CONCERNING_CONTEXT.test(query)) {
    rules.push({
      id: "teen_sexual_context",
      label: "Teen + sexual/dating context",
    });
  }

  const unique = Array.from(
    new Map(rules.map((rule) => [rule.id, rule])).values(),
  );

  if (unique.length === 0) {
    return empty;
  }

  return {
    flagged: true,
    category: "underage_risk",
    reasonCode: "underage_search",
    rules: unique,
    reason: unique.map((rule) => rule.label).join("; "),
  };
}

/** Truncate query for staff queues — enough to review, avoid huge payloads. */
export function buildQueryPreview(rawQuery: string, maxLen = 240): string {
  const query = stripModulePrefix(String(rawQuery ?? "")).replace(/\s+/g, " ");
  if (query.length <= maxLen) return query;
  return `${query.slice(0, maxLen)}…`;
}

export const SAFETY_FLAG_STATUSES = ["open", "reviewing", "resolved"] as const;
export type SafetyFlagStatus = (typeof SAFETY_FLAG_STATUSES)[number];

export function isSafetyFlagStatus(value: string): value is SafetyFlagStatus {
  return SAFETY_FLAG_STATUSES.includes(value as SafetyFlagStatus);
}

export const SAFETY_FLAG_SOURCES = ["auto", "helper", "admin"] as const;
export type SafetyFlagSource = (typeof SAFETY_FLAG_SOURCES)[number];

export type HelperMessageHistoryEntry = {
  at: string;
  byId: number;
  byUsername: string;
  message: string;
};

export function parseHelperMessageHistory(
  raw: string | null | undefined,
): HelperMessageHistoryEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (entry): entry is HelperMessageHistoryEntry =>
          Boolean(entry) &&
          typeof entry === "object" &&
          typeof (entry as HelperMessageHistoryEntry).at === "string" &&
          typeof (entry as HelperMessageHistoryEntry).message === "string",
      )
      .map((entry) => ({
        at: entry.at,
        byId: typeof entry.byId === "number" ? entry.byId : 0,
        byUsername:
          typeof entry.byUsername === "string" ? entry.byUsername : "staff",
        message: String(entry.message).slice(0, 1000),
      }));
  } catch {
    return [];
  }
}
