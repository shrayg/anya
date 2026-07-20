import type {
  ParsedPublicQuery,
  PublicPortalHit,
} from "@/lib/us-records/types";

export type CountryPortalDef = {
  code: string;
  name: string;
  courtUrl?: string;
  businessUrl?: string;
  sanctionsUrl?: string;
  notes?: string;
};

export const COUNTRY_PORTALS: CountryPortalDef[] = [
  {
    code: "GB",
    name: "United Kingdom",
    courtUrl: "https://www.gov.uk/search-court-decisions",
    businessUrl: "https://find-and-update.company-information.service.gov.uk/",
    sanctionsUrl:
      "https://www.gov.uk/government/publications/financial-sanctions-consolidated-list-of-targets",
  },
  {
    code: "CA",
    name: "Canada",
    courtUrl: "https://www.canlii.org/",
    businessUrl:
      "https://www.ic.gc.ca/app/scr/cc/CorporationsCanada/fdrlCr.html",
    sanctionsUrl:
      "https://www.international.gc.ca/world-monde/international_relations-relations_internationales/sanctions/consolidated-consolide.aspx",
  },
  {
    code: "AU",
    name: "Australia",
    courtUrl: "https://www.austlii.edu.au/",
    businessUrl: "https://abr.business.gov.au/",
    sanctionsUrl:
      "https://www.dfat.gov.au/international-relations/security/sanctions/consolidated-list",
  },
  {
    code: "DE",
    name: "Germany",
    courtUrl: "https://www.rechtsprechung-im-internet.de/",
    businessUrl: "https://www.handelsregister.de/",
    sanctionsUrl:
      "https://www.bafa.de/EN/Trade/Foreign_Trade/Export_Control/Sanctions/sanctions_node.html",
  },
  {
    code: "FR",
    name: "France",
    courtUrl: "https://www.legifrance.gouv.fr/",
    businessUrl: "https://www.infogreffe.fr/",
    sanctionsUrl: "https://www.diplomatie.gouv.fr/en/foreign-policy/sanctions/",
  },
  {
    code: "IN",
    name: "India",
    courtUrl: "https://judgments.ecourts.gov.in/",
    businessUrl: "https://www.mca.gov.in/mcafoportal/viewCompanyMasterData.do",
  },
  {
    code: "MX",
    name: "Mexico",
    courtUrl: "https://www.diputados.gob.mx/LeyesBiblio/index.htm",
    businessUrl: "https://rpc.economia.gob.mx/",
  },
  {
    code: "BR",
    name: "Brazil",
    courtUrl: "https://www.stj.jus.br/",
    businessUrl: "https://www.gov.br/receitafederal/pt-br",
  },
  {
    code: "JP",
    name: "Japan",
    courtUrl: "https://www.courts.go.jp/",
    businessUrl: "https://www.tdb.co.jp/",
  },
  {
    code: "SG",
    name: "Singapore",
    courtUrl: "https://www.judiciary.gov.sg/",
    businessUrl: "https://www.acra.gov.sg/",
  },
  {
    code: "NZ",
    name: "New Zealand",
    courtUrl: "https://www.courtsofnz.govt.nz/",
    businessUrl: "https://companies-register.companiesoffice.govt.nz/",
  },
  {
    code: "IE",
    name: "Ireland",
    courtUrl: "https://www.courts.ie/",
    businessUrl: "https://core.cro.ie/",
  },
  {
    code: "NL",
    name: "Netherlands",
    courtUrl: "https://uitspraken.rechtspraak.nl/",
    businessUrl: "https://www.kvk.nl/",
  },
  {
    code: "SE",
    name: "Sweden",
    courtUrl: "https://lagen.nu/",
    businessUrl: "https://bolagsverket.se/",
  },
  {
    code: "CH",
    name: "Switzerland",
    courtUrl: "https://www.bger.ch/",
    businessUrl: "https://www.zefix.ch/",
  },
  {
    code: "ZA",
    name: "South Africa",
    courtUrl: "https://www.saflii.org/",
    businessUrl: "https://www.cipc.co.za/",
  },
  {
    code: "AE",
    name: "United Arab Emirates",
    businessUrl: "https://www.economy.ae/",
  },
  {
    code: "IL",
    name: "Israel",
    courtUrl: "https://www.gov.il/en/departments/the_judicial_authority",
  },
  { code: "KR", name: "South Korea", courtUrl: "https://www.scourt.go.kr/" },
  {
    code: "EU",
    name: "European Union",
    sanctionsUrl: "https://www.sanctionsmap.eu/",
  },
];

export function buildCountryPortals(
  parsed: ParsedPublicQuery,
): PublicPortalHit[] {
  const target = parsed.country?.toUpperCase();
  const name = parsed.fullName || parsed.raw;
  const countries = target
    ? COUNTRY_PORTALS.filter((row) => row.code === target)
    : COUNTRY_PORTALS;

  const hits: PublicPortalHit[] = [];

  for (const row of countries) {
    if (row.courtUrl) {
      hits.push({
        id: `country-court-${row.code.toLowerCase()}`,
        title: `${row.name} court / legal records`,
        summary: `Open official ${row.name} court and legal record portals to continue researching "${name}".`,
        source: {
          id: "country-portal",
          label: `${row.name} Courts`,
          jurisdiction: row.name,
          retrievedAt: new Date().toISOString(),
          deepLink: row.courtUrl,
          confidence: "medium",
        },
      });
    }
    if (row.businessUrl) {
      hits.push({
        id: `country-biz-${row.code.toLowerCase()}`,
        title: `${row.name} business registry`,
        summary: `Search corporate registrations and business entities in ${row.name}.`,
        source: {
          id: "country-portal",
          label: `${row.name} Business Registry`,
          jurisdiction: row.name,
          retrievedAt: new Date().toISOString(),
          deepLink: row.businessUrl,
          confidence: "medium",
        },
      });
    }
    if (row.sanctionsUrl) {
      hits.push({
        id: `country-sanctions-${row.code.toLowerCase()}`,
        title: `${row.name} sanctions lists`,
        summary: `Review official ${row.name} sanctions publications for "${name}".`,
        source: {
          id: "country-portal",
          label: `${row.name} Sanctions`,
          jurisdiction: row.name,
          retrievedAt: new Date().toISOString(),
          deepLink: row.sanctionsUrl,
          confidence: "medium",
        },
      });
    }
  }

  return hits;
}
