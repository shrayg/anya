import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { cacheKey, getCached, setCached } from "@/lib/us-records/cache";
import { paceSource, SOURCE_LIMITS } from "@/lib/us-records/robots-and-limits";
import type { CourtCaseHit, ParsedUsQuery } from "@/lib/us-records/types";

const BASE = "https://eapps.courts.state.va.us";
const API = `${BASE}/ocis-rest/api/public`;
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

type OcisSearchRow = {
  qualifiedFips?: string;
  courtLevel?: string;
  divisionType?: string;
  caseNumber?: string;
  formattedCaseNumber?: string;
  name?: string;
  offenseDate?: string;
  chargeAmended?: boolean;
  codeSection?: string;
  chargeDesc?: string;
  caseType?: string;
  hearingDate?: string;
};

type OcisApiEntity<T> = {
  status?: string;
  payload?: T;
  messages?: Array<{ messageCode?: string; message?: string }>;
};

type OcisApiEnvelope<T> = {
  context?: { entity?: OcisApiEntity<T> };
  entity?: OcisApiEntity<T>;
};

type OcisSearchPayload = {
  noOfRecords?: number;
  searchResults?: OcisSearchRow[];
};

const VA_FIPS_COUNTY: Record<string, string> = {
  "001": "Accomack County",
  "003": "Albemarle County",
  "005": "Alleghany County",
  "007": "Amelia County",
  "009": "Amherst County",
  "011": "Appomattox County",
  "013": "Arlington County",
  "015": "Augusta County",
  "017": "Bath County",
  "019": "Bedford County",
  "021": "Bland County",
  "023": "Botetourt County",
  "025": "Brunswick County",
  "027": "Buchanan County",
  "029": "Buckingham County",
  "031": "Campbell County",
  "033": "Caroline County",
  "035": "Carroll County",
  "036": "Charles City County",
  "037": "Charlotte County",
  "041": "Chesterfield County",
  "043": "Clarke County",
  "045": "Craig County",
  "047": "Culpeper County",
  "049": "Cumberland County",
  "051": "Dickenson County",
  "053": "Dinwiddie County",
  "057": "Essex County",
  "059": "Fairfax County",
  "061": "Fauquier County",
  "063": "Floyd County",
  "065": "Fluvanna County",
  "067": "Franklin County",
  "069": "Frederick County",
  "071": "Giles County",
  "073": "Gloucester County",
  "075": "Goochland County",
  "077": "Grayson County",
  "079": "Greene County",
  "081": "Greensville County",
  "083": "Halifax County",
  "085": "Hanover County",
  "087": "Henrico County",
  "089": "Henry County",
  "091": "Highland County",
  "093": "Isle of Wight County",
  "095": "James City County",
  "097": "King and Queen County",
  "099": "King George County",
  "101": "King William County",
  "103": "Lancaster County",
  "105": "Lee County",
  "107": "Loudoun County",
  "109": "Louisa County",
  "111": "Lunenburg County",
  "113": "Madison County",
  "115": "Mathews County",
  "117": "Mecklenburg County",
  "119": "Middlesex County",
  "121": "Montgomery County",
  "125": "Nelson County",
  "127": "New Kent County",
  "131": "Northampton County",
  "133": "Northumberland County",
  "135": "Nottoway County",
  "137": "Orange County",
  "139": "Page County",
  "141": "Patrick County",
  "143": "Pittsylvania County",
  "145": "Powhatan County",
  "147": "Prince Edward County",
  "149": "Prince George County",
  "153": "Prince William County",
  "155": "Pulaski County",
  "157": "Rappahannock County",
  "159": "Richmond County",
  "161": "Roanoke County",
  "163": "Rockbridge County",
  "165": "Rockingham County",
  "167": "Russell County",
  "169": "Scott County",
  "171": "Shenandoah County",
  "173": "Smyth County",
  "175": "Southampton County",
  "177": "Spotsylvania County",
  "179": "Stafford County",
  "181": "Surry County",
  "183": "Sussex County",
  "185": "Tazewell County",
  "187": "Warren County",
  "191": "Washington County",
  "193": "Westmoreland County",
  "195": "Wise County",
  "197": "Wythe County",
  "199": "York County",
  "510": "Alexandria City",
  "520": "Bristol City",
  "530": "Buena Vista City",
  "540": "Charlottesville City",
  "550": "Chesapeake City",
  "570": "Colonial Heights City",
  "580": "Covington City",
  "590": "Danville City",
  "595": "Emporia City",
  "600": "Fairfax City",
  "610": "Falls Church City",
  "620": "Franklin City",
  "630": "Fredericksburg City",
  "640": "Galax City",
  "650": "Hampton City",
  "660": "Harrisonburg City",
  "670": "Hopewell City",
  "678": "Lexington City",
  "680": "Lynchburg City",
  "683": "Manassas City",
  "685": "Manassas Park City",
  "690": "Martinsville City",
  "700": "Newport News City",
  "710": "Norfolk City",
  "720": "Norton City",
  "730": "Petersburg City",
  "735": "Poquoson City",
  "740": "Portsmouth City",
  "750": "Radford City",
  "760": "Richmond City",
  "770": "Roanoke City",
  "775": "Salem City",
  "790": "Staunton City",
  "800": "Suffolk City",
  "810": "Virginia Beach City",
  "820": "Waynesboro City",
  "830": "Williamsburg City",
  "840": "Winchester City",
};

