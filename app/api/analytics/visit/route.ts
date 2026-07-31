import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VISIT_COOKIE = "sv_day";

function utcDayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function visitCookieOptions() {
  const secure =
    process.env.COOKIE_SECURE === "true" ||
    (process.env.COOKIE_SECURE !== "false" &&
      process.env.NODE_ENV === "production");

  // Expire roughly at next UTC midnight so refresh spam within a day is ignored.
  const now = new Date();
  const nextMidnight = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
  );
  const maxAge = Math.max(
    60,
    Math.floor((nextMidnight - now.getTime()) / 1000),
  );

  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export async function POST(request: NextRequest) {
  const dayKey = utcDayKey();
  const already = request.cookies.get(VISIT_COOKIE)?.value;

  if (already === dayKey) {
    const response = NextResponse.json({
      ok: true,
      counted: false,
      date: dayKey,
    });

    response.cookies.set(VISIT_COOKIE, dayKey, visitCookieOptions());

    return response;
  }

  try {
    await prisma.siteVisitDaily.upsert({
      where: { date: dayKey },
      create: { date: dayKey, count: 1 },
      update: { count: { increment: 1 } },
    });
  } catch (error) {
    console.error("site visit increment failed:", error);

    return NextResponse.json(
      { error: "Could not record visit" },
      { status: 500 },
    );
  }

  const response = NextResponse.json({
    ok: true,
    counted: true,
    date: dayKey,
  });

  response.cookies.set(VISIT_COOKIE, dayKey, visitCookieOptions());

  return response;
}
