import fs from "node:fs";

const src = fs.readFileSync(
  "C:/Users/Shray/.cursor/projects/c-Users-Shray-Documents-anya/canvases/public-record-portal-catalog.canvas.tsx",
  "utf8",
);

const re =
  /\{\s*j:\s*"([^"]+)",\s*c:\s*"([^"]+)",\s*n:\s*"([^"]+)",\s*u:\s*"([^"]+)",\s*s:\s*"([^"]+)",\s*a:\s*"([^"]+)",\s*d:\s*"([^"]+)",\s*note:\s*"([^"]*)",\s*p:\s*"([^"]+)"\s*\}/g;

const rows = [...src.matchAll(re)].map((m) => ({
  jurisdiction: m[1],
  category: m[2],
  name: m[3],
  url: m[4],
  searchType: m[5],
  approach: m[6],
  difficulty: m[7],
  notes: m[8],
  priority: m[9],
  liveStatus:
    m[7] === "blocked"
      ? "blocked"
      : m[7] === "easy"
        ? "candidate"
        : "portal_only",
}));

console.log("parsed", rows.length);

const liveOverrides: Record<string, string> = {
  "Federal Bureau of Prisons Inmate Locator": "live",
  "Delaware CourtConnect": "live",
  "Virginia OCIS": "live",
};

for (const row of rows) {
  if (liveOverrides[row.name]) row.liveStatus = liveOverrides[row.name];
}

const header = `/**
 * Prioritized government portal backlog for live-adapter targeting.
 * Generated from the research catalog — extend adapters one portal at a time.
 */

export type PortalBacklogCategory =
  | "court_cases"
  | "criminal_history"
  | "sex_offender"
  | "warrants"
  | "inmate"
  | "sanctions"
  | "corporate"
  | "property"
  | "vital"
  | "professional_license"
  | "other";

export type PortalBacklogEntry = {
  jurisdiction: string;
  category: PortalBacklogCategory;
  name: string;
  url: string;
  searchType: string;
  approach: string;
  difficulty: "easy" | "medium" | "hard" | "blocked";
  notes: string;
  priority: "P0" | "P1" | "P2" | "P3";
  liveStatus: "live" | "candidate" | "portal_only" | "blocked";
};

export const PORTAL_BACKLOG: PortalBacklogEntry[] = `;

const footer = `;

export function filterPortalBacklog(options?: {
  priority?: Array<"P0" | "P1" | "P2" | "P3">;
  category?: PortalBacklogCategory;
  stateHint?: string;
  liveOnly?: boolean;
  limit?: number;
}): PortalBacklogEntry[] {
  const priorities = options?.priority ?? ["P0", "P1", "P2", "P3"];
  const limit = options?.limit ?? 200;
  const hint = options?.stateHint?.toLowerCase();
  return PORTAL_BACKLOG.filter((row) => priorities.includes(row.priority))
    .filter((row) => !options?.category || row.category === options.category)
    .filter((row) => !options?.liveOnly || row.liveStatus === "live")
    .filter((row) => !hint || row.jurisdiction.toLowerCase().includes(hint))
    .slice(0, limit);
}
`;

fs.writeFileSync(
  "lib/us-records/portal-backlog.ts",
  header + JSON.stringify(rows, null, 2) + footer,
);
console.log("wrote lib/us-records/portal-backlog.ts");
