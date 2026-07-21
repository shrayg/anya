/**
 * Major-platform email registration probes (dating, adult, commerce, media).
 * Ported from Holehe-style signup/login checks; presence-only unless noted.
 *
 * Dating (Tinder / Hinge / Bumble): no stable public email-exists endpoint in
 * 2026 — probes return rateLimit with Signal=no_public_endpoint rather than
 * inventing hits.
 */

import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { fetchWithResidentialProxy } from "@/lib/residential-proxy";
import type { EmailPresenceProbeResult } from "@/lib/email-presence/types";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const TIMEOUT = 10_000;
const PROXY_TIMEOUT = 14_000;

function base(
  name: string,
  domain: string,
  partial: Partial<EmailPresenceProbeResult> = {},
): EmailPresenceProbeResult {
  return {
    name,
    domain,
    exists: false,
    rateLimit: false,
    emailrecovery: null,
    phoneNumber: null,
    others: null,
    profileUrl: null,
    ...partial,
  };
}

async function jsonOrNull(res: Response): Promise<Record<string, unknown> | null> {
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function cookieHeader(res: Response): string {
  const getSet =
    typeof res.headers.getSetCookie === "function"
      ? res.headers.getSetCookie()
      : [];
  const fromList = getSet.map((c) => c.split(";")[0]!).filter(Boolean);
  const single = res.headers.get("set-cookie");

  if (fromList.length) return fromList.join("; ");
  if (!single) return "";

  return single
    .split(/,(?=\s*[^;=]+=)/)
    .map((c) => c.split(";")[0]!.trim())
    .filter(Boolean)
    .join("; ");
}

/** XNXX — GET /account/checkemail (result true = available). */
export async function probeXnxx(
  email: string,
): Promise<EmailPresenceProbeResult> {
  try {
    const home = await fetchWithResidentialProxy("https://www.xnxx.com/", {
      headers: {
        "User-Agent": UA,
        Accept: "text/html",
        Referer: "https://www.google.com/",
      },
      cache: "no-store",
      timeoutMs: PROXY_TIMEOUT,
    });
    const cookie = cookieHeader(home);
    const res = await fetchWithResidentialProxy(
      `https://www.xnxx.com/account/checkemail?email=${encodeURIComponent(email)}`,
      {
        headers: {
          "User-Agent": UA,
          Accept: "application/json",
          "X-Requested-With": "XMLHttpRequest",
          Referer: "https://www.xnxx.com/",
          ...(cookie ? { Cookie: cookie } : {}),
        },
        cache: "no-store",
        timeoutMs: PROXY_TIMEOUT,
      },
    );
    const data = await jsonOrNull(res);

    if (!data) {
      return base("XNXX", "xnxx.com", { rateLimit: true });
    }

    // Holehe: result:true code:0 → available; result:false code:1 + message → taken
    if (data.result === true && data.code === 0) {
      return base("XNXX", "xnxx.com", { exists: false });
    }

    if (data.result === false && Number(data.code) === 1) {
      const msg = String(data.message ?? "").toLowerCase();

      if (msg.includes("invalide") || msg.includes("invalid")) {
        return base("XNXX", "xnxx.com", { exists: false });
      }

      return base("XNXX", "xnxx.com", { exists: true });
    }

    if (Number(data.code) === 2 || res.status === 429) {
      return base("XNXX", "xnxx.com", { rateLimit: true });
    }

    return base("XNXX", "xnxx.com", { rateLimit: true });
  } catch {
    return base("XNXX", "xnxx.com", { error: true });
  }
}

/** XVideos — GET /account/checkemail. */
export async function probeXvideos(
  email: string,
): Promise<EmailPresenceProbeResult> {
  try {
    const home = await fetchWithResidentialProxy("https://www.xvideos.com/", {
      headers: { "User-Agent": UA, Accept: "text/html" },
      cache: "no-store",
      timeoutMs: PROXY_TIMEOUT,
    });
    const cookie = cookieHeader(home);
    const res = await fetchWithResidentialProxy(
      `https://www.xvideos.com/account/checkemail?email=${encodeURIComponent(email)}`,
      {
        headers: {
          "User-Agent": UA,
          Accept: "application/json, text/javascript, */*; q=0.01",
          "X-Requested-With": "XMLHttpRequest",
          Referer: "https://www.xvideos.com/",
          ...(cookie ? { Cookie: cookie } : {}),
        },
        cache: "no-store",
        timeoutMs: PROXY_TIMEOUT,
      },
    );
    const text = await res.text();
    let data: Record<string, unknown> | null = null;

    try {
      data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      return base("XVideos", "xvideos.com", { rateLimit: true });
    }

    if (
      data.result === false &&
      /already in use|already been taken|exclu/i.test(text)
    ) {
      return base("XVideos", "xvideos.com", { exists: true });
    }

    if (data.result === true) {
      return base("XVideos", "xvideos.com", { exists: false });
    }

    return base("XVideos", "xvideos.com", { rateLimit: !res.ok });
  } catch {
    return base("XVideos", "xvideos.com", { error: true });
  }
}

/** Pornhub — signup token + create_account_check. */
export async function probePornhub(
  email: string,
): Promise<EmailPresenceProbeResult> {
  try {
    const page = await fetchWithResidentialProxy(
      "https://www.pornhub.com/signup",
      {
        headers: {
          "User-Agent": UA,
          Accept: "text/html",
          Cookie: "accessAgeDisclaimerPH=1; age_verified=1",
        },
        cache: "no-store",
        timeoutMs: PROXY_TIMEOUT,
      },
    );
    const html = await page.text();
    const token =
      html.match(/name="token"\s+value="([^"]+)"/i)?.[1] ||
      html.match(/value="([^"]+)"\s+name="token"/i)?.[1];
    const cookie = [
      cookieHeader(page),
      "accessAgeDisclaimerPH=1",
      "age_verified=1",
    ]
      .filter(Boolean)
      .join("; ");

    if (!token) {
      return base("Pornhub", "pornhub.com", { rateLimit: true });
    }

    const res = await fetchWithResidentialProxy(
      `https://www.pornhub.com/user/create_account_check?token=${encodeURIComponent(token)}`,
      {
        method: "POST",
        headers: {
          "User-Agent": UA,
          Accept: "application/json, text/javascript, */*; q=0.01",
          "Content-Type": "application/x-www-form-urlencoded",
          "X-Requested-With": "XMLHttpRequest",
          Origin: "https://www.pornhub.com",
          Referer: "https://www.pornhub.com/signup",
          Cookie: cookie,
        },
        body: new URLSearchParams({
          check_what: "email",
          email,
        }).toString(),
        cache: "no-store",
        timeoutMs: PROXY_TIMEOUT,
      },
    );
    const text = await res.text();

    if (/Email has been taken/i.test(text)) {
      return base("Pornhub", "pornhub.com", { exists: true });
    }

    try {
      const data = JSON.parse(text) as { error_message?: string };

      if (data.error_message === "Email has been taken.") {
        return base("Pornhub", "pornhub.com", { exists: true });
      }

      if (typeof data.error_message === "string" || res.ok) {
        return base("Pornhub", "pornhub.com", { exists: false });
      }
    } catch {
      /* HTML captcha wall */
    }

    return base("Pornhub", "pornhub.com", { rateLimit: true });
  } catch {
    return base("Pornhub", "pornhub.com", { error: true });
  }
}

