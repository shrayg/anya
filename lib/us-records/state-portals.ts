import type { ParsedPublicQuery, PublicPortalHit } from "@/lib/us-records/types";

export type StatePortalDef = {
  state: string;
  name: string;
  courtUrl: string;
  courtLabel: string;
  sorUrl?: string;
  businessUrl?: string;
  liveCourtAdapter?: boolean;
  liveSorAdapter?: boolean;
};

export const US_STATE_PORTALS: StatePortalDef[] = [
  { state: "AL", name: "Alabama", courtUrl: "https://pa.alacourt.com/default.aspx", courtLabel: "Alabama statewide court portal", sorUrl: "https://www.alea.gov/dps/sor/search" },
  { state: "AK", name: "Alaska", courtUrl: "https://courts.alaska.gov/trialcourts/index.htm", courtLabel: "Alaska trial courts", sorUrl: "https://sor.dps.alaska.gov/sorweb/sorweb.aspx" },
  { state: "AZ", name: "Arizona", courtUrl: "https://www.azcourts.gov/AZ-Courts/Public-Access-to-Court-Information", courtLabel: "Arizona courts public access", sorUrl: "https://www.azdps.gov/services/public/svop" },
  { state: "AR", name: "Arkansas", courtUrl: "https://caseinfo.arcourts.gov/", courtLabel: "Arkansas CourtConnect", sorUrl: "https://www.ark.org/offender-search/index.php" },
  { state: "CA", name: "California", courtUrl: "https://www.courts.ca.gov/find-my-court.htm", courtLabel: "California courts (county portals)", sorUrl: "https://www.meganslaw.ca.gov/" },
  { state: "CO", name: "Colorado", courtUrl: "https://www.courts.state.co.us/selfhelp/case/", courtLabel: "Colorado courts", sorUrl: "https://sor.state.co.us/" },
  { state: "CT", name: "Connecticut", courtUrl: "https://civilinquiry.jud.ct.gov/", courtLabel: "Connecticut civil inquiry", sorUrl: "https://sheriffalerts.com/sor/" },
  { state: "DE", name: "Delaware", courtUrl: "https://courts.delaware.gov/aoc/civil/", courtLabel: "Delaware courts", sorUrl: "https://sexoffender.dsp.delaware.gov/" },
  { state: "DC", name: "District of Columbia", courtUrl: "https://www.dccourts.gov/services/case-search", courtLabel: "DC Courts case search", sorUrl: "https://sor.csosa.gov/" },
  { state: "FL", name: "Florida", courtUrl: "https://www.flcourts.org/Florida-Courts/Trial-Courts", courtLabel: "Florida trial courts", sorUrl: "https://offender.fdle.state.fl.us/offender/sops/home.jsf" },
  { state: "GA", name: "Georgia", courtUrl: "https://georgiacourts.gov/", courtLabel: "Georgia courts", sorUrl: "https://state.sor.gbi.ga.gov/sor/" },
  { state: "HI", name: "Hawaii", courtUrl: "https://www.courts.state.hi.us/legal_references/records", courtLabel: "Hawaii courts", sorUrl: "https://sor.ag.hawaii.gov/" },
  { state: "ID", name: "Idaho", courtUrl: "https://www.idcourts.gov/repository-start/", courtLabel: "Idaho courts", sorUrl: "https://isp.idaho.gov/sor/" },
  { state: "IL", name: "Illinois", courtUrl: "https://www.illinoiscourts.gov/public/case-search/", courtLabel: "Illinois courts", sorUrl: "https://www.isp.illinois.gov/sor" },
  { state: "IN", name: "Indiana", courtUrl: "https://public.courts.in.gov/", courtLabel: "Indiana courts", sorUrl: "https://www.icrimewatch.net/indiana.php" },
  { state: "IA", name: "Iowa", courtUrl: "https://www.iowacourts.state.ia.us/ESAWebApp/", courtLabel: "Iowa courts", sorUrl: "https://www.iowasexoffender.gov/" },
  { state: "KS", name: "Kansas", courtUrl: "https://www.kansas.gov/countyCourts/", courtLabel: "Kansas courts", sorUrl: "https://www.kbi.ks.gov/registeredoffender" },
  { state: "KY", name: "Kentucky", courtUrl: "https://kycourts.gov/Pages/default.aspx", courtLabel: "Kentucky courts", sorUrl: "https://kspsor.state.ky.us/" },
  { state: "LA", name: "Louisiana", courtUrl: "https://www.lasc.org/", courtLabel: "Louisiana courts", sorUrl: "https://sor.lsp.org/" },
  { state: "ME", name: "Maine", courtUrl: "https://www.courts.maine.gov/ecourts/index.html", courtLabel: "Maine eCourts", sorUrl: "https://sor.informe.org/sor/" },
  { state: "MD", name: "Maryland", courtUrl: "https://casesearch.courts.state.md.us/casesearch/", courtLabel: "Maryland Case Search", sorUrl: "https://www.dpscs.state.md.us/onlineservs/sor/" },
  { state: "MA", name: "Massachusetts", courtUrl: "https://www.masscourts.org/eservices/home.page", courtLabel: "Massachusetts courts", sorUrl: "https://sorb.chs.state.ma.us/sorbpublic/" },
  { state: "MI", name: "Michigan", courtUrl: "https://micourt.courts.michigan.gov/", courtLabel: "Michigan courts", sorUrl: "https://mspsor.com/" },
  { state: "MN", name: "Minnesota", courtUrl: "https://publicaccess.courts.state.mn.us/", courtLabel: "Minnesota court records", sorUrl: "https://coms.doc.state.mn.us/publicviewer/" },
  { state: "MS", name: "Mississippi", courtUrl: "https://courts.ms.gov/", courtLabel: "Mississippi courts", sorUrl: "https://sor.mdps.ms.gov/" },
  { state: "MO", name: "Missouri", courtUrl: "https://www.courts.mo.gov/casenet/", courtLabel: "Missouri Case.net", sorUrl: "https://www.mshp.dps.missouri.gov/sor/" },
  { state: "MT", name: "Montana", courtUrl: "https://courts.mt.gov/", courtLabel: "Montana courts", sorUrl: "https://app.doj.mt.gov/apps/svow/" },
  { state: "NE", name: "Nebraska", courtUrl: "https://www.nebraska.gov/justicecc/cc/", courtLabel: "Nebraska courts", sorUrl: "https://sor.nebraska.gov/" },
  { state: "NV", name: "Nevada", courtUrl: "https://nvcourts.gov/AOC/Programs_and_Services/Court_Records/", courtLabel: "Nevada courts", sorUrl: "https://www.nvsexoffenders.gov/" },
  { state: "NH", name: "New Hampshire", courtUrl: "https://www.courts.nh.gov/our-courts/circuit-court/case-information", courtLabel: "New Hampshire courts", sorUrl: "https://business.nh.gov/nsor/" },
  { state: "NJ", name: "New Jersey", courtUrl: "https://portal.njcourts.gov/webe1/MPAWeb/", courtLabel: "New Jersey courts", sorUrl: "https://www.njsp.org/sex-offender-registry/" },
  { state: "NM", name: "New Mexico", courtUrl: "https://caselookup.nmcourts.gov/caselookup/", courtLabel: "New Mexico Case Lookup", sorUrl: "https://dps.nm.gov/sor/" },
  { state: "NY", name: "New York", courtUrl: "https://iapps.courts.state.ny.us/webcivil/", courtLabel: "New York WebCivil", sorUrl: "https://www.criminaljustice.ny.gov/Soms/" },
  { state: "NC", name: "North Carolina", courtUrl: "https://www.nccourts.gov/help-topics/court-records", courtLabel: "North Carolina courts", sorUrl: "https://sexoffender.ncsbi.gov/" },
  { state: "ND", name: "North Dakota", courtUrl: "https://www.ndcourts.gov/public-access", courtLabel: "North Dakota courts", sorUrl: "https://www.ndsor.gov/" },
  { state: "OH", name: "Ohio", courtUrl: "https://www.supremecourt.ohio.gov/JCS/", courtLabel: "Ohio courts", sorUrl: "https://www.drc.ohio.gov/OffenderSearch" },
  { state: "OK", name: "Oklahoma", courtUrl: "https://www.oscn.net/", courtLabel: "Oklahoma OSCN", sorUrl: "https://sors.doc.ok.gov/" },
  { state: "OR", name: "Oregon", courtUrl: "https://www.courts.oregon.gov/services/online/Pages/default.aspx", courtLabel: "Oregon courts", sorUrl: "https://sexoffenders.oregon.gov/" },
  { state: "PA", name: "Pennsylvania", courtUrl: "https://ujsportal.pacourts.us/", courtLabel: "Pennsylvania UJS Portal", sorUrl: "https://www.pameganslaw.state.pa.us/" },
  { state: "RI", name: "Rhode Island", courtUrl: "https://publicportal.courts.ri.gov/", courtLabel: "Rhode Island courts", sorUrl: "https://www.par.sor.ri.gov/" },
  { state: "SC", name: "South Carolina", courtUrl: "https://www.sccourts.org/case-search/", courtLabel: "South Carolina courts", sorUrl: "https://scor.sled.sc.gov/" },
  { state: "SD", name: "South Dakota", courtUrl: "https://ujs.sd.gov/CaseRecords/", courtLabel: "South Dakota courts", sorUrl: "https://sor.sd.gov/" },
  { state: "TN", name: "Tennessee", courtUrl: "https://www.tncourts.gov/courts/court-clerks/court-case-information", courtLabel: "Tennessee courts", sorUrl: "https://sor.tbi.tn.gov/" },
  { state: "TX", name: "Texas", courtUrl: "https://www.txcourts.gov/public-information/", courtLabel: "Texas courts", sorUrl: "https://publicsite.dps.texas.gov/SexOffenderRegistry" },
  { state: "UT", name: "Utah", courtUrl: "https://www.utcourts.gov/online-services/", courtLabel: "Utah courts", sorUrl: "https://www.communitynotification.com/cap_main.php?office=54567" },
  { state: "VT", name: "Vermont", courtUrl: "https://www.vermontjudiciary.org/court-records", courtLabel: "Vermont courts", sorUrl: "https://vcic.vermont.gov/sor" },
  { state: "VA", name: "Virginia", courtUrl: "https://eapps.courts.state.va.us/ocis/landing", courtLabel: "Virginia OCIS", sorUrl: "https://www.vspsor.com/Search", liveCourtAdapter: true, liveSorAdapter: true },
  { state: "WA", name: "Washington", courtUrl: "https://dw.courts.wa.gov/", courtLabel: "Washington courts", sorUrl: "https://www.waspc.org/sex-offender-information/" },
  { state: "WV", name: "West Virginia", courtUrl: "https://www.courtswv.gov/public-resources/records", courtLabel: "West Virginia courts", sorUrl: "https://apps.wv.gov/statepolice/sexoffender/" },
  { state: "WI", name: "Wisconsin", courtUrl: "https://www.wicourts.gov/", courtLabel: "Wisconsin courts", sorUrl: "https://www.wi-doc.com/offender.htm" },
  { state: "WY", name: "Wyoming", courtUrl: "https://www.courts.state.wy.us/", courtLabel: "Wyoming courts", sorUrl: "https://sor.wyo.gov/" },
];

