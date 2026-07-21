import type { IndexSweepQueryKind } from "@/lib/index-sweep/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const INDEX_SWEEP_INVALID_MESSAGE =
  "Enter an email (name@domain.tld) or a phone number with at least 10 digits.";

export function detectIndexSweepKind(raw: string): IndexSweepQueryKind | null {
  const trimmed = raw.trim();

  if (EMAIL_RE.test(trimmed)) return "email";

  const digits = trimmed.replace(/\D/g, "");

  if (digits.length >= 10 && digits.length <= 15) return "phone";

  return null;
}

export function normalizeIndexSweepEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();

  return EMAIL_RE.test(email) && email.length <= 254 ? email : null;
}

/** Digits-only E.164-ish core (no +). */
export function normalizeIndexSweepPhoneDigits(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");

  if (digits.length < 10 || digits.length > 15) return null;

  return digits;
}

/**
 * Exhaustive format variants for strict quoted search.
 * Google exact-match treats punctuation as significant — cover LinkedIn-style
 * contact formats.
 */
export function phoneSearchVariants(digits: string): string[] {
  const variants = new Set<string>();

  variants.add(digits);

  const isUsNanp =
    digits.length === 10 ||
    (digits.length === 11 && digits.startsWith("1"));

  if (isUsNanp) {
    const local10 =
      digits.length === 11 && digits.startsWith("1")
        ? digits.slice(1)
        : digits.slice(-10);

    const a = local10.slice(0, 3);
    const b = local10.slice(3, 6);
    const c = local10.slice(6);

    const localForms = [
      local10,
      `${a}-${b}-${c}`,
      `${a}.${b}.${c}`,
      `${a} ${b} ${c}`,
      `(${a}) ${b}-${c}`,
      `(${a})${b}-${c}`,
      `(${a}) ${b}.${c}`,
      `(${a}) ${b} ${c}`,
    ];

    for (const form of localForms) variants.add(form);

    const withCc = [
      `+1${local10}`,
      `+1 ${a}-${b}-${c}`,
      `+1-${a}-${b}-${c}`,
      `+1.${a}.${b}.${c}`,
      `+1 (${a}) ${b}-${c}`,
      `+1(${a})${b}-${c}`,
      `1-${a}-${b}-${c}`,
      `1.${a}.${b}.${c}`,
      `1 ${a} ${b} ${c}`,
      `1 (${a}) ${b}-${c}`,
      `1${local10}`,
    ];

    for (const form of withCc) variants.add(form);
  } else {
    variants.add(`+${digits}`);
    variants.add(`+${digits.slice(0, 1)} ${digits.slice(1)}`);
    variants.add(`+${digits.slice(0, 2)} ${digits.slice(2)}`);
    variants.add(`+${digits.slice(0, 3)} ${digits.slice(3)}`);

    if (digits.length >= 11) {
      const ccLen = Math.min(3, digits.length - 7);
      const cc = digits.slice(0, ccLen);
      const rest = digits.slice(ccLen);

      if (rest.length === 10) {
        const a = rest.slice(0, 3);
        const b = rest.slice(3, 6);
        const c = rest.slice(6);

        variants.add(`+${cc}${rest}`);
        variants.add(`+${cc} ${a}-${b}-${c}`);
        variants.add(`+${cc} (${a}) ${b}-${c}`);
        variants.add(`+${cc}-${a}-${b}-${c}`);
      }
    }
  }

  return [...variants]
    .map((v) => v.trim())
    .filter((v) => v.replace(/\D/g, "").length >= 10);
}
