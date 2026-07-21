import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";
import {
  fetchNotaliveXRenaper,
  isNotaliveXEnabled,
  parseRenaperQuery,
} from "@/lib/notalivex";
import {
  OSINT_ROUTE_DEADLINE_MS,
  osintFailureResponse,
  withDeadline,
} from "@/lib/osint-search-guard";
import { publicServiceUnavailable } from "@/lib/public-branding";

/**
 * Argentina RENAPER national registry via NotaliveX / BreachHub.
 *   GET /api/notalivex/ar_rena/renaper?dni=&sexo=
 * Also accepts query="12345678 M" when dni/sexo are omitted.
 */
export async function GET(req: NextRequest) {
  const access = await requireOsintAccess(req, "notalivex/ar_rena/renaper");

  if (access instanceof NextResponse) return access;

  if (!isNotaliveXEnabled()) {
    return NextResponse.json(
      { error: publicServiceUnavailable() },
      { status: 503 },
    );
  }

  const params = req.nextUrl.searchParams;
  let dni = params.get("dni")?.trim() ?? "";
  let sexo = params.get("sexo")?.trim() ?? "";
  const query = params.get("query")?.trim() ?? "";

  if ((!dni || !sexo) && query) {
    const parsed = parseRenaperQuery(query);

    if (parsed) {
      dni = parsed.dni;
      sexo = parsed.sexo;
    }
  }

  if (!dni || !sexo) {
    return NextResponse.json(
      {
        error:
          "Missing dni and sexo (M|F). Example: ?dni=12345678&sexo=M or query=12345678 M",
      },
      { status: 400 },
    );
  }

  try {
    const data = await withDeadline(
      fetchNotaliveXRenaper(dni, sexo),
      OSINT_ROUTE_DEADLINE_MS,
    );

    if (!data || data.count === 0) {
      return NextResponse.json({
        count: 0,
        results: [],
        dni: data?.dni ?? dni,
        sexo: data?.sexo ?? sexo.toUpperCase(),
        message: "No results were found.",
      });
    }

    return NextResponse.json(data);
  } catch (err) {
    return osintFailureResponse(err, {
      softEmpty: {
        count: 0,
        results: [],
        dni,
        sexo: sexo.toUpperCase(),
      },
    });
  }
}
