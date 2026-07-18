import type { ParsedPublicQuery, PublicPortalHit } from "@/lib/us-records/types";
import { filterPortalBacklog } from "@/lib/us-records/portal-backlog";

/** High-value county / specialty portals for MD, FL, TX, NY. */
export const PRIORITY_STATE_COUNTY_PORTALS: Array<{
  state: string;
  name: string;
  url: string;
  kind: "court" | "inmate" | "sor" | "corporate" | "warrant";
  note: string;
  liveBlockedReason?: string;
}> = [
  {
    state: "MD",
    name: "Maryland Judiciary Case Search",
    url: "https://casesearch.mdcourts.gov/casesearch/",
    kind: "court",
    note: "Statewide party/case search",
    liveBlockedReason: "403 / terms prohibit automated scripts",
  },
  {
    state: "MD",
    name: "Maryland DPSCS Inmate Locator",
    url: "https://dpscs.maryland.gov/services/inmate-locator.shtml",
    kind: "inmate",
    note: "State custody locator",
  },
  {
    state: "MD",
    name: "Maryland Business Express",
    url: "https://egov.maryland.gov/BusinessExpress/EntitySearch",
    kind: "corporate",
    note: "Entity / resident-agent search",
  },
  {
    state: "FL",
    name: "Hillsborough HOVER Case Search",
    url: "https://hover.hillsclerk.com/html/case/caseSearch.html",
    kind: "court",
    note: "County case search — live adapter validates the anonymous search GUID; PerimeterX may still challenge some IPs",
  },
  {
    state: "FL",
    name: "Broward Clerk Case Search",
    url: "https://www.browardclerk.org/Records/Case-Search",
    kind: "court",
    note: "County case search",
  },
  {
    state: "FL",
    name: "Palm Beach eCaseView",
    url: "https://appsgp.mypalmbeachclerk.com/eCaseView/",
    kind: "court",
    note: "County case search",
  },
  {
    state: "FL",
    name: "Orange County my eClerk",
    url: "https://myeclerk.myorangeclerk.com/home/index",
    kind: "court",
    note: "County case search",
    liveBlockedReason: "CAPTCHA on every anonymous search",
  },
  {
    state: "FL",
    name: "Miami-Dade Clerk Online Case Search",
    url: "https://www2.miami-dadeclerk.com/ocs/",
    kind: "court",
    note: "County civil/criminal portals",
  },
  {
    state: "FL",
    name: "FDLE Sexual Offender / Predator Search",
    url: "https://offender.fdle.state.fl.us/offender/Search.jsp",
    kind: "sor",
    note: "Statewide registry",
  },
  {
    state: "FL",
    name: "Florida DOC Offender Search",
    url: "https://pubapps.fdc.myflorida.com/OffenderSearch/Search.aspx",
    kind: "inmate",
    note: "State custody search",
  },
  {
    state: "FL",
    name: "Florida Sunbiz",
    url: "https://search.sunbiz.org/Inquiry/CorporationSearch/ByName",
    kind: "corporate",
    note: "Entity / officer / agent search",
  },
  {
    state: "TX",
    name: "re:SearchTX",
    url: "https://research.txcourts.gov/",
    kind: "court",
    note: "Statewide e-filed civil coverage",
    liveBlockedReason: "Free registered account required",
  },
  {
    state: "TX",
    name: "Bexar County Justice Portal (Tyler Odyssey)",
    url: "https://portal-txbexar.tylertech.cloud/Portal/",
    kind: "court",
    note: "County Odyssey Smart Search",
  },
  {
    state: "TX",
    name: "Harris County District Clerk eDocs",
    url: "https://www.hcdistrictclerk.com/eDocs/Public/Search.aspx?ShowFF=1",
    kind: "court",
    note: "County district clerk",
    liveBlockedReason: "Registered login required",
  },
  {
    state: "TX",
    name: "Dallas County Wanted Lookup",
    url: "https://www.dallascounty.org/dcwantedsearch/search.jsp",
    kind: "warrant",
    note: "County warrant / delinquent lookup",
  },
  {
    state: "TX",
    name: "TDCJ Inmate Search",
    url: "https://inmate.tdcj.texas.gov/InmateSearch/start.action",
    kind: "inmate",
    note: "State custody search",
  },
  {
    state: "TX",
    name: "Texas DPS Sex Offender Registry",
    url: "https://publicsite.dps.texas.gov/SexOffenderRegistry/Search",
    kind: "sor",
    note: "Statewide registry",
  },
  {
    state: "NY",
    name: "WebCivil Supreme",
    url: "https://iapps.courts.state.ny.us/webcivil/FCASMain",
    kind: "court",
    note: "Statewide Supreme civil",
    liveBlockedReason: "hCaptcha blocks unattended automation",
  },
  {
    state: "NY",
    name: "WebCivil Local",
    url: "https://iapps.courts.state.ny.us/webcivilLocal/LCMain",
    kind: "court",
    note: "Local civil / housing",
    liveBlockedReason: "hCaptcha blocks unattended automation",
  },
  {
    state: "NY",
    name: "NYS DOCCS Incarcerated Lookup",
    url: "https://nysdoccslookup.doccs.ny.gov/",
    kind: "inmate",
    note: "State custody / some former inmates",
  },
  {
    state: "NY",
    name: "NY DCJS Sex Offender Registry",
    url: "https://www.criminaljustice.ny.gov/SomsSUBDirectory/search_index.jsp",
    kind: "sor",
    note: "Level 2/3 public directory",
  },
  {
    state: "NY",
    name: "NY Corporation & Business Entity Database",
    url: "https://apps.dos.ny.gov/publicInquiry/",
    kind: "corporate",
    note: "DOS entity search",
  },
  {
    state: "NY",
    name: "NYC ACRIS Property Documents",
    url: "https://a836-acris.nyc.gov/CP/",
    kind: "court",
    note: "Grantor/grantee recorded documents",
  },
];

