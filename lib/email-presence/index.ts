import {
  EMAIL_PRESENCE_FREE_PROBES,
  EMAIL_PRESENCE_PROXY_PROBES,
} from "@/lib/email-presence/probes";
import {
  EMAIL_PRESENCE_EXTRA_FREE_PROBES,
  EMAIL_PRESENCE_EXTRA_PROXY_PROBES,
} from "@/lib/email-presence/probes-extra";
import {
  EMAIL_PRESENCE_MAJOR_FREE_PROBES,
  EMAIL_PRESENCE_MAJOR_PROXY_PROBES,
} from "@/lib/email-presence/probes-majors";
import {
  PHONE_PRESENCE_FREE_PROBES,
  PHONE_PRESENCE_PROXY_PROBES,
} from "@/lib/email-presence/phone-probes";
import {
  CONTACT_PRESENCE_INVALID_MESSAGE,
  normalizeContactInput,
  type NormalizedContact,
} from "@/lib/email-presence/normalize";
import type {
  ContactPresenceKind,
  EmailPresenceHit,
  EmailPresenceSearchResult,
} from "@/lib/email-presence/types";
import { resolveLinkedInFromIdentifier } from "@/lib/profile-resolve/linkedin";

export const EMAIL_PRESENCE_SOURCE_ID = "email-presence" as const;
export const EMAIL_PRESENCE_SOURCE_LABEL = "Contact Profiles";
export const EMAIL_PRESENCE_INVALID_MESSAGE = CONTACT_PRESENCE_INVALID_MESSAGE;

export { normalizeContactInput, CONTACT_PRESENCE_INVALID_MESSAGE };
export type { NormalizedContact };

/** @deprecated use normalizeContactInput — kept for callers expecting email-only. */
export function normalizeEmailPresenceInput(raw: string): string | null {
  const contact = normalizeContactInput(raw);

  return contact?.kind === "email" ? contact.email : null;
}

function toHit(
  row: {
    name: string;
    domain: string;
    emailrecovery?: string | null;
    phoneNumber?: string | null;
    profileUrl?: string | null;
    others?: Record<string, string> | null;
  },
): EmailPresenceHit {
  return {
    siteName: row.name,
    domain: row.domain,
    exists: true,
    rateLimit: false,
    emailrecovery: row.emailrecovery ?? null,
    phoneNumber: row.phoneNumber ?? null,
    profileUrl: row.profileUrl ?? null,
    others: row.others ?? null,
  };
}

function emailProbesForMode(deep: boolean) {
  const free = [
    ...EMAIL_PRESENCE_FREE_PROBES,
    ...EMAIL_PRESENCE_EXTRA_FREE_PROBES,
    ...EMAIL_PRESENCE_MAJOR_FREE_PROBES,
  ];

  if (!deep) return free;

  return [
    ...free,
    ...EMAIL_PRESENCE_PROXY_PROBES,
    ...EMAIL_PRESENCE_EXTRA_PROXY_PROBES,
    ...EMAIL_PRESENCE_MAJOR_PROXY_PROBES,
  ];
}

function phoneProbesForMode(deep: boolean) {
  if (!deep) return PHONE_PRESENCE_FREE_PROBES;

  return [...PHONE_PRESENCE_FREE_PROBES, ...PHONE_PRESENCE_PROXY_PROBES];
}

async function runEmailProbes(
  email: string,
  deep: boolean,
): Promise<{
  found: EmailPresenceHit[];
  checked: number;
  rateLimited: number;
  errors: number;
}> {
  const probes = emailProbesForMode(deep);
  const settled = await Promise.allSettled(probes.map((probe) => probe(email)));

  const found: EmailPresenceHit[] = [];
  let rateLimited = 0;
  let errors = 0;
  let checked = 0;

  for (const item of settled) {
    checked += 1;

    if (item.status !== "fulfilled") {
      errors += 1;
      continue;
    }

    const row = item.value;

    if (row.error) {
      errors += 1;
      continue;
    }

    if (row.rateLimit) {
      rateLimited += 1;
      continue;
    }

    if (!row.exists) continue;

    found.push(toHit(row));
  }

  // LinkedIn session / SERP / GitHub pivots (best-effort, no residential proxy).
  try {
    const linkedIn = await resolveLinkedInFromIdentifier({
      query: email,
      kind: "email",
    });

    for (const pivot of linkedIn.pivots) {
      if (pivot.platform !== "github") continue;
      const already = found.some(
        (f) =>
          f.domain === "github.com" &&
          (f.profileUrl === pivot.url || f.others?.Username === pivot.label),
      );

      if (already) continue;

      found.push({
        siteName: "GitHub",
        domain: "github.com",
        exists: true,
        rateLimit: false,
        emailrecovery: null,
        phoneNumber: null,
        profileUrl: pivot.url,
        others: {
          Username: pivot.label,
          Confidence: pivot.confidence,
          Signal: "author-email",
        },
      });
    }

    for (const hit of linkedIn.hits) {
      if (hit.confidence === "low") continue;

      found.push({
        siteName: "LinkedIn",
        domain: "linkedin.com",
        exists: true,
        rateLimit: false,
        emailrecovery: null,
        phoneNumber: null,
        profileUrl: hit.profileUrl,
        others: {
          Username: hit.publicIdentifier,
          Confidence: hit.confidence,
          Method: hit.method,
        },
      });
    }
  } catch {
    // enrichment optional
  }

  return { found, checked, rateLimited, errors };
}

