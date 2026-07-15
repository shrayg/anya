import type { ParsedUsQuery } from "@/lib/us-records/types";

const US_STATES = new Set([
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "DC",
]);

const DOB_RE =
  /\b(0?[1-9]|1[0-2])[\/\-.](0?[1-9]|[12]\d|3[01])[\/\-.]((19|20)\d{2})\b/;
const CASE_RE =
  /\b(\d{1,2}:\d{2}-(?:cv|cr|md|misc|bk)-\d{1,7}|\d{1,2}-\w{2}-\d{3,7}|\w{2,6}-\d{2,4}-\d{3,7})\b/i;

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function parseUsRecordsQuery(query: string): ParsedUsQuery {
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

  let state: string | undefined;
  const commaParts = working.split(",").map((part) => part.trim()).filter(Boolean);
  if (commaParts.length >= 2) {
    const maybeState = commaParts[commaParts.length - 1].toUpperCase();
    if (US_STATES.has(maybeState)) {
      state = maybeState;
      working = commaParts.slice(0, -1).join(" ").trim();
    }
  } else {
    const tokens = working.split(" ");
    const last = tokens[tokens.length - 1]?.toUpperCase();
    if (last && US_STATES.has(last) && tokens.length >= 2) {
      state = last;
      working = tokens.slice(0, -1).join(" ").trim();
    }
  }

  const nameTokens = working.split(/\s+/).filter(Boolean);
  if (nameTokens.length === 0) {
    return { raw, state, dob, mode: dob || state ? "person" : "raw" };
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
    dob,
    mode: "person",
  };
}

export function assertUsQuery(query: string): string {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    throw new Error("Enter a name (e.g. John Doe, CA), DOB, or case number.");
  }
  return trimmed;
}
