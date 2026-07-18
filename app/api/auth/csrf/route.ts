import { NextResponse } from "next/server";

import {
  CSRF_COOKIE_NAME,
  csrfCookieOptions,
  generateCsrfToken,
} from "@/lib/csrf";

/** Issue (or refresh) the double-submit CSRF cookie for browser clients. */
export async function GET() {
  const token = generateCsrfToken();
  const response = NextResponse.json({
    ok: true,
    csrfToken: token,
  });

  response.cookies.set(CSRF_COOKIE_NAME, token, csrfCookieOptions());
  response.headers.set("Cache-Control", "private, no-store, max-age=0");

  return response;
}
