import { NextRequest, NextResponse } from "next/server";

/**
 * Legacy Breach Index module — merged into /api/osint/breaches.
 * Keep the path so old bookmarks / clients still resolve.
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl.clone();

  url.pathname = "/api/osint/breaches";

  return NextResponse.redirect(url, 307);
}