/** RedTube — same MindGeek check pattern as Pornhub. */
export async function probeRedtube(
  email: string,
): Promise<EmailPresenceProbeResult> {
  try {
    const page = await fetchWithResidentialProxy(
      "https://www.redtube.com/register",
      {
        headers: {
          "User-Agent": UA,
          Accept: "text/html",
          Cookie: "age_verified=1",
        },
        cache: "no-store",
        timeoutMs: PROXY_TIMEOUT,
      },
    );
    const html = await page.text();
    const token =
      html.match(/id="token"[^>]*value="([^"]+)"/i)?.[1] ||
      html.match(/name="token"\s+value="([^"]+)"/i)?.[1];
    const cookie = [cookieHeader(page), "age_verified=1"]
      .filter(Boolean)
      .join("; ");

    if (!token) {
      return base("RedTube", "redtube.com", { rateLimit: true });
    }

    const res = await fetchWithResidentialProxy(
      `https://www.redtube.com/user/create_account_check?token=${encodeURIComponent(token)}`,
      {
        method: "POST",
        headers: {
          "User-Agent": UA,
          Accept: "*/*",
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          "X-Requested-With": "XMLHttpRequest",
          Origin: "https://www.redtube.com",
          Referer: "https://www.redtube.com/register",
          Cookie: cookie,
        },
        body: new URLSearchParams({
          token,
          redirect: "",
          check_what: "email",
          email,
        }).toString(),
        cache: "no-store",
        timeoutMs: PROXY_TIMEOUT,
      },
    );
    const text = await res.text();

    if (/Email has been taken/i.test(text)) {
      return base("RedTube", "redtube.com", { exists: true });
    }

    if (res.ok) {
      return base("RedTube", "redtube.com", { exists: false });
    }

    return base("RedTube", "redtube.com", { rateLimit: true });
  } catch {
    return base("RedTube", "redtube.com", { error: true });
  }
}

