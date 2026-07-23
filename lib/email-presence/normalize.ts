/**
 * Normalize email or phone for Contact Profiles (email-presence module).
 */

import {
  composePhoneWithDialCode,
  DEFAULT_PHONE_DIAL_CODE,
} from "@/lib/phone-dial-codes";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ContactKind = "email" | "phone";

/** Common wire formats probes may try for a single phone contact. */
export type PhoneFormatVariants = {
  /** +15713266602 */
  e164: string;
  /** 15713266602 */
  e164Digits: string;
  /** National / subscriber digits (US: 10) */
  national: string;
  /** Digits as typed after strip (may include country code) */
  rawDigits: string;
};

export type NormalizedContact =
  | {
      kind: "email";
      /** Lowercased email */
      value: string;
      email: string;
    }
  | {
      kind: "phone";
      /** Digits only (no +) — full international when known */
      value: string;
      /** E.164-ish with leading + */
      e164: string;
      /** National digits (US: last 10 when NANP) */
      national: string;
      /** Display form used in UI */
      display: string;
      /** Dial code used for composition (digits, no +) */
      dialCode: string;
      /** Alternate shapes for probes that disagree on formatting */
      formats: PhoneFormatVariants;
    };

export const CONTACT_PRESENCE_INVALID_MESSAGE =
  "Enter a valid email (name@domain.tld) or phone number (at least 8 digits).";

export function normalizeContactInput(
  raw: string,
  options?: { dialCode?: string },
): NormalizedContact | null {
  const trimmed = raw.trim();

  if (!trimmed || trimmed.length > 254) return null;

  if (trimmed.includes("@")) {
    const email = trimmed.toLowerCase();

    if (!EMAIL_RE.test(email)) return null;

    return { kind: "email", value: email, email };
  }

  const dialCode =
    options?.dialCode?.replace(/\D/g, "") ||
    (trimmed.startsWith("+") ? "" : DEFAULT_PHONE_DIAL_CODE);

  const composed = dialCode
    ? composePhoneWithDialCode(trimmed, dialCode)
    : trimmed.startsWith("+")
      ? `+${trimmed.replace(/\D/g, "")}`
      : composePhoneWithDialCode(trimmed, DEFAULT_PHONE_DIAL_CODE);

  const e164Digits = composed.replace(/\D/g, "");

  if (e164Digits.length < 8 || e164Digits.length > 15) return null;

  const resolvedDial =
    dialCode ||
    (e164Digits.length === 11 && e164Digits.startsWith("1")
      ? "1"
      : e164Digits.length === 10
        ? "1"
        : "");

  let national: string;

  if (resolvedDial && e164Digits.startsWith(resolvedDial)) {
    national = e164Digits.slice(resolvedDial.length);
  } else if (e164Digits.length === 10) {
    national = e164Digits;
  } else if (e164Digits.length === 11 && e164Digits.startsWith("1")) {
    national = e164Digits.slice(1);
  } else {
    national = e164Digits;
  }

  const e164 = `+${e164Digits}`;
  const formats: PhoneFormatVariants = {
    e164,
    e164Digits,
    national,
    rawDigits: trimmed.replace(/\D/g, ""),
  };

  return {
    kind: "phone",
    value: e164Digits,
    e164,
    national,
    display: e164,
    dialCode: resolvedDial || DEFAULT_PHONE_DIAL_CODE,
    formats,
  };
}
