import type { ParsedPublicQuery, ParsedUsQuery } from "@/lib/us-records/types";

const US_STATES = new Set([
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "DC",
]);

const COUNTRY_CODES = new Set([
  "US", "GB", "UK", "CA", "AU", "DE", "FR", "IN", "MX", "BR", "JP", "SG", "NZ",
  "IE", "NL", "SE", "CH", "ZA", "AE", "IL", "KR", "EU", "CN", "RU", "IT", "ES",
]);

const DOB_RE =
  /\b(0?[1-9]|1[0-2])[\/\-.](0?[1-9]|[12]\d|3[01])[\/\-.]((19|20)\d{2})\b/;
const CASE_RE =
  /\b(\d{1,2}:\d{2}-(?:cv|cr|md|misc|bk)-\d{1,7}|\d{1,2}-\w{2}-\d{3,7}|\w{2,6}-\d{2,4}-\d{3,7})\b/i;
const ZIP_RE = /\b(\d{5})(?:-\d{4})?\b/;
const COUNTY_RE = /\b([A-Za-z][A-Za-z\s.'-]{1,40}?)\s+County\b/i;
const CITY_SUFFIX_RE = /\b([A-Za-z][A-Za-z\s.'-]{1,40}?)\s+City\b/i;

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function parseUsRecordsQuery(query: string): ParsedPublicQuery {
  const raw = query.trim().replace(/\s+/g, " ");
  if (!raw) {
    return { raw: "", mode: "raw" };
  }

  const caseMatch = raw.match(CASE_RE);
  if (caseMatch && raw.length < 48) {
    return {
      raw,
      caseNumber: caseMatch[1].toUpperCase(),
      mode: "case",
    };
  }

  let working = raw;
  let dob: string | undefined;
  const dobMatch = working.match(DOB_RE);
  if (dobMatch) {
    const month = dobMatch[1].padStart(2, "0");
    const day = dobMatch[2].padStart(2, "0");
    dob = `${month}/${day}/${dobMatch[3]}`;
    working = working.replace(dobMatch[0], " ").replace(/\s+/g, " ").trim();
  }

  let zip: string | undefined;
  const zipMatch = working.match(ZIP_RE);
  if (zipMatch) {
    zip = zipMatch[1];
    working = working.replace(zipMatch[0], " ").replace(/\s+/g, " ").trim();
  }

  let county: string | undefined;
  const countyMatch = working.match(COUNTY_RE);
  if (countyMatch) {
    county = `${titleCase(countyMatch[1])} County`;
    working = working.replace(countyMatch[0], " ").replace(/\s+/g, " ").trim();
  }

  let city: string | undefined;
  const cityMatch = working.match(CITY_SUFFIX_RE);
  if (cityMatch) {
    // VSP registry uses County/Independent City dropdown values like "RICHMOND CITY"
    county = county || `${titleCase(cityMatch[1])} City`;
    city = titleCase(cityMatch[1]);
    working = working.replace(cityMatch[0], " ").replace(/\s+/g, " ").trim();
  }

  let state: string | undefined;
  let country: string | undefined;
  const commaParts = working.split(",").map((part) => part.trim()).filter(Boolean);
  if (commaParts.length >= 2) {
    const trailing = commaParts[commaParts.length - 1].toUpperCase();
    if (US_STATES.has(trailing)) {
      state = trailing;
      country = "US";
      working = commaParts.slice(0, -1).join(" ").trim();
    } else if (COUNTRY_CODES.has(trailing)) {
      country = trailing === "UK" ? "GB" : trailing;
      working = commaParts.slice(0, -1).join(" ").trim();
    } else if (!county && !city && commaParts.length >= 2) {
      // "John Smith, Fairfax" → treat trailing token as county/city locality
      const locality = commaParts[commaParts.length - 1];
      if (/county/i.test(locality)) {
        county = titleCase(locality.replace(/\s+county$/i, "")) + " County";
      } else {
        county = `${titleCase(locality)} County`;
      }
      working = commaParts.slice(0, -1).join(" ").trim();
    }
  } else {
    const tokens = working.split(" ");
    const last = tokens[tokens.length - 1]?.toUpperCase();
    if (last && US_STATES.has(last) && tokens.length >= 2) {
      state = last;
      country = "US";
      working = tokens.slice(0, -1).join(" ").trim();
    } else if (last && COUNTRY_CODES.has(last) && tokens.length >= 2) {
      country = last === "UK" ? "GB" : last;
      working = tokens.slice(0, -1).join(" ").trim();
    }
  }

  if (!country && state) country = "US";

  // Default VA when locality looks like Virginia county search without ST code
  if (!state && (county || city || zip)) {
    state = "VA";
  }

  working = working.replace(/,/g, " ").replace(/\s+/g, " ").trim();

  const nameTokens = working.split(/\s+/).filter(Boolean);
  if (nameTokens.length === 0) {
    return {
      raw,
      state,
      country,
      county,
      city,
      zip,
      dob,
      mode: dob || state || county || zip ? "person" : "raw",
    };
  }

  const fullName = titleCase(nameTokens.join(" "));
  const firstName = nameTokens.length > 1 ? titleCase(nameTokens[0]) : undefined;
  const lastName =
    nameTokens.length > 1
      ? titleCase(nameTokens.slice(1).join(" "))
      : titleCase(nameTokens[0]);

  return {
    raw,
    fullName,
    firstName,
    lastName,
    state,
    country,
    county,
    city,
    zip,
    dob,
    mode: "person",
  };
}

export const parsePublicRecordsQuery = parseUsRecordsQuery;

export function assertUsQuery(query: string): string {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    throw new Error(
      "Enter a name (e.g. John Doe, VA or John Doe, GB), locality, DOB, or case number.",
    );
  }
  return trimmed;
}