async function runPhoneProbes(
  phone: Extract<NormalizedContact, { kind: "phone" }>,
  deep: boolean,
): Promise<{
  found: EmailPresenceHit[];
  checked: number;
  rateLimited: number;
  errors: number;
}> {
  const settled = await Promise.allSettled(
    phoneProbesForMode(deep).map((probe) => probe(phone)),
  );

  const found: EmailPresenceHit[] = [];
  let rateLimited = 0;
  let errors = 0;
  let checked = 0;

  for (const item of settled) {
    checked += 1;

    if (item.status !== "fulfilled") {
      errors += 1;
      continue;
    }

    const row = item.value;

    if (row.error) {
      errors += 1;
      continue;
    }

    if (row.rateLimit) {
      rateLimited += 1;
      continue;
    }

    if (!row.exists) continue;

    found.push(toHit(row));
  }

  // LinkedIn phone resolve (SERP / session when available — no residential proxy).
  try {
    const linkedIn = await resolveLinkedInFromIdentifier({
      query: phone.e164,
      kind: "phone",
    });

    for (const hit of linkedIn.hits) {
      if (hit.confidence === "low") continue;

      found.push({
        siteName: "LinkedIn",
        domain: "linkedin.com",
        exists: true,
        rateLimit: false,
        emailrecovery: null,
        phoneNumber: phone.display,
        profileUrl: hit.profileUrl,
        others: {
          Username: hit.publicIdentifier,
          Confidence: hit.confidence,
          Method: hit.method,
        },
      });
    }
  } catch {
    // optional
  }

  return { found, checked, rateLimited, errors };
}

function sortHits(found: EmailPresenceHit[]): void {
  found.sort((a, b) => {
    const aProfile = a.profileUrl ? 1 : 0;
    const bProfile = b.profileUrl ? 1 : 0;

    if (bProfile !== aProfile) return bProfile - aProfile;

    return a.siteName.localeCompare(b.siteName);
  });
}

/**
 * Contact Profiles: email or phone → registration presence, plus profile URL
 * when a platform still leaks a username/handle.
 *
 * @param deep When true, also runs residential-proxy probes (IG, Snap, TikTok, …).
 *   Default false — no residential bandwidth.
 */
export async function searchEmailPresence(input: {
  query: string;
  deep?: boolean;
}): Promise<EmailPresenceSearchResult> {
  const started = Date.now();
  const deep = Boolean(input.deep);
  const contact = normalizeContactInput(input.query);

  if (!contact) {
    throw new Error(CONTACT_PRESENCE_INVALID_MESSAGE);
  }

  const kind: ContactPresenceKind = contact.kind;
  const run =
    contact.kind === "email"
      ? await runEmailProbes(contact.email, deep)
      : await runPhoneProbes(contact, deep);

  sortHits(run.found);

  const durationMs = Date.now() - started;
  const profileCount = run.found.filter((f) => f.profileUrl).length;
  const presenceCount = run.found.length - profileCount;

  const subject =
    contact.kind === "email" ? "email" : "phone number";
  const deepNote = deep
    ? " Deep search used residential proxy for social/adult platforms."
    : " Standard search only — enable Deep search (1 credit) for Instagram, Snapchat, TikTok, Facebook, Discord, LinkedIn signup, and adult sites.";
  const warning =
    run.found.length > 0
      ? profileCount > 0
        ? `${profileCount} hit(s) include a profile URL/username. Presence-only hits confirm an account without a public handle.${deepNote}`
        : `Hits confirm registration for this ${subject}. Username/profile URLs appear only when a platform still leaks them.${deepNote}`
      : `No registered accounts detected for this contact.${deepNote}`;

  const source = {
    id: EMAIL_PRESENCE_SOURCE_ID,
    label: EMAIL_PRESENCE_SOURCE_LABEL,
    checked: run.checked,
    count: run.found.length,
    errors: run.errors + run.rateLimited,
    durationMs,
    found: run.found,
    warning,
  };

  return {
    query: input.query.trim(),
    kind,
    email: contact.kind === "email" ? contact.email : null,
    phone: contact.kind === "phone" ? contact.display : null,
    count: run.found.length,
    checked: run.checked,
    rateLimited: run.rateLimited,
    errors: run.errors,
    found: run.found,
    profileCount,
    presenceCount,
    sources: [source],
    durationMs,
    warning,
  };
}

/** Explicit alias for new call sites. */
export const searchContactPresence = searchEmailPresence;

export type {
  EmailPresenceHit,
  EmailPresenceSearchResult,
  ContactPresenceSearchResult,
  ContactPresenceKind,
} from "@/lib/email-presence/types";
