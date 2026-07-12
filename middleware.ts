import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isOsintApi = pathname.startsWith("/api/osint/");

  const token = request.cookies.get("session")?.value;
  const key = getJwtKey();

  if (!token || !key) {
    if (isOsintApi) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.redirect(new URL("/auth?action=login", request.url));
  }

  try {
    await jwtVerify(token, key, { algorithms: ["HS256"] });
    return NextResponse.next();
  } catch {
    if (isOsintApi) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.redirect(new URL("/auth?action=login", request.url));
  }
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/osint/:path*"],
};