/** Nike — unite account email v1 (409 = taken). */
export async function probeNike(
  email: string,
): Promise<EmailPresenceProbeResult> {
  try {
    const url = new URL("https://unite.nike.com/account/email/v1");
    url.searchParams.set("appVersion", "1123");
    url.searchParams.set("experienceVersion", "1123");
    url.searchParams.set("uxid", "com.nike.commerce.nikedotcom.web");
    url.searchParams.set("locale", "en_US");
    url.searchParams.set("backendEnvironment", "identity");
    url.searchParams.set("mobile", "false");
    url.searchParams.set("native", "false");
    url.searchParams.set("visit", "1");

    const res = await fetchWithTimeout(url.toString(), {
      method: "POST",
      headers: {
        "User-Agent": UA,
        Accept: "*/*",
        "Content-Type": "text/plain;charset=UTF-8",
        Origin: "https://www.nike.com",
        Referer: "https://www.nike.com/",
      },
      body: JSON.stringify({ emailAddress: email }),
      cache: "no-store",
      timeoutMs: TIMEOUT,
    });

    if (res.status === 409) {
      return base("Nike", "nike.com", { exists: true });
    }

    if (res.status === 204 || res.status === 200) {
      return base("Nike", "nike.com", { exists: false });
    }

    return base("Nike", "nike.com", { rateLimit: true });
  } catch {
    return base("Nike", "nike.com", { error: true });
  }
}

/** Proton Mail — public PGP key lookup (exists if key published). */
export async function probeProtonMail(
  email: string,
): Promise<EmailPresenceProbeResult> {
  try {
    const res = await fetchWithTimeout(
      `https://api.protonmail.ch/pks/lookup?op=index&search=${encodeURIComponent(email)}`,
      {
        headers: { "User-Agent": UA, Accept: "text/plain" },
        cache: "no-store",
        timeoutMs: TIMEOUT,
      },
    );
    const text = await res.text();

    if (text.includes("info:1:0")) {
      return base("Proton Mail", "proton.me", { exists: false });
    }

    if (text.includes("info:1:1")) {
      return base("Proton Mail", "proton.me", {
        exists: true,
        others: { Signal: "pgp_key_published" },
      });
    }

    return base("Proton Mail", "proton.me", { rateLimit: !res.ok });
  } catch {
    return base("Proton Mail", "proton.me", { error: true });
  }
}

/** eBay — signin identifier check. */
export async function probeEbay(
  email: string,
): Promise<EmailPresenceProbeResult> {
  try {
    const page = await fetchWithTimeout("https://www.ebay.com/signin/", {
      headers: { "User-Agent": UA, Accept: "text/html" },
      cache: "no-store",
      timeoutMs: TIMEOUT,
    });
    const html = await page.text();
    const srt = html.match(/"csrfAjaxToken":"([^"]+)"/)?.[1];
    const cookie = cookieHeader(page);

    if (!srt) {
      return base("eBay", "ebay.com", { rateLimit: true });
    }

    const res = await fetchWithTimeout(
      "https://signin.ebay.com/signin/srv/identifer",
      {
        method: "POST",
        headers: {
          "User-Agent": UA,
          Accept: "application/json, text/plain, */*",
          "Content-Type": "application/x-www-form-urlencoded",
          Origin: "https://www.ebay.com",
          Referer: "https://www.ebay.com/signin/",
          ...(cookie ? { Cookie: cookie } : {}),
        },
        body: new URLSearchParams({ identifier: email, srt }).toString(),
        cache: "no-store",
        timeoutMs: TIMEOUT,
      },
    );
    const data = await jsonOrNull(res);

    if (!data) {
      return base("eBay", "ebay.com", { rateLimit: true });
    }

    if ("err" in data) {
      return base("eBay", "ebay.com", { exists: false });
    }

    return base("eBay", "ebay.com", { exists: true });
  } catch {
    return base("eBay", "ebay.com", { error: true });
  }
}

