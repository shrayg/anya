import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";
import { fetchCsintIpLookup } from "@/lib/csint";
import { fetchBreachHubSpecialty } from "@/lib/breachhub";
import {
  canContributeOathnet,
  fetchOathnetSanitized,
} from "@/lib/oathnet";
import { fetchCombinedOsintCatEndpoint } from "@/lib/osint-combined";
import { normalizeIpSearchPayload } from "@/lib/ip-search";
import {
  OSINT_ROUTE_DEADLINE_MS,
  osintFailureResponse,
  withDeadline,
} from "@/lib/osint-search-guard";

export async function GET(req: NextRequest) {
  const access = await requireOsintAccess(req, "ip");

  if (access instanceof NextResponse) return access;

  const query = req.nextUrl.searchParams.get("query")?.trim();

  if (!query) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  try {
    const includeOathnet = canContributeOathnet(access.plan);
    const [data, csintIp, breachHubIp, oathnetIp] = await withDeadline(
      Promise.all([
        fetchCombinedOsintCatEndpoint("ip", query, "ip", "ip").catch(
          () => null,
        ),
        fetchCsintIpLookup(query).catch(() => null),
        fetchBreachHubSpecialty("ip", query).catch(() => null),
        includeOathnet
          ? fetchOathnetSanitized(
              { kind: "static", endpoint: "ip-info" },
              { ip: query, query },
            ).catch(() => null)
          : Promise.resolve(null),
      ]),
      OSINT_ROUTE_DEADLINE_MS,
    );

    const oathnetHits =
      oathnetIp && oathnetIp.count > 0
        ? { count: oathnetIp.count, results: oathnetIp.results }
        : null;

    if (data) {
      const payload = normalizeIpSearchPayload(data);

      return NextResponse.json({
        ...payload,
        ...(csintIp ? { enrichment: csintIp } : {}),
        ...(breachHubIp && breachHubIp.count > 0
          ? { indexHits: breachHubIp }
          : {}),
        ...(oathnetHits ? { oathnet: oathnetHits } : {}),
      });
    }

    if (csintIp || (breachHubIp && breachHubIp.count > 0) || oathnetHits) {
      return NextResponse.json({
        query,
        ...(csintIp ? { enrichment: csintIp } : {}),
        ...(breachHubIp && breachHubIp.count > 0
          ? { indexHits: breachHubIp }
          : {}),
        ...(oathnetHits ? { oathnet: oathnetHits } : {}),
        sources: ["index"],
      });
    }

    return NextResponse.json({
      query,
      message: "Nothing found for this IP.",
    });
  } catch (err) {
    try {
      const csintIp = await fetchCsintIpLookup(query);

      if (csintIp) {
        return NextResponse.json({
          query,
          enrichment: csintIp,
          sources: ["index"],
        });
      }
    } catch {
      // ignore secondary failure
    }

    return osintFailureResponse(err, {
      softEmpty: { query, message: "IP lookup timed out or failed." },
    });
  }
}
