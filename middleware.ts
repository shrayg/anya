import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

import {
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  csrfCookieOptions,
  csrfTokensMatch,
  generateCsrfToken,
  isCsrfExemptPath,
  isMutatingMethod,
} from "@/lib/csrf";

function getJwtKey() {
  const secret = process.env.JWT_SECRET?.trim();

  if (secret && secret !== "change-me" && secret !== "super-secret-jwt-key") {
    return new TextEncoder().encode(secret);
  }

  if (process.env.NODE_ENV === "production") {
    return null;
  }

  return new TextEncoder().encode(secret || "dev-only-jwt-secret");
}

function stripFingerprintHeaders(response: NextResponse) {
  response.headers.delete("x-powered-by");
  response.headers.delete("X-Powered-By");
  // Best-effort: Next may re-add some of these later in the pipeline.
  for (const key of [
    "x-nextjs-cache",
    "x-nextjs-matched-path",
    "x-nextjs-page",
    "x-middleware-rewrite",
  ]) {
    response.headers.delete(key);
  }

  return response;
}

function withCsrfCookie(
  request: NextRequest,
  response: NextResponse,
): NextResponse {
  const existing = request.cookies.get(CSRF_COOKIE_NAME)?.value;

  if (!existing) {
    response.cookies.set(
      CSRF_COOKIE_NAME,
      generateCsrfToken(),
      csrfCookieOptions(),
    );
  }

  return stripFingerprintHeaders(response);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;
  const isApi = pathname.startsWith("/api/");
  const isOsintApi = pathname.startsWith("/api/osint/");
  const isDashboard = pathname.startsWith("/dashboard");
  const isAccountPage = pathname === "/account" || pathname.startsWith("/account/");
  const needsSession = isDashboard || isOsintApi || isAccountPage;

  // --- CSRF for state-changing /api/* (except signed webhooks / cron) ---
  if (isApi && isMutatingMethod(method) && !isCsrfExemptPath(pathname)) {
    const cookieToken = request.cookies.get(CSRF_COOKIE_NAME)?.value;
    const headerToken = request.headers.get(CSRF_HEADER_NAME);

    if (!csrfTokensMatch(cookieToken, headerToken)) {
      return stripFingerprintHeaders(
        NextResponse.json(
          { error: "Invalid or missing CSRF token" },
          { status: 403 },
        ),
      );
    }
  }

  // Issue CSRF cookie on safe navigations / reads so forms can submit later.
  if (!isApi || !isMutatingMethod(method)) {
    const passthrough = withCsrfCookie(request, NextResponse.next());

    // Auth gate for dashboard, account page, and OSINT APIs.
    if (!needsSession) {
      return passthrough;
    }

    const token = request.cookies.get("session")?.value;
    const key = getJwtKey();

    if (!token || !key) {
      if (isOsintApi) {
        return stripFingerprintHeaders(
          NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
        );
      }

      // Prefer marketing home over login when session is missing/expired
      // (e.g. browser restores a /dashboard* tab after close).
      const loginTarget = isAccountPage ? "/auth?action=login" : "/";
      return stripFingerprintHeaders(
        NextResponse.redirect(new URL(loginTarget, request.url)),
      );
    }

    try {
      await jwtVerify(token, key, { algorithms: ["HS256"] });

      return passthrough;
    } catch {
      if (isOsintApi) {
        return stripFingerprintHeaders(
          NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
        );
      }

      const loginTarget = isAccountPage ? "/auth?action=login" : "/";
      return stripFingerprintHeaders(
        NextResponse.redirect(new URL(loginTarget, request.url)),
      );
    }
  }

  // Mutating API that passed CSRF — still enforce OSINT session if needed.
  if (isOsintApi) {
    const token = request.cookies.get("session")?.value;
    const key = getJwtKey();

    if (!token || !key) {
      return stripFingerprintHeaders(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      );
    }

    try {
      await jwtVerify(token, key, { algorithms: ["HS256"] });
    } catch {
      return stripFingerprintHeaders(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      );
    }
  }

  return withCsrfCookie(request, NextResponse.next());
}

export const config = {
  matcher: [
    /*
     * Run on app routes + APIs so we can mint CSRF cookies and enforce
     * CSRF on mutations. Skip static assets and Next internals.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|xml|woff2?)$).*)",
  ],
};
