import { cacheKey, getCached, setCached } from "@/lib/us-records/cache";
import { queryNeedle, scoreNameMatch } from "@/lib/us-records/name-match";
import {
  BROWSER_UA,
  paceSource,
  SOURCE_LIMITS,
} from "@/lib/us-records/robots-and-limits";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import type { ParsedPublicQuery, PersonHit } from "@/lib/us-records/types";

export function shouldSearchIlDoc(parsed: ParsedPublicQuery): boolean {
  if (parsed.country && parsed.country !== "US") return false;
  if (parsed.state && parsed.state !== "IL") return false;
  if (parsed.state === "IL") return true;
  return /\b(illinois|idoc)\b/i.test(parsed.raw);
}

/**
 * Illinois DOC Individual in Custody Search (legacy ASP twin).
 * Optional DOB search mode when dob is provided without a strong last name hit path.
 */
export async function searchIlDocInmate(
  parsed: ParsedPublicQuery,
  limit = 12,
): Promise<PersonHit[]> {
  const last = (parsed.lastName || "").trim();
  if (!last || last.length < 2) {
    throw new Error(
      "IL DOC inmate search needs a last name (e.g. John Smith, IL).",
    );
  }

  const key = cacheKey(
    "il-doc-v2",
    `${last}|${parsed.firstName || ""}|${parsed.dob || ""}|${limit}`,
  );
  const cached = getCached<PersonHit[]>(key);
  if (cached) return cached;

  await paceSource("il-doc", 800);

  const useDob = Boolean(parsed.dob && !parsed.firstName);
  const body = new URLSearchParams({
    selectlist1: useDob ? "BDAT" : "Last",
    idoc: useDob
      ? parsed.dob!.replace(/\//g, "-")
      : last.toUpperCase(),
    submit: "Submit Query",
  });

  const res = await fetchWithTimeout(
    "https://www.idoc.state.il.us/subsections/search/ISListInmates2.asp",
    {
      method: "POST",
      cache: "no-store",
      timeoutMs: SOURCE_LIMITS["il-doc"].timeoutMs,
      headers: {
        Accept: "text/html",
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": BROWSER_UA,
        Origin: "https://www.idoc.state.il.us",
        Referer:
          "https://www.idoc.state.il.us/subsections/search/ISdefault2.asp",
      },
      body: body.toString(),
    },
  );

  if (!res.ok) throw new Error(`IL DOC HTTP ${res.status}`);
  const html = await res.text();
  if (/Inmate NOT found/i.test(html)) {
    setCached(key, [], SOURCE_LIMITS["il-doc"].ttlMs);
    return [];
  }

  const needle = queryNeedle(parsed) || last;
  const retrievedAt = new Date().toISOString();
  const hits: PersonHit[] = [];

  for (const match of html.matchAll(/<OPTION[^>]*>([\s\S]*?)<\/OPTION>/gi)) {
    const plain = match[1]!
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const parts = plain.match(
      /^([A-Z0-9]+)\s*\|\s*(\d{2}-\d{2}-\d{4})\s*\|\s*(.+)$/i,
    );
    if (!parts) continue;
    const idoc = parts[1]!.trim();
    const dob = parts[2]!.trim();
    const name = parts[3]!.trim();
    const score = scoreNameMatch(name, needle);
    if (score < 40) continue;
    if (parsed.firstName) {
      const afterComma = name.split(",")[1] || name;
      if (
        !new RegExp(
          `\\b${parsed.firstName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
          "i",
        ).test(afterComma)
      ) {
        continue;
      }
    }
    hits.push({
      id: `il-doc-${idoc}`,
      name,
      kind: "inmate",
      subtitle: `IDOC ${idoc} · DOB ${dob}`,
      state: "IL",
      country: "US",
      details: [
        { label: "IDOC #", value: idoc },
        { label: "DOB", value: dob },
        { label: "Match score", value: String(score) },
      ],
      source: {
        id: "il-doc",
        label: "Illinois DOC Inmate Search",
        jurisdiction: "Illinois",
        retrievedAt,
        deepLink: "https://idoc.illinois.gov/offender/inmatesearch.html",
        confidence: (score >= 70 ? "high" : "medium") as "high" | "medium",
      },
    });
    if (hits.length >= limit) break;
  }

  hits.sort(
    (a, b) =>
      Number(b.details.find((d) => d.label === "Match score")?.value || 0) -
      Number(a.details.find((d) => d.label === "Match score")?.value || 0),
  );

  setCached(key, hits, SOURCE_LIMITS["il-doc"].ttlMs);
  return hits;
}
