import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";
import { fetchBreachHubSpecialty, isBreachHubEnabled } from "@/lib/breachhub";
import { fetchDiscordProfile } from "@/lib/discord-profile";
import {
  buildFivemSearchResult,
  fetchFivemIntel,
  fivemErrorMessage,
  fivemHasResults,
} from "@/lib/fivem-search";
import {
  publicServiceUnavailable,
  sanitizePublicText,
} from "@/lib/public-branding";
import { getGodsEyeApiKey } from "@/lib/godseye";
import { isDiscordSnowflake } from "@/lib/osintcat";
import { osintFailureResponse } from "@/lib/osint-search-guard";

export async function GET(req: NextRequest) {
  const access = await requireOsintAccess(req, "fivem");

  if (access instanceof NextResponse) return access;

  const query = req.nextUrl.searchParams.get("query")?.trim();

  if (!query) {
    return NextResponse.json(
      { error: "Missing query parameter" },
      { status: 400 },
    );
  }

  if (!isDiscordSnowflake(query)) {
    return NextResponse.json(
      { error: "Enter a valid Discord ID (17–20 digits)." },
      { status: 400 },
    );
  }

  const hasGodsEye = Boolean(getGodsEyeApiKey());
  const hasBreachHub = isBreachHubEnabled();

  if (!hasGodsEye && !hasBreachHub) {
    return NextResponse.json(
      {
        error: publicServiceUnavailable(),
        code: "MISSING_KEY",
      },
      { status: 503 },
    );
  }

  try {
    const [intel, profile, breachHub] = await Promise.all([
      hasGodsEye
        ? fetchFivemIntel(query)
        : Promise.resolve({
            searchData: null as null,
            records: [] as unknown[],
            warning: undefined as string | undefined,
          }),
      fetchDiscordProfile(query).catch(() => null),
      fetchBreachHubSpecialty("fivem", query).catch(() => null),
    ]);

    const bhRecords =
      breachHub && Array.isArray(breachHub.results) ? breachHub.results : [];
    const records =
      intel.records.length > 0
        ? intel.records
        : bhRecords.length > 0
          ? bhRecords
          : intel.records;

    const response = buildFivemSearchResult({
      discordId: query,
      searchData: intel.searchData,
      records,
      profile,
      warning: intel.warning,
    });

    if (!fivemHasResults(response) && bhRecords.length === 0) {
      const message = fivemErrorMessage(response);

      return NextResponse.json({
        ...response,
        message: message ? sanitizePublicText(message) : response.message,
        error: message ? sanitizePublicText(message) : response.message,
      });
    }

    return NextResponse.json(response);
  } catch (err) {
    const message = sanitizePublicText(
      err instanceof Error ? err.message : "Failed to resolve FiveM lookup",
    );

    return osintFailureResponse(
      err instanceof Error ? err : new Error(String(message)),
    );
  }
}
