import { NextRequest, NextResponse } from "next/server";

import {
  CHEATING_REPORT_MAX_EMAILS,
  CHEATING_REPORT_UNLOCK_PRICE_USD,
} from "@/lib/cheating-funnel-offer";
import { osintJson, requireOsintAccess } from "@/lib/osint-api-auth";
import { fetchGodsEyeOnlySearch } from "@/lib/osint-combined";
import { mergeSanitizedResponses } from "@/lib/osintcat";
import {
  OSINT_ROUTE_DEADLINE_MS,
  osintFailureResponse,
  withDeadline,
} from "@/lib/osint-search-guard";
import { getPlatformSearchConfig } from "@/lib/platform-search";

export const runtime = "nodejs";

type SecondaryClueType =
  | "extra_phone"
  | "partner_social_username"
  | "other_social_username"
  | "partner_snapchat_username"
  | "other_snapchat_username"
  | "no_extra";

function normalizePhone(value: unknown) {
  const raw = String(value ?? "").trim();
  const digits = raw.replace(/\D/g, "");

  if (digits.length < 10 || digits.length > 15) return null;

  return raw.slice(0, 40);
}

function normalizeFullName(value: unknown) {
  const normalized = String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
  const parts = normalized.split(" ");

  if (
    normalized.length > 100 ||
    parts.length < 2 ||
    !parts.every((part) => /^[\p{L}\p{M}'’.\-]+$/u.test(part))
  ) {
    return null;
  }

  return normalized;
}

function normalizeSecondaryType(value: unknown): SecondaryClueType | null {
  if (value === undefined || value === null || value === "") {
    return "no_extra";
  }

  if (
    value === "extra_phone" ||
    value === "partner_social_username" ||
    value === "other_social_username" ||
    value === "partner_snapchat_username" ||
    value === "other_snapchat_username" ||
    value === "no_extra"
  ) {
    return value;
  }

  return null;
}

function normalizeUsername(value: unknown) {
  const normalized = String(value ?? "")
    .trim()
    .replace(/^@+/, "");

  if (
    normalized.length < 2 ||
    normalized.length > 64 ||
    !/^[A-Za-z0-9._-]+$/.test(normalized)
  ) {
    return null;
  }

  return normalized;
}

function normalizeEmail(value: unknown) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

  if (
    normalized.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
  ) {
    return null;
  }

  return normalized;
}

function normalizeEmails(value: unknown) {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > CHEATING_REPORT_MAX_EMAILS) {
    return null;
  }

  const normalized = value.map(normalizeEmail);

  if (normalized.some((email) => !email)) return null;

  return [...new Set(normalized as string[])];
}

export async function POST(request: NextRequest) {
  // Pass only the non-sensitive module hint through access resolution. The
  // searched name and phone stay in the POST body instead of a marketing URL.
  const accessUrl = new URL(request.url);

  accessUrl.searchParams.set("moduleSlug", "phone");
  const accessRequest = new NextRequest(accessUrl, {
    headers: request.headers,
  });
  const access = await requireOsintAccess(accessRequest, "breach");

  if (access instanceof NextResponse) return access;

  const body = (await request.json().catch(() => null)) as {
    phone?: unknown;
    fullName?: unknown;
    emails?: unknown;
    secondaryType?: unknown;
    secondaryValue?: unknown;
  } | null;
  const phone = normalizePhone(body?.phone);
  const fullName = normalizeFullName(body?.fullName);
  const emails = normalizeEmails(body?.emails);
  const secondaryType = normalizeSecondaryType(body?.secondaryType);

  if (!phone || !fullName || !secondaryType || !emails) {
    return NextResponse.json(
      {
        error: `Enter a first and last name, a partner phone number, and up to ${CHEATING_REPORT_MAX_EMAILS} valid email addresses.`,
      },
      { status: 400 },
    );
  }

  const secondaryValue =
    secondaryType === "no_extra"
      ? null
      : secondaryType === "extra_phone"
        ? normalizePhone(body?.secondaryValue)
        : normalizeUsername(body?.secondaryValue);

  if (
    (secondaryType !== "no_extra" && !secondaryValue) ||
    (secondaryType === "extra_phone" &&
      secondaryValue &&
      secondaryValue.replace(/\D/g, "") === phone.replace(/\D/g, ""))
  ) {
    return NextResponse.json(
      {
        error:
          secondaryType === "extra_phone"
            ? "Enter a valid unfamiliar number that is different from the partner phone."
            : "Enter a valid public username.",
      },
      { status: 400 },
    );
  }

  const phonePlatform = getPlatformSearchConfig("phone");
  const namePlatform = getPlatformSearchConfig("name-search");
  const emailPlatform = getPlatformSearchConfig("email");
  const secondaryPlatform =
    secondaryType === "no_extra"
      ? null
      : getPlatformSearchConfig(
          secondaryType === "extra_phone"
            ? "phone"
            : secondaryType === "partner_snapchat_username" ||
                secondaryType === "other_snapchat_username"
              ? "snapchat"
              : "username",
        );

  if (
    !phonePlatform ||
    !namePlatform ||
    !emailPlatform ||
    (secondaryType !== "no_extra" && !secondaryPlatform)
  ) {
    return NextResponse.json(
      {
        error: "One or more public-source checks are temporarily unavailable.",
      },
      { status: 503 },
    );
  }

  try {
    const searches = [
      fetchGodsEyeOnlySearch(
        phone,
        phonePlatform.godseyeType,
        phonePlatform.breachVipField,
        phonePlatform.breachHubScope,
      ),
      fetchGodsEyeOnlySearch(
        fullName,
        namePlatform.godseyeType,
        namePlatform.breachVipField,
        namePlatform.breachHubScope,
      ),
      ...emails.map((email) =>
        fetchGodsEyeOnlySearch(
          email,
          emailPlatform.godseyeType,
          emailPlatform.breachVipField,
          emailPlatform.breachHubScope,
        ),
      ),
    ];

    if (secondaryValue && secondaryPlatform) {
      searches.push(
        fetchGodsEyeOnlySearch(
          secondaryValue,
          secondaryPlatform.godseyeType,
          secondaryPlatform.breachVipField,
          secondaryPlatform.breachHubScope,
        ),
      );
    }

    const outcomes = await withDeadline(
      Promise.allSettled(searches),
      OSINT_ROUTE_DEADLINE_MS,
    );
    const fulfilled = outcomes.flatMap((outcome) =>
      outcome.status === "fulfilled" ? [outcome.value] : [],
    );

    if (fulfilled.length === 0) {
      const failure = outcomes.find(
        (outcome): outcome is PromiseRejectedResult =>
          outcome.status === "rejected",
      );

      return osintFailureResponse(
        failure?.reason instanceof Error
          ? failure.reason
          : new Error("Name and phone search is temporarily unavailable."),
      );
    }

    const data = mergeSanitizedResponses(...fulfilled);
    const partial = outcomes.some((outcome) => outcome.status === "rejected");
    const payload =
      data.count === 0
        ? {
            ...data,
            message: partial
              ? "No matches were returned by the completed checks. Some public sources were temporarily unavailable."
              : "No public-source matches were found for the submitted identity details and clues.",
          }
        : partial
          ? {
              ...data,
              message:
                "The report includes every completed check. Some public sources were temporarily unavailable.",
            }
          : data;

    return osintJson(access, payload, undefined, {
      moduleSlug: "phone",
      query: phone,
      req: request,
      unlockCreditCost: CHEATING_REPORT_UNLOCK_PRICE_USD,
    });
  } catch (error) {
    return osintFailureResponse(error);
  }
}