function readSetCookies(headers: Headers): string[] {
  const withGetter = headers as Headers & { getSetCookie?: () => string[] };
  if (typeof withGetter.getSetCookie === "function") {
    return withGetter.getSetCookie();
  }
  const single = headers.get("set-cookie");
  return single ? [single] : [];
}

function mergeCookies(existing: string, setCookies: string[]): string {
  const map = new Map<string, string>();
  for (const part of existing
    .split(";")
    .map((value) => value.trim())
    .filter(Boolean)) {
    const idx = part.indexOf("=");
    if (idx > 0) map.set(part.slice(0, idx), part.slice(idx + 1));
  }
  for (const raw of setCookies) {
    const first = raw.split(";")[0] ?? "";
    const idx = first.indexOf("=");
    if (idx <= 0) continue;
    map.set(first.slice(0, idx), first.slice(idx + 1));
  }
  return [...map.entries()].map(([key, value]) => `${key}=${value}`).join("; ");
}

function unwrapOcisPayload<T>(body: OcisApiEnvelope<T>): OcisApiEntity<T> {
  const entity = body.context?.entity ?? body.entity;
  if (!entity) {
    throw new Error("Virginia OCIS returned an empty response envelope.");
  }
  if (entity.status !== "SUCCESS") {
    const code = entity.messages?.[0]?.messageCode;
    const message = entity.messages?.[0]?.message;
    if (code === "terms.notAccepted") {
      throw new Error("Virginia OCIS session terms were not accepted.");
    }
    throw new Error(
      message || code || entity.status || "Virginia OCIS request failed.",
    );
  }
  return entity;
}

function buildOcisName(parsed: ParsedUsQuery): string {
  if (parsed.fullName) return parsed.fullName;
  if (parsed.firstName && parsed.lastName) {
    return `${parsed.firstName} ${parsed.lastName}`;
  }
  throw new Error(
    "Enter a first and last name for Virginia OCIS court search (e.g. Shray Gupta, VA).",
  );
}

function courtLabel(row: OcisSearchRow): string {
  const fips = row.qualifiedFips?.slice(0, 3) ?? "";
  const suffix = row.qualifiedFips?.slice(3) ?? "";
  const county = VA_FIPS_COUNTY[fips];
  const level =
    row.courtLevel === "G"
      ? "General District Court"
      : row.courtLevel === "J"
        ? "Juvenile & Domestic Relations District Court"
        : row.courtLevel === "C"
          ? "Circuit Court"
          : "Trial Court";
  const division =
    row.divisionType === "T"
      ? "Traffic"
      : row.divisionType === "C"
        ? "Criminal"
        : undefined;

  const place = county || (row.qualifiedFips ? `FIPS ${row.qualifiedFips}` : "Virginia");
  return [place, level, division].filter(Boolean).join(" · ");
}