/** Imgur — ajax_email_available. */
export async function probeImgur(
  email: string,
): Promise<EmailPresenceProbeResult> {
  try {
    const page = await fetchWithTimeout(
      "https://imgur.com/register?redirect=%2Fuser",
      {
        headers: { "User-Agent": UA, Accept: "text/html" },
        cache: "no-store",
        timeoutMs: TIMEOUT,
      },
    );
    const cookie = cookieHeader(page);
    const res = await fetchWithTimeout(
      "https://imgur.com/signin/ajax_email_available",
      {
        method: "POST",
        headers: {
          "User-Agent": UA,
          Accept: "*/*",
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          Origin: "https://imgur.com",
          "X-Requested-With": "XMLHttpRequest",
          ...(cookie ? { Cookie: cookie } : {}),
        },
        body: new URLSearchParams({ email }).toString(),
        cache: "no-store",
        timeoutMs: TIMEOUT,
      },
    );
    const data = await jsonOrNull(res);
    const available = (data?.data as { available?: boolean } | undefined)
      ?.available;

    if (typeof available === "boolean") {
      return base("Imgur", "imgur.com", { exists: !available });
    }

    return base("Imgur", "imgur.com", { rateLimit: true });
  } catch {
    return base("Imgur", "imgur.com", { error: true });
  }
}

/** Venmo — signup users API. */
export async function probeVenmo(
  email: string,
): Promise<EmailPresenceProbeResult> {
  try {
    const page = await fetchWithTimeout("https://venmo.com/signup/email", {
      headers: { "User-Agent": UA, Accept: "text/html" },
      cache: "no-store",
      timeoutMs: TIMEOUT,
    });
    const cookie = cookieHeader(page);
    const deviceId =
      cookie.match(/v_id=([^;]+)/)?.[1] ||
      page.headers.get("set-cookie")?.match(/v_id=([^;]+)/)?.[1];

    if (!deviceId) {
      return base("Venmo", "venmo.com", { rateLimit: true });
    }

    const res = await fetchWithTimeout("https://venmo.com/api/v5/users", {
      method: "POST",
      headers: {
        "User-Agent": UA,
        Accept: "application/json",
        "Content-Type": "application/json",
        Origin: "https://venmo.com",
        Referer: "https://venmo.com/",
        "device-id": deviceId,
        Cookie: cookie || `v_id=${deviceId}`,
      },
      body: JSON.stringify({
        last_name: "e",
        first_name: "z",
        email,
        password: "",
        phone: "1",
        client_id: 10,
      }),
      cache: "no-store",
      timeoutMs: TIMEOUT,
    });
    const text = await res.text();

    if (/Not acceptable/i.test(text)) {
      return base("Venmo", "venmo.com", { rateLimit: true });
    }

    if (/already registered/i.test(text)) {
      return base("Venmo", "venmo.com", { exists: true });
    }

    return base("Venmo", "venmo.com", { exists: false });
  } catch {
    return base("Venmo", "venmo.com", { error: true });
  }
}

/** SoundCloud — web-auth identifier (needs client_id from page). */
export async function probeSoundCloud(
  email: string,
): Promise<EmailPresenceProbeResult> {
  try {
    const page = await fetchWithTimeout("https://soundcloud.com/", {
      headers: { "User-Agent": UA, Accept: "text/html" },
      cache: "no-store",
      timeoutMs: TIMEOUT,
    });
    const html = await page.text();
    const clientId =
      html.match(/"clientId":"([^"]+)"/)?.[1] ||
      html.match(/client_id["']?\s*[:=]\s*["']([A-Za-z0-9]+)["']/)?.[1];

    if (!clientId) {
      return base("SoundCloud", "soundcloud.com", { rateLimit: true });
    }

    const res = await fetchWithTimeout(
      `https://api-auth.soundcloud.com/web-auth/identifier?q=${encodeURIComponent(email)}&client_id=${encodeURIComponent(clientId)}`,
      {
        headers: { "User-Agent": UA, Accept: "application/json" },
        cache: "no-store",
        timeoutMs: TIMEOUT,
      },
    );
    const data = await jsonOrNull(res);
    const status = data?.status;

    if (status === "in_use") {
      return base("SoundCloud", "soundcloud.com", { exists: true });
    }

    if (status === "available") {
      return base("SoundCloud", "soundcloud.com", { exists: false });
    }

    return base("SoundCloud", "soundcloud.com", { rateLimit: true });
  } catch {
    return base("SoundCloud", "soundcloud.com", { error: true });
  }
}

