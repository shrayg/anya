import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import "server-only";

function resolveJwtSecret() {
  const secret = process.env.JWT_SECRET?.trim();

  if (secret && secret !== "change-me" && secret !== "super-secret-jwt-key") {
    return secret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET must be set to a strong value in production");
  }

  return secret || "dev-only-jwt-secret";
}

function getKey() {
  return new TextEncoder().encode(resolveJwtSecret());
}

function shouldUseSecureCookies() {
  if (process.env.COOKIE_SECURE === "true") return true;
  if (process.env.COOKIE_SECURE === "false") return false;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  if (appUrl) {
    try {
      const hostname = new URL(appUrl).hostname;
      if (hostname === "localhost" || hostname === "127.0.0.1") {
        return false;
      }
    } catch {
      // ignore invalid URL values
    }

    return appUrl.startsWith("https://");
  }

  return process.env.NODE_ENV === "production";
}

/**
 * HttpOnly + Secure session cookie.
 * SameSite=Lax (not Strict) so Square/Cryptomus top-level return redirects
 * still attach the session. Cross-site POST abuse is mitigated via CSRF.
 */
export function sessionCookieOptions(expires: Date) {
  return {
    expires,
    httpOnly: true,
    secure: shouldUseSecureCookies(),
    sameSite: "lax" as const,
    path: "/",
  };
}

export type SessionPayload = {
  userId: number;
  isAdmin?: boolean;
  expires?: string;
};

export async function encrypt(payload: SessionPayload) {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(getKey());
}

export async function decrypt(input: string): Promise<SessionPayload> {
  const { payload } = await jwtVerify(input, getKey(), {
    algorithms: ["HS256"],
  });

  const userId = Number(payload.userId);
  if (!Number.isFinite(userId) || userId <= 0) {
    throw new Error("Invalid session payload");
  }

  return {
    userId,
    isAdmin: Boolean(payload.isAdmin),
    expires: typeof payload.expires === "string" ? payload.expires : undefined,
  };
}

export async function createSessionToken(userId: number, isAdmin: boolean) {
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const token = await encrypt({
    userId,
    isAdmin,
    expires: expires.toISOString(),
  });
  return { token, expires };
}

/** Attach session cookie directly to the Route Handler response (most reliable). */
export async function attachSessionCookie(
  response: NextResponse,
  userId: number,
  isAdmin: boolean,
) {
  const { token, expires } = await createSessionToken(userId, isAdmin);
  response.cookies.set("session", token, sessionCookieOptions(expires));
  return response;
}

export async function clearSessionCookie(response: NextResponse) {
  response.cookies.set("session", "", sessionCookieOptions(new Date(0)));
  return response;
}

/** @deprecated Prefer attachSessionCookie on the response in Route Handlers. */
export async function setSessionCookie(userId: number, isAdmin: boolean) {
  const { token, expires } = await createSessionToken(userId, isAdmin);
  const cookieStore = await cookies();
  cookieStore.set("session", token, sessionCookieOptions(expires));
}

export async function getSessionCookie() {
  const cookieStore = await cookies();
  const session = cookieStore.get("session")?.value;
  if (!session) return null;

  try {
    return await decrypt(session);
  } catch {
    return null;
  }
}

export async function deleteSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set("session", "", sessionCookieOptions(new Date(0)));
}
