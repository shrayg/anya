import { NextRequest, NextResponse } from "next/server";

import { requireOsintAccess } from "@/lib/osint-api-auth";
import {
  OSINT_ROUTE_DEADLINE_MS,
  osintFailureResponse,
  withDeadline,
} from "@/lib/osint-search-guard";
import { publicServiceUnavailable } from "@/lib/public-branding";
import {
  fetchTelegramSanitized,
  isTelegramEnabled,
  isTelegramKind,
  isTelegramMode,
  normalizeTelegramUsername,
  type TelegramKind,
} from "@/lib/telegram";

export const maxDuration = 60;

type RouteParams = {
  params: Promise<{ kind: string }>;
};

/**
 * GET /api/telegram/{username|id|phone}?query=…
 *
 * Proxies Telegram OSINT (direct TELEGRAM_API_KEY or BreachHub).
 * Username also accepts `mode=basic|full` (default full) and t.me URLs.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { kind: rawKind } = await params;
  const kindRaw = rawKind?.trim().toLowerCase() ?? "";

  if (!isTelegramKind(kindRaw)) {
    return NextResponse.json(
      { error: "Unknown Telegram lookup. Use username, id, or phone." },
      { status: 404 },
    );
  }

  const kind = kindRaw as TelegramKind;
  const access = await requireOsintAccess(req, `telegram/${kind}`);

  if (access instanceof NextResponse) {
    if (access.status === 400) {
      const retry = await requireOsintAccess(req, "telegram");

      if (retry instanceof NextResponse) return retry;
    } else {
      return access;
    }
  }

  if (!isTelegramEnabled()) {
    return NextResponse.json(
      { error: publicServiceUnavailable() },
      { status: 503 },
    );
  }

  const sp = req.nextUrl.searchParams;
  const rawQuery =
    sp.get("query")?.trim() ||
    sp.get(kind)?.trim() ||
    (kind === "username"
      ? sp.get("username")?.trim() || sp.get("user")?.trim()
      : null) ||
    (kind === "id" ? sp.get("id")?.trim() || sp.get("tg_id")?.trim() : null) ||
    (kind === "phone"
      ? sp.get("phone")?.trim() || sp.get("telefono")?.trim()
      : null);

  if (!rawQuery) {
    return NextResponse.json({ error: "Missing query." }, { status: 400 });
  }

  const query =
    kind === "username" ? normalizeTelegramUsername(rawQuery) : rawQuery;

  if (!query) {
    return NextResponse.json({ error: "Missing query." }, { status: 400 });
  }

  if (kind === "phone") {
    const digits = query.replace(/\D/g, "");

    if (digits.length < 7 || digits.length > 15) {
      return NextResponse.json(
        { error: "Enter a valid phone number (7–15 digits)." },
        { status: 400 },
      );
    }
  }

  const modeRaw = sp.get("mode")?.trim() ?? null;

  if (modeRaw && kind === "username" && !isTelegramMode(modeRaw)) {
    return NextResponse.json(
      { error: "Invalid mode. Use basic or full." },
      { status: 400 },
    );
  }

  try {
    const data = await withDeadline(
      fetchTelegramSanitized(kind, query, modeRaw),
      OSINT_ROUTE_DEADLINE_MS,
    );

    if (data.count === 0) {
      return NextResponse.json({
        count: 0,
        results: [],
        query: data.query,
        kind: data.kind,
        mode: data.mode,
        source: data.source,
        message: "No results were found.",
      });
    }

    return NextResponse.json({
      count: data.count,
      results: data.results,
      query: data.query,
      kind: data.kind,
      mode: data.mode,
      source: data.source,
    });
  } catch (err) {
    return osintFailureResponse(err, {
      softEmpty: {
        count: 0,
        results: [],
        query,
        kind,
        mode:
          kind === "username" && modeRaw && isTelegramMode(modeRaw)
            ? modeRaw.trim().toLowerCase()
            : kind === "username"
              ? "full"
              : undefined,
      },
    });
  }
}
