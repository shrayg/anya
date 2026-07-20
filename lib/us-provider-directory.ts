export type UsProviderRecord = {
  name: string;
  category: string;
  coverage: string;
  website?: string;
  phone?: string;
  headquarters?: string;
  notes?: string;
};

export type UsProviderSearchResult = {
  query: string;
  count: number;
  providers: UsProviderRecord[];
};

const US_STATE_CODES = new Set([
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
  "DC",
]);

export const CAR_INSURANCE_US: UsProviderRecord[] = [
  {
    name: "State Farm",
    category: "Auto insurer",
    coverage: "Nationwide",
    headquarters: "Bloomington, IL",
    website: "statefarm.com",
    phone: "800-782-8332",
    notes: "Largest US auto insurer by premium volume.",
  },
  {
    name: "GEICO",
    category: "Auto insurer",
    coverage: "Nationwide",
    headquarters: "Chevy Chase, MD",
    website: "geico.com",
    phone: "800-841-3000",
    notes: "Berkshire Hathaway subsidiary; strong direct-to-consumer channel.",
  },
  {
    name: "Progressive",
    category: "Auto insurer",
    coverage: "Nationwide",
    headquarters: "Mayfield Village, OH",
    website: "progressive.com",
    phone: "800-776-4737",
    notes: "Known for usage-based Snapshot program.",
  },
  {
    name: "Allstate",
    category: "Auto insurer",
    coverage: "Nationwide",
    headquarters: "Northbrook, IL",
    website: "allstate.com",
    phone: "800-255-7828",
    notes: "Major national carrier with agency and direct sales.",
  },
  {
    name: "USAA",
    category: "Auto insurer",
    coverage: "Nationwide",
    headquarters: "San Antonio, TX",
    website: "usaa.com",
    phone: "800-531-8722",
    notes: "Military members, veterans, and eligible family only.",
  },
  {
    name: "Liberty Mutual",
    category: "Auto insurer",
    coverage: "Nationwide",
    headquarters: "Boston, MA",
    website: "libertymutual.com",
    phone: "800-290-8711",
    notes: "Global insurer with strong US personal lines.",
  },
  {
    name: "Farmers Insurance",
    category: "Auto insurer",
    coverage: "Nationwide",
    headquarters: "Woodland Hills, CA",
    website: "farmers.com",
    phone: "888-327-6335",
    notes: "Agency-based auto and home coverage.",
  },
  {
    name: "Nationwide",
    category: "Auto insurer",
    coverage: "Nationwide",
    headquarters: "Columbus, OH",
    website: "nationwide.com",
    phone: "877-669-6877",
    notes: "Farm Bureau heritage; multi-line personal insurance.",
  },
  {
    name: "American Family Insurance",
    category: "Auto insurer",
    coverage: "Multi-state",
    headquarters: "Madison, WI",
    website: "amfam.com",
    phone: "800-692-6326",
    notes: "Strong Midwest and Western US presence.",
  },
  {
    name: "Travelers",
    category: "Auto insurer",
    coverage: "Nationwide",
    headquarters: "New York, NY",
    website: "travelers.com",
    phone: "800-842-5075",
    notes: "Commercial and personal auto lines.",
  },
  {
    name: "The Hartford",
    category: "Auto insurer",
    coverage: "Nationwide",
    headquarters: "Hartford, CT",
    website: "thehartford.com",
    phone: "800-243-5860",
    notes: "AARP partnership auto program available.",
  },
  {
    name: "Auto-Owners Insurance",
    category: "Auto insurer",
    coverage: "Multi-state",
    headquarters: "Lansing, MI",
    website: "auto-owners.com",
    phone: "800-346-0346",
    notes: "Independent agent model across 26 states.",
  },
  {
    name: "Amica Mutual",
    category: "Auto insurer",
    coverage: "Multi-state",
    headquarters: "Lincoln, RI",
    website: "amica.com",
    phone: "800-242-6422",
    notes: "Mutual company focused on customer service scores.",
  },
  {
    name: "Erie Insurance",
    category: "Auto insurer",
    coverage: "Multi-state",
    headquarters: "Erie, PA",
    website: "erieinsurance.com",
    phone: "800-458-0811",
    notes: "Mid-Atlantic and Midwest regional carrier.",
  },
  {
    name: "Mercury Insurance",
    category: "Auto insurer",
    coverage: "CA, AZ, FL, GA, IL, NV, NJ, NY, OK, TX, VA",
    headquarters: "Los Angeles, CA",
    website: "mercuryinsurance.com",
    phone: "800-956-3728",
    notes: "Western US-focused personal auto insurer.",
  },
  {
    name: "National General",
    category: "Auto insurer",
    coverage: "Nationwide",
    headquarters: "Winston-Salem, NC",
    website: "nationalgeneral.com",
    phone: "888-293-5100",
    notes: "Allstate-owned; specialty and non-standard auto.",
  },
  {
    name: "MetLife Auto & Home",
    category: "Auto insurer",
    coverage: "Multi-state",
    headquarters: "New York, NY",
    website: "metlife.com",
    phone: "800-854-6011",
    notes: "Personal lines sold through affiliated brands.",
  },
  {
    name: "Safeco Insurance",
    category: "Auto insurer",
    coverage: "Nationwide",
    headquarters: "Seattle, WA",
    website: "safeco.com",
    phone: "800-332-3226",
    notes: "Liberty Mutual company; independent agent channel.",
  },
  {
    name: "Esurance",
    category: "Auto insurer",
    coverage: "Multi-state",
    headquarters: "San Francisco, CA",
    website: "esurance.com",
    phone: "800-378-7262",
    notes: "Allstate direct digital auto brand.",
  },
  {
    name: "Root Insurance",
    category: "Auto insurer",
    coverage: "Multi-state",
    headquarters: "Columbus, OH",
    website: "joinroot.com",
    phone: "866-980-9431",
    notes: "App-based telematics pricing model.",
  },
  {
    name: "Tesla Insurance",
    category: "Auto insurer",
    coverage: "AZ, CA, CO, IL, MD, MN, NV, OH, OR, TX, UT, VA",
    headquarters: "Austin, TX",
    website: "tesla.com/insurance",
    notes: "EV-focused underwriting in select states.",
  },
  {
    name: "Bristol West",
    category: "Auto insurer",
    coverage: "Nationwide",
    headquarters: "Davie, FL",
    website: "bristolwest.com",
    phone: "800-274-7865",
    notes: "Farmers specialty non-standard auto brand.",
  },
  {
    name: "The General",
    category: "Auto insurer",
    coverage: "Multi-state",
    headquarters: "Nashville, TN",
    website: "thegeneral.com",
    phone: "800-280-1466",
    notes: "Sentry Insurance non-standard auto brand.",
  },
  {
    name: "Kemper Auto",
    category: "Auto insurer",
    coverage: "Nationwide",
    headquarters: "Chicago, IL",
    website: "kemper.com",
    phone: "866-536-5505",
    notes: "Specialty and preferred auto programs.",
  },
  {
    name: "Clearcover",
    category: "Auto insurer",
    coverage: "Multi-state",
    headquarters: "Chicago, IL",
    website: "clearcover.com",
    phone: "855-809-9541",
    notes: "Digital-first auto insurance startup.",
  },
];

