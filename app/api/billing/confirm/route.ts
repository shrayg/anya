import { NextRequest, NextResponse } from "next/server";

import { fulfillCheckoutSession } from "@/lib/billing-fulfillment";
import { getAppBaseUrl, getStripe, isStripeConfigured } from "@/lib/stripe";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const baseUrl = getAppBaseUrl(request.url);
  const sessionId = request.nextUrl.searchParams.get("session_id");

  if (!sessionId) {
    return NextResponse.redirect(`${baseUrl}/pricing?billing=missing_session`);
  }

  if (!isStripeConfigured()) {
    return NextResponse.redirect(`${baseUrl}/pricing?billing=stripe_unavailable`);
  }

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const result = await fulfillCheckoutSession(session);

    if (!result.ok) {
      return NextResponse.redirect(
        `${baseUrl}/pricing?billing=pending&reason=${encodeURIComponent(result.reason)}`,
      );
    }

    if (result.type === "api_access") {
      return NextResponse.redirect(`${baseUrl}/dashboard/settings?billing=success`);
    }

    return NextResponse.redirect(`${baseUrl}/pricing?billing=success`);
  } catch (err) {
    console.error("[stripe confirm] failed", err);
    return NextResponse.redirect(`${baseUrl}/pricing?billing=error`);
  }
}