/** Strava — athletes/email_unique. */
export async function probeStrava(
  email: string,
): Promise<EmailPresenceProbeResult> {
  try {
    const page = await fetchWithTimeout(
      "https://www.strava.com/register/free?cta=sign-up",
      {
        headers: { "User-Agent": UA, Accept: "text/html" },
        cache: "no-store",
        timeoutMs: TIMEOUT,
      },
    );
    const html = await page.text();
    const csrf =
      html.match(/name="csrf-token" content="([^"]+)"/)?.[1] ||
      html.match(/csrf-token" content="([^"]+)"/)?.[1];
    const cookie = cookieHeader(page);

    const res = await fetchWithTimeout(
      `https://www.strava.com/athletes/email_unique?email=${encodeURIComponent(email)}`,
      {
        headers: {
          "User-Agent": UA,
          Accept: "*/*",
          "X-Requested-With": "XMLHttpRequest",
          ...(csrf ? { "X-CSRF-Token": csrf } : {}),
          ...(cookie ? { Cookie: cookie } : {}),
          Referer: "https://www.strava.com/register/free",
        },
        cache: "no-store",
        timeoutMs: TIMEOUT,
      },
    );
    const text = (await res.text()).trim().toLowerCase();

    if (text === "false") {
      return base("Strava", "strava.com", { exists: true });
    }

    if (text === "true") {
      return base("Strava", "strava.com", { exists: false });
    }

    return base("Strava", "strava.com", { rateLimit: true });
  } catch {
    return base("Strava", "strava.com", { error: true });
  }
}

/** Dating apps — no reliable public email-exists API (2026). */
async function datingUnsupported(
  name: string,
  domain: string,
): Promise<EmailPresenceProbeResult> {
  // Not rate-limited — endpoint simply does not exist publicly. Skip as "not found"
  // so Contact Profiles doesn't inflate rate-limit stats.
  return base(name, domain, {
    exists: false,
    others: {
      Signal: "no_public_endpoint",
      Note: "No public email registration check (app attestation / OTP only).",
    },
  });
}

export async function probeTinder(
  _email: string,
): Promise<EmailPresenceProbeResult> {
  return datingUnsupported("Tinder", "tinder.com");
}

export async function probeHinge(
  _email: string,
): Promise<EmailPresenceProbeResult> {
  return datingUnsupported("Hinge", "hinge.co");
}

export async function probeBumble(
  _email: string,
): Promise<EmailPresenceProbeResult> {
  return datingUnsupported("Bumble", "bumble.com");
}

/** Badoo — SERVER_CHECK_EMAIL protobuf-ish JSON (often error without full client). */
export async function probeBadoo(
  email: string,
): Promise<EmailPresenceProbeResult> {
  try {
    const res = await fetchWithResidentialProxy(
      "https://badoo.com/api.phtml?SERVER_CHECK_EMAIL",
      {
        method: "POST",
        headers: {
          "User-Agent": UA,
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-Message-Type": "308",
          Origin: "https://badoo.com",
          Referer: "https://badoo.com/",
        },
        body: JSON.stringify({ email }),
        cache: "no-store",
        timeoutMs: PROXY_TIMEOUT,
      },
    );
    const text = await res.text();

    if (/already|exists|taken/i.test(text) && /email/i.test(text)) {
      return base("Badoo", "badoo.com", { exists: true });
    }

    // Current responses are mostly server_error without client session.
    return base("Badoo", "badoo.com", {
      rateLimit: true,
      others: { Signal: "client_session_required" },
    });
  } catch {
    return base("Badoo", "badoo.com", { error: true });
  }
}

export const EMAIL_PRESENCE_MAJOR_PROBES = [
  probeXnxx,
  probeXvideos,
  probePornhub,
  probeRedtube,
  probeNike,
  probeProtonMail,
  probeEbay,
  probeImgur,
  probeVenmo,
  probeSoundCloud,
  probeStrava,
  probeTinder,
  probeHinge,
  probeBumble,
  probeBadoo,
] as const;
