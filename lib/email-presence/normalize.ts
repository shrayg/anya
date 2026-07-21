/**
 * Normalize email or phone for Contact Profiles (email-presence module).
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ContactKind = "email" | "phone";

export type NormalizedContact =
  | {
      kind: "email";
      /** Lowercased email */
      value: string;
      email: string;
    }
  | {
      kind: "phone";
      /** Digits only (no +) */
      value: string;
      /** E.164-ish with leading + when country code present */
      e164: string;
      /** National digits (US: last 10) */
      national: string;
      /** Display form used in UI */
      display: string;
    };

export const CONTACT_PRESENCE_INVALID_MESSAGE =
  "Enter a valid email (name@domain.tld) or phone number (at least 8 digits).";

export function normalizeContactInput(raw: string): NormalizedContact | null {
  const trimmed = raw.trim();

  if (!trimmed || trimmed.length > 254) return null;

  if (trimmed.includes("@")) {
    const email = trimmed.toLowerCase();

    if (!EMAIL_RE.test(email)) return null;

    return { kind: "email", value: email, email };
  }

  const digits = trimmed.replace(/\D/g, "");

  if (digits.length < 8 || digits.length > 15) return null;

  let e164: string;
  let national: string;

  if (digits.length === 10) {
    // Assume NANP when bare 10 digits.
    e164 = `+1${digits}`;
    national = digits;
  } else if (digits.length === 11 && digits.startsWith("1")) {
    e164 = `+${digits}`;
    national = digits.slice(1);
  } else {
    e164 = `+${digits}`;
    national = digits;
  }

  return {
    kind: "phone",
    value: digits,
    e164,
    national,
    display: e164,
  };
}
