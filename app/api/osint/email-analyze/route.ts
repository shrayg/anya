import { NextRequest, NextResponse } from "next/server";

import { searchContactPresence } from "@/lib/email-presence";
import { searchIndexSweep } from "@/lib/index-sweep";
import { osintJson, requireOsintAccess } from "@/lib/osint-api-auth";
import { fetchCsintEmailAnalyze } from "@/lib/csint";
import {
  OSINT_ROUTE_DEADLINE_MS,
  osintFailureResponse,
  withDeadline,
} from "@/lib/osint-search-guard";
import { normalizeEmail } from "@/lib/proxynova-comb";
import { publicSearchError } from "@/lib/public-branding";
import { fetchSeekriaSanitized, isSeekriaEnabled } from "@/lib/seekria";
import { fetchSeekNowSanitized, isSeekNowEnabled } from "@/lib/seeknow";

async function settled<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch {
    return null;
  }
}

/**
 * Email Analyzer fan-out — every tool wired on the Email Analyzer module:
 * AI brief (CSINT), Contact Profiles, Index Sweep, Seekria email OSINT,
 * SeekNow email check.
 */
export async function GET(req: NextRequest) {
  const access = await requireOsintAccess(req, "email-analyze");

  if (access instanceof NextResponse) return access;

  const query = req.nextUrl.searchParams.get("query")?.trim();

  if (!query) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  const email = normalizeEmail(query);

  if (!email) {
    return NextResponse.json(
      { error: "Enter a valid email address." },
      { status: 400 },
    );
  }

  try {
    const [
      brief,
      contactProfiles,
      indexSweep,
      seekriaEmailOsint,
      seeknowEmailCheck,
    ] = await withDeadline(
      Promise.all([
        settled(fetchCsintEmailAnalyze(email)),
        settled(searchContactPresence({ query: email })),
        settled(
          searchIndexSweep({ query: email, liveProbe: true, kind: "email" }),
        ),
        isSeekriaEnabled()
          ? settled(fetchSeekriaSanitized("email-osint", email))
          : Promise.resolve(null),
        isSeekNowEnabled()
          ? settled(
              fetchSeekNowSanitized("network/email-check", { email }),
            )
          : Promise.resolve(null),
      ]),
      OSINT_ROUTE_DEADLINE_MS,
    );

    const hasBrief = brief != null && typeof brief === "object";
    const hasPresence = contactProfiles != null;
    const hasSweep = indexSweep != null;
    const hasSeekria = seekriaEmailOsint != null;
    const hasSeeknow = seeknowEmailCheck != null;

    const anyHit =
      hasBrief ||
      (hasPresence &&
        (contactProfiles.count > 0 || contactProfiles.checked > 0)) ||
      (hasSweep &&
        ((indexSweep.hits?.length ?? 0) > 0 ||
          (indexSweep.locations?.length ?? 0) > 0 ||
          (indexSweep.dorks?.length ?? 0) > 0)) ||
      (hasSeekria && seekriaEmailOsint.count > 0) ||
      (hasSeeknow && seeknowEmailCheck.count > 0);

    if (!anyHit) {
      throw new Error(publicSearchError("No results from intelligence indexes."));
    }

    return osintJson(access, {
      email,
      source: "email-analyze",
      sources: {
        brief: hasBrief ? brief : null,
        contactProfiles: hasPresence ? contactProfiles : null,
        indexSweep: hasSweep ? indexSweep : null,
        seekriaEmailOsint: hasSeekria ? seekriaEmailOsint : null,
        seeknowEmailCheck: hasSeeknow ? seeknowEmailCheck : null,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : publicSearchError();

    return osintFailureResponse(
      err instanceof Error ? err : new Error(String(message)),
    );
  }
}
