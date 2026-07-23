/**
 * Common international dialing codes for phone search fields.
 * Values are digits only (no "+").
 */
export type PhoneDialCodeOption = {
  code: string;
  label: string;
  /** Typical national digit length (hint only; not enforced strictly). */
  nationalLength?: number;
};

export const DEFAULT_PHONE_DIAL_CODE = "1";

export const PHONE_DIAL_CODES: PhoneDialCodeOption[] = [
  { code: "1", label: "US / CA +1", nationalLength: 10 },
  { code: "44", label: "UK +44", nationalLength: 10 },
  { code: "61", label: "AU +61", nationalLength: 9 },
  { code: "64", label: "NZ +64", nationalLength: 9 },
  { code: "91", label: "IN +91", nationalLength: 10 },
  { code: "81", label: "JP +81", nationalLength: 10 },
  { code: "82", label: "KR +82", nationalLength: 10 },
  { code: "86", label: "CN +86", nationalLength: 11 },
  { code: "852", label: "HK +852", nationalLength: 8 },
  { code: "65", label: "SG +65", nationalLength: 8 },
  { code: "971", label: "AE +971", nationalLength: 9 },
  { code: "966", label: "SA +966", nationalLength: 9 },
  { code: "972", label: "IL +972", nationalLength: 9 },
  { code: "90", label: "TR +90", nationalLength: 10 },
  { code: "7", label: "RU / KZ +7", nationalLength: 10 },
  { code: "49", label: "DE +49", nationalLength: 11 },
  { code: "33", label: "FR +33", nationalLength: 9 },
  { code: "39", label: "IT +39", nationalLength: 10 },
  { code: "34", label: "ES +34", nationalLength: 9 },
  { code: "31", label: "NL +31", nationalLength: 9 },
  { code: "32", label: "BE +32", nationalLength: 9 },
  { code: "41", label: "CH +41", nationalLength: 9 },
  { code: "46", label: "SE +46", nationalLength: 9 },
  { code: "47", label: "NO +47", nationalLength: 8 },
  { code: "45", label: "DK +45", nationalLength: 8 },
  { code: "358", label: "FI +358", nationalLength: 9 },
  { code: "48", label: "PL +48", nationalLength: 9 },
  { code: "420", label: "CZ +420", nationalLength: 9 },
  { code: "36", label: "HU +36", nationalLength: 9 },
  { code: "43", label: "AT +43", nationalLength: 10 },
  { code: "351", label: "PT +351", nationalLength: 9 },
  { code: "353", label: "IE +353", nationalLength: 9 },
  { code: "30", label: "GR +30", nationalLength: 10 },
  { code: "55", label: "BR +55", nationalLength: 11 },
  { code: "52", label: "MX +52", nationalLength: 10 },
  { code: "54", label: "AR +54", nationalLength: 10 },
  { code: "57", label: "CO +57", nationalLength: 10 },
  { code: "56", label: "CL +56", nationalLength: 9 },
  { code: "51", label: "PE +51", nationalLength: 9 },
  { code: "27", label: "ZA +27", nationalLength: 9 },
  { code: "234", label: "NG +234", nationalLength: 10 },
  { code: "254", label: "KE +254", nationalLength: 9 },
  { code: "20", label: "EG +20", nationalLength: 10 },
  { code: "212", label: "MA +212", nationalLength: 9 },
];

export function isKnownDialCode(code: string): boolean {
  return PHONE_DIAL_CODES.some((entry) => entry.code === code);
}

/**
 * Build an E.164-ish query from a national (or already-international) input
 * and a selected dial code.
 */
export function composePhoneWithDialCode(
  raw: string,
  dialCode: string = DEFAULT_PHONE_DIAL_CODE,
): string {
  const code = dialCode.replace(/\D/g, "") || DEFAULT_PHONE_DIAL_CODE;
  const digits = raw.replace(/\D/g, "");

  if (!digits) return "";

  // Already includes this country code.
  if (digits.startsWith(code) && digits.length > code.length + 5) {
    return `+${digits}`;
  }

  // Explicit + / international paste that doesn't match the dropdown — keep as-is.
  if (raw.trim().startsWith("+") && !digits.startsWith(code)) {
    return `+${digits}`;
  }

  // NANP: 11 digits starting with 1 while US/CA selected.
  if (code === "1" && digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  // Strip a single leading 0 (common trunk prefix) before attaching country code.
  const national =
    digits.startsWith("0") && digits.length > 8 ? digits.slice(1) : digits;

  return `+${code}${national}`;
}