export function resolveTargetState(parsed: ParsedPublicQuery): string | undefined {
  if (parsed.state) return parsed.state.toUpperCase();
  return undefined;
}

export function buildStateCourtPortals(
  parsed: ParsedPublicQuery,
  options?: { all?: boolean },
): PublicPortalHit[] {
  const target = resolveTargetState(parsed);
  const name = parsed.fullName || parsed.raw;
  const states = target
    ? US_STATE_PORTALS.filter((row) => row.state === target)
    : options?.all
      ? US_STATE_PORTALS
      : US_STATE_PORTALS.filter((row) => !row.liveCourtAdapter);

  return states.map((row) => ({
    id: `state-court-${row.state.toLowerCase()}`,
    title: `${row.name} court records`,
    summary: `Search "${name}" on the official ${row.courtLabel}. Live automated lookup${row.liveCourtAdapter ? " is enabled for Virginia OCIS" : " is not yet enabled for this state — open the public portal to continue"}.`,
    source: {
      id: "state-portal",
      label: `${row.name} Courts`,
      jurisdiction: `${row.name}, US`,
      retrievedAt: new Date().toISOString(),
      deepLink: row.courtUrl,
      confidence: row.liveCourtAdapter ? "high" : "medium",
    },
  }));
}

export function buildStateSorPortals(
  parsed: ParsedPublicQuery,
  options?: { all?: boolean },
): PublicPortalHit[] {
  const target = resolveTargetState(parsed);
  const name = parsed.fullName || parsed.raw;
  const states = target
    ? US_STATE_PORTALS.filter((row) => row.state === target && row.sorUrl)
    : options?.all
      ? US_STATE_PORTALS.filter((row) => row.sorUrl)
      : US_STATE_PORTALS.filter((row) => row.sorUrl && !row.liveSorAdapter);

  return states.map((row) => ({
    id: `state-sor-${row.state.toLowerCase()}`,
    title: `${row.name} sex offender registry`,
    summary: `Check "${name}" against the official ${row.name} public registry${row.liveSorAdapter ? " (live VA adapter enabled)" : ""}.`,
    source: {
      id: "state-portal",
      label: `${row.name} SOR`,
      jurisdiction: `${row.name}, US`,
      retrievedAt: new Date().toISOString(),
      deepLink: row.sorUrl!,
      confidence: row.liveSorAdapter ? "high" : "medium",
    },
  }));
}
