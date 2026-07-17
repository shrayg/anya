/**
 * Live smoke tests for new public-records adapters + backlog wiring.
 * Usage: npx tsx scripts/test-new-court-adapters.mts
 */
import { searchBopInmateLocator } from "../lib/us-records/bop-inmate.ts";
import { searchDeCourtConnect } from "../lib/us-records/de-courtconnect.ts";
import {
  searchPortalBacklogDirectory,
  searchUsCourt,
  searchUsIdentity,
} from "../lib/us-records/orchestrator.ts";
import { PORTAL_BACKLOG } from "../lib/us-records/portal-backlog.ts";
import { parseUsRecordsQuery } from "../lib/us-records/query-parse.ts";

async function main() {
  console.log("PORTAL_BACKLOG size", PORTAL_BACKLOG.length);
  console.log(
    "live/candidate",
    PORTAL_BACKLOG.filter(
      (r) => r.liveStatus === "live" || r.liveStatus === "candidate",
    ).length,
  );

  const deParsed = parseUsRecordsQuery("John Smith, DE");
  try {
    const de = await searchDeCourtConnect(deParsed, 5);
    console.log(
      "\nDE CourtConnect",
      de.length,
      de.slice(0, 2).map((h) => ({ docket: h.docketNumber, name: h.caseName })),
    );
  } catch (err) {
    console.log("\nDE ERR", err instanceof Error ? err.message : err);
  }

  const bopParsed = parseUsRecordsQuery("John Smith");
  try {
    const bop = await searchBopInmateLocator(bopParsed, 5);
    console.log(
      "\nBOP",
      bop.length,
      bop.slice(0, 2).map((h) => ({ name: h.name, sub: h.subtitle })),
    );
  } catch (err) {
    console.log("\nBOP ERR", err instanceof Error ? err.message : err);
  }

  const court = await searchUsCourt("John Smith, DE");
  console.log("\nsearchUsCourt DE", {
    cases: court.cases.length,
    portals: court.portals.length,
    sources: court.sources,
    errors: court.errors,
  });

  const md = await searchUsCourt("John Smith, MD");
  console.log("\nsearchUsCourt MD (portal routing)", {
    cases: md.cases.length,
    portals: md.portals.slice(0, 5).map((p) => p.title),
    errors: md.errors,
  });

  const fl = await searchUsCourt("John Smith, FL");
  console.log("\nsearchUsCourt FL", {
    portals: fl.portals.slice(0, 6).map((p) => p.title),
  });

  const backlog = await searchPortalBacklogDirectory("John Smith, TX");
  console.log(
    "\nportal backlog",
    backlog.count,
    backlog.portals.slice(0, 5).map((p) => p.title),
  );

  const identity = await searchUsIdentity("John Smith");
  console.log("\nidentity", {
    people: identity.people.length,
    cases: identity.cases.length,
    bop: identity.people.filter((p) => p.source.id === "bop-inmate").length,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