async function ensureOcisSession(cookie: string): Promise<string> {
  const landing = await fetchWithTimeout(`${BASE}/ocis/landing`, {
    method: "GET",
    cache: "no-store",
    timeoutMs: SOURCE_LIMITS["va-ocis"].timeoutMs,
    headers: {
      Accept: "text/html",
      "User-Agent": BROWSER_UA,
      Cookie: cookie,
    },
  });
  cookie = mergeCookies(cookie, readSetCookies(landing.headers));
  await landing.text();

  const config = await fetchWithTimeout(`${API}/getUIConfig`, {
    method: "GET",
    cache: "no-store",
    timeoutMs: SOURCE_LIMITS["va-ocis"].timeoutMs,
    headers: {
      Accept: "application/json",
      "User-Agent": BROWSER_UA,
      Cookie: cookie,
      Referer: `${BASE}/ocis/landing`,
    },
  });
  cookie = mergeCookies(cookie, readSetCookies(config.headers));
  await config.text();

  const terms = await fetchWithTimeout(`${API}/termsAndCondAccepted`, {
    method: "GET",
    cache: "no-store",
    timeoutMs: SOURCE_LIMITS["va-ocis"].timeoutMs,
    headers: {
      Accept: "application/json",
      "User-Agent": BROWSER_UA,
      Cookie: cookie,
      Referer: `${BASE}/ocis/landing`,
    },
  });
  cookie = mergeCookies(cookie, readSetCookies(terms.headers));
  const termsBody = (await terms.json()) as OcisApiEnvelope<unknown>;
  unwrapOcisPayload(termsBody);
  return cookie;
}

export function shouldSearchVaOcis(parsed: ParsedUsQuery): boolean {
  if (parsed.mode === "case") return false;
  if (parsed.state === "VA") return true;
  if (parsed.county || parsed.city || parsed.zip) return true;
  return /\b(virginia|fairfax|henrico|norfolk|richmond|chesapeake|arlington|loudoun)\b/i.test(
    parsed.raw,
  );
}

export async function searchVaOcis(
  parsed: ParsedUsQuery,
  limit = 15,
): Promise<CourtCaseHit[]> {
  const name = buildOcisName(parsed);
  const key = cacheKey("va-ocis", `${name}:${limit}`);
  const cached = getCached<CourtCaseHit[]>(key);
  if (cached) return cached;

  await paceSource("va-ocis", 1500);

  let cookie = await ensureOcisSession("");

  const body = {
    searchBy: "N",
    searchString: [name],
    divisions: ["Adult Criminal/Traffic"],
    endingIndex: 0,
  };

  const res = await fetchWithTimeout(`${API}/search`, {
    method: "POST",
    cache: "no-store",
    timeoutMs: SOURCE_LIMITS["va-ocis"].timeoutMs,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": BROWSER_UA,
      Cookie: cookie,
      Origin: BASE,
      Referer: `${BASE}/ocis/search/true`,
    },
    body: JSON.stringify(body),
  });

  cookie = mergeCookies(cookie, readSetCookies(res.headers));
  const raw = (await res.json()) as OcisApiEnvelope<OcisSearchPayload>;
  if (!res.ok) {
    throw new Error(`Virginia OCIS HTTP ${res.status}`);
  }

  const entity = unwrapOcisPayload(raw);
  const rows = entity.payload?.searchResults ?? [];
  const retrievedAt = new Date().toISOString();

  const hits: CourtCaseHit[] = rows.slice(0, limit).map((row, index) => {
    const docket = row.formattedCaseNumber || row.caseNumber || `va-ocis-${index}`;
    const defendant = row.name || name;
    const charge = row.chargeDesc || "Virginia court matter";
    return {
      id: `va-ocis-${docket}`,
      caseName: `${charge} — ${defendant}`,
      docketNumber: docket,
      court: courtLabel(row),
      dateFiled: row.hearingDate || row.offenseDate,
      natureOfSuit: row.codeSection ? `Code ${row.codeSection}` : undefined,
      snippet: [
        row.chargeDesc,
        row.codeSection ? `§ ${row.codeSection}` : null,
        row.offenseDate ? `Offense ${row.offenseDate}` : null,
        row.hearingDate ? `Hearing ${row.hearingDate}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
      parties: defendant ? [defendant] : undefined,
      source: {
        id: "va-ocis",
        label: "Virginia OCIS",
        jurisdiction: "Virginia statewide trial courts",
        retrievedAt,
        deepLink: `${BASE}/ocis/search/true`,
        confidence: "high",
      },
    };
  });

  setCached(key, hits, SOURCE_LIMITS["va-ocis"].ttlMs);
  return hits;
}
