import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const key = new TextEncoder().encode(
  process.env.JWT_SECRET || "super-secret-jwt-key",
);

export async function middleware(request: NextRequest) {
  const token = request.cookies.get("session")?.value;

  if (!token) {
    return NextResponse.redirect(
      new URL("/auth?action=login", request.url),
    );
  }

  try {
    await jwtVerify(token, key, { algorithms: ["HS256"] });
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(
      new URL("/auth?action=login", request.url),
    );
  }
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
