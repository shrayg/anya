import type { ParsedUsQuery, PersonHit } from "@/lib/us-records/types";

import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { cacheKey, getCached, setCached } from "@/lib/us-records/cache";
import {
  BROWSER_UA,
  paceSource,
  SOURCE_LIMITS,
} from "@/lib/us-records/robots-and-limits";

type BopInmate = {
  nameLast?: string;
  nameFirst?: string;
  nameMiddle?: string;
  sex?: string;
  race?: string;
  age?: string;
  inmateNum?: string;
  faclName?: string;
  faclType?: string;
  projRelDate?: string;
  actRelDate?: string;
  releaseCode?: string;
};

type BopResponse = {
  Captcha?: boolean;
  InmateLocator?: BopInmate[];
};

function requireName(parsed: ParsedUsQuery): { first: string; last: string } {
  if (parsed.firstName && parsed.lastName) {
    return { first: parsed.firstName, last: parsed.lastName };
  }
  throw new Error(
    "Enter a first and last name for BOP inmate search (e.g. John Smith).",
  );
}

export function shouldSearchBop(parsed: ParsedUsQuery): boolean {
  if (parsed.country && parsed.country !== "US") return false;

  return Boolean(parsed.firstName && parsed.lastName);
}

export async function searchBopInmateLocator(
  parsed: ParsedUsQuery,
  limit = 15,
): Promise<PersonHit[]> {
  const { first, last } = requireName(parsed);
  const key = cacheKey("bop-inmate", `${last}|${first}|${limit}`);
  const cached = getCached<PersonHit[]>(key);

  if (cached) return cached;

  await paceSource("bop-inmate", 800);

  const url =
    "https://www.bop.gov/PublicInfo/execute/inmateloc?" +
    new URLSearchParams({
      todo: "query",
      output: "json",
      inmateNum: "",
      inmateNumType: "IRN",
      nameFirst: first,
      nameMiddle: "",
      nameLast: last,
      age: "",
      race: "",
      sex: "",
    }).toString();

  const res = await fetchWithTimeout(url, {
    method: "GET",
    cache: "no-store",
    timeoutMs: SOURCE_LIMITS["bop-inmate"].timeoutMs,
    headers: {
      Accept: "application/json",
      "User-Agent": BROWSER_UA,
      Referer: "https://www.bop.gov/inmateloc/",
    },
  });

  if (!res.ok) {
    throw new Error(`BOP Inmate Locator HTTP ${res.status}`);
  }

  const body = (await res.json()) as BopResponse;

  if (body.Captcha) {
    throw new Error("BOP Inmate Locator requested CAPTCHA for this query.");
  }

  const retrievedAt = new Date().toISOString();
  const hits: PersonHit[] = (body.InmateLocator ?? [])
    .slice(0, limit)
    .map((row, index) => {
      const name = [row.nameFirst, row.nameMiddle, row.nameLast]
        .filter(Boolean)
        .join(" ");
      const release =
        row.actRelDate ||
        row.projRelDate ||
        (row.releaseCode === "R" ? "Released" : undefined);

      return {
        id: `bop-${row.inmateNum || index}`,
        name,
        kind: "inmate" as const,
        subtitle: row.faclName
          ? `${row.faclType || "Facility"} · ${row.faclName}`
          : "Federal BOP record",
        country: "US",
        details: [
          row.inmateNum
            ? { label: "Register number", value: row.inmateNum }
            : null,
          row.age ? { label: "Age", value: row.age } : null,
          row.sex ? { label: "Sex", value: row.sex } : null,
          row.race ? { label: "Race", value: row.race } : null,
          release ? { label: "Release", value: release } : null,
        ].filter(Boolean) as Array<{ label: string; value: string }>,
        source: {
          id: "bop-inmate",
          label: "BOP Inmate Locator",
          jurisdiction: "United States — Federal Bureau of Prisons",
          retrievedAt,
          deepLink: "https://www.bop.gov/inmateloc/",
          confidence: "high",
        },
      };
    });

  setCached(key, hits, SOURCE_LIMITS["bop-inmate"].ttlMs);

  return hits;
}
