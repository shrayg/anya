import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
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

function sessionCookieOptions(expires: Date) {
  return {
    expires,
    httpOnly: true,
    secure: shouldUseSecureCookies(),
    sameSite: "lax" as const,
    path: "/",
  };
}

export async function encrypt(payload: any) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(getKey());
}

export async function decrypt(input: string): Promise<any> {
  const { payload } = await jwtVerify(input, getKey(), {
    algorithms: ["HS256"],
  });
  return payload;
}

export async function setSessionCookie(userId: number, isAdmin: boolean) {
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const session = await encrypt({ userId, isAdmin, expires });

  const cookieStore = await cookies();
  cookieStore.set("session", session, sessionCookieOptions(expires));
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