export const HEALTH_CARE_US: UsProviderRecord[] = [
  {
    name: "UnitedHealthcare",
    category: "Health insurer",
    coverage: "Nationwide",
    headquarters: "Minnetonka, MN",
    website: "uhc.com",
    phone: "877-842-3210",
    notes: "UnitedHealth Group; largest US commercial health insurer.",
  },
  {
    name: "Elevance Health (Anthem)",
    category: "Health insurer",
    coverage: "Multi-state",
    headquarters: "Indianapolis, IN",
    website: "elevancehealth.com",
    phone: "800-676-2583",
    notes: "Blue Cross Blue Shield licensee in 14 states.",
  },
  {
    name: "Aetna",
    category: "Health insurer",
    coverage: "Nationwide",
    headquarters: "Hartford, CT",
    website: "aetna.com",
    phone: "800-872-3862",
    notes: "CVS Health company; medical and pharmacy benefits.",
  },
  {
    name: "Cigna Healthcare",
    category: "Health insurer",
    coverage: "Nationwide",
    headquarters: "Bloomfield, CT",
    website: "cigna.com",
    phone: "800-997-1654",
    notes: "Employer, individual, and global health plans.",
  },
  {
    name: "Humana",
    category: "Health insurer",
    coverage: "Nationwide",
    headquarters: "Louisville, KY",
    website: "humana.com",
    phone: "800-457-4708",
    notes: "Strong Medicare Advantage and pharmacy focus.",
  },
  {
    name: "Kaiser Permanente",
    category: "Integrated health system",
    coverage: "CA, CO, GA, HI, MD, OR, VA, WA, DC",
    headquarters: "Oakland, CA",
    website: "kaiserpermanente.org",
    phone: "800-464-4000",
    notes: "Integrated care and insurance model.",
  },
  {
    name: "Blue Cross Blue Shield",
    category: "Health insurer network",
    coverage: "Nationwide",
    headquarters: "Chicago, IL",
    website: "bcbs.com",
    phone: "888-630-2583",
    notes: "Federation of 34 independent BCBS companies.",
  },
  {
    name: "Molina Healthcare",
    category: "Health insurer",
    coverage: "Multi-state",
    headquarters: "Long Beach, CA",
    website: "molinahealthcare.com",
    phone: "800-665-0898",
    notes: "Medicaid and Marketplace plans in 19+ states.",
  },
  {
    name: "Centene",
    category: "Health insurer",
    coverage: "Multi-state",
    headquarters: "St. Louis, MO",
    website: "centene.com",
    phone: "800-225-8016",
    notes: "Government-sponsored and Marketplace health plans.",
  },
  {
    name: "Oscar Health",
    category: "Health insurer",
    coverage: "Multi-state",
    headquarters: "New York, NY",
    website: "hioscar.com",
    phone: "855-672-2788",
    notes: "Tech-forward individual and small group plans.",
  },
  {
    name: "Medicare",
    category: "Federal health program",
    coverage: "Nationwide",
    headquarters: "Baltimore, MD",
    website: "medicare.gov",
    phone: "800-633-4227",
    notes: "US federal health insurance for 65+ and eligible disabilities.",
  },
  {
    name: "Medicaid",
    category: "Federal-state health program",
    coverage: "Nationwide",
    headquarters: "Washington, DC",
    website: "medicaid.gov",
    phone: "877-267-2323",
    notes: "State-administered coverage for low-income individuals.",
  },
  {
    name: "CVS Caremark",
    category: "Pharmacy benefits",
    coverage: "Nationwide",
    headquarters: "Woonsocket, RI",
    website: "caremark.com",
    phone: "800-552-8159",
    notes: "Pharmacy benefit manager under CVS Health.",
  },
  {
    name: "Express Scripts",
    category: "Pharmacy benefits",
    coverage: "Nationwide",
    headquarters: "St. Louis, MO",
    website: "express-scripts.com",
    phone: "800-282-2881",
    notes: "Cigna-owned pharmacy benefit manager.",
  },
  {
    name: "Optum Rx",
    category: "Pharmacy benefits",
    coverage: "Nationwide",
    headquarters: "Minnetonka, MN",
    website: "optum.com",
    phone: "800-356-3477",
    notes: "UnitedHealth Group pharmacy and care services.",
  },
  {
    name: "Health Care Service Corporation",
    category: "Health insurer",
    coverage: "IL, MT, NM, OK, TX",
    headquarters: "Chicago, IL",
    website: "hcsc.com",
    phone: "800-654-7385",
    notes: "Operates BCBS plans in five states.",
  },
  {
    name: "Highmark",
    category: "Health insurer",
    coverage: "PA, WV, DE, NY",
    headquarters: "Pittsburgh, PA",
    website: "highmark.com",
    phone: "800-342-5430",
    notes: "BCBS affiliate in the Northeast.",
  },
  {
    name: "Florida Blue",
    category: "Health insurer",
    coverage: "FL",
    headquarters: "Jacksonville, FL",
    website: "floridablue.com",
    phone: "800-352-2583",
    notes: "Blue Cross Blue Shield of Florida.",
  },
  {
    name: "Blue Shield of California",
    category: "Health insurer",
    coverage: "CA",
    headquarters: "Oakland, CA",
    website: "blueshieldca.com",
    phone: "800-393-6130",
    notes: "Major California nonprofit health plan.",
  },
  {
    name: "Regence BlueCross BlueShield",
    category: "Health insurer",
    coverage: "ID, OR, UT, WA",
    headquarters: "Portland, OR",
    website: "regence.com",
    phone: "888-675-6570",
    notes: "Pacific Northwest BCBS plans.",
  },
  {
    name: "Independence Blue Cross",
    category: "Health insurer",
    coverage: "PA, NJ",
    headquarters: "Philadelphia, PA",
    website: "ibx.com",
    phone: "800-275-2583",
    notes: "Southeastern Pennsylvania regional BCBS.",
  },
  {
    name: "Ambetter",
    category: "Health insurer",
    coverage: "Multi-state",
    headquarters: "St. Louis, MO",
    website: "ambetterhealth.com",
    phone: "877-687-1196",
    notes: "Centene Marketplace health plan brand.",
  },
  {
    name: "Bright Health",
    category: "Health insurer",
    coverage: "Multi-state",
    headquarters: "Minneapolis, MN",
    website: "brighthealthcare.com",
    notes: "Individual and Medicare Advantage markets.",
  },
  {
    name: "Tricare",
    category: "Military health program",
    coverage: "Nationwide",
    headquarters: "Falls Church, VA",
    website: "tricare.mil",
    phone: "800-538-9552",
    notes: "US military service members and family health program.",
  },
  {
    name: "Veterans Health Administration (VA)",
    category: "Federal health system",
    coverage: "Nationwide",
    headquarters: "Washington, DC",
    website: "va.gov/health",
    phone: "800-698-2411",
    notes: "VA medical centers and benefits for eligible veterans.",
  },
];

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchesProvider(
  provider: UsProviderRecord,
  tokens: string[],
  stateFilter?: string,
) {
  const haystack = normalizeSearchText(
    [
      provider.name,
      provider.category,
      provider.coverage,
      provider.headquarters,
      provider.notes,
      provider.website,
    ]
      .filter(Boolean)
      .join(" "),
  );

  if (stateFilter) {
    const coverage = provider.coverage.toUpperCase();
    const inState =
      coverage.includes("NATIONWIDE") ||
      coverage.includes(stateFilter) ||
      coverage
        .split(",")
        .some((part) => part.trim().toUpperCase() === stateFilter);

    if (!inState) return false;
  }

  return tokens.every((token) => haystack.includes(token));
}

function searchDirectory(
  query: string,
  directory: UsProviderRecord[],
  emptyMessage: string,
): UsProviderSearchResult {
  const trimmed = query.trim();

  if (trimmed.length < 2) {
    throw new Error(emptyMessage);
  }

  const upper = trimmed.toUpperCase();
  const stateFilter = US_STATE_CODES.has(upper) ? upper : undefined;
  const tokens = normalizeSearchText(trimmed).split(" ").filter(Boolean);

  const providers = directory.filter((provider) =>
    matchesProvider(provider, tokens, stateFilter),
  );

  return {
    query: trimmed,
    count: providers.length,
    providers: providers.slice(0, 25),
  };
}

export function searchCarInsuranceUs(query: string): UsProviderSearchResult {
  return searchDirectory(
    query,
    CAR_INSURANCE_US,
    "Enter an insurer name (e.g. GEICO), keyword (Medicare), or US state code (e.g. TX).",
  );
}

export function searchHealthCareUs(query: string): UsProviderSearchResult {
  return searchDirectory(
    query,
    HEALTH_CARE_US,
    "Enter a health plan name (e.g. Aetna), keyword (Medicare), or US state code (e.g. FL).",
  );
}