export function buildPriorityStatePortals(
  parsed: ParsedPublicQuery,
): PublicPortalHit[] {
  const target = parsed.state?.toUpperCase();
  const name = parsed.fullName || parsed.raw;
  const rows = target
    ? PRIORITY_STATE_COUNTY_PORTALS.filter((row) => row.state === target)
    : PRIORITY_STATE_COUNTY_PORTALS.filter((row) =>
        ["MD", "FL", "TX", "NY"].includes(row.state),
      );

  return rows.map((row) => ({
    id: `priority-${row.state.toLowerCase()}-${row.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 40)}`,
    title: row.name,
    summary: row.liveBlockedReason
      ? `Search "${name}" on ${row.name}. Live automation blocked: ${row.liveBlockedReason}.`
      : `Open ${row.name} to search "${name}" (${row.note}).`,
    source: {
      id: "state-portal",
      label: `${row.state} · ${row.name}`,
      jurisdiction: `${row.state}, US`,
      retrievedAt: new Date().toISOString(),
      deepLink: row.url,
      confidence: row.liveBlockedReason ? "low" : "medium",
    },
  }));
}

export function buildCandidateBacklogPortals(
  parsed: ParsedPublicQuery,
  limit = 25,
): PublicPortalHit[] {
  const name = parsed.fullName || parsed.raw;
  const hint =
    parsed.state === "MD"
      ? "maryland"
      : parsed.state === "FL"
        ? "florida"
        : parsed.state === "TX"
          ? "texas"
          : parsed.state === "NY"
            ? "new york"
            : parsed.state?.toLowerCase();

  return filterPortalBacklog({
    priority: ["P0", "P1"],
    stateHint: hint,
    limit,
  }).map((row) => ({
    id: `backlog-${row.priority}-${row.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 48)}`,
    title: row.name,
    summary: `Search "${name}" via ${row.jurisdiction} (${row.category}; ${row.approach}; ${row.difficulty}). ${row.notes}`,
    source: {
      id: "state-portal",
      label: row.name,
      jurisdiction: row.jurisdiction,
      retrievedAt: new Date().toISOString(),
      deepLink: row.url,
      confidence: row.liveStatus === "live" ? "high" : "medium",
    },
  }));
}
