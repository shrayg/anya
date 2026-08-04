import { createHash } from "node:crypto";

import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { fetchWithResidentialProxy } from "@/lib/residential-proxy";
import type { EmailPresenceProbeResult } from "@/lib/email-presence/types";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
const TIMEOUT = 8_000;
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

/** Gravatar — public JSON profile by MD5(email). */
export async function probeGravatar(
  email: string,
): Promise<EmailPresenceProbeResult> {
  const hash = createHash("md5")
    .update(email.trim().toLowerCase())
    .digest("hex");
  const url = `https://en.gravatar.com/${hash}.json`;

  try {
    const res = await fetchWithTimeout(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      cache: "no-store",
      timeoutMs: TIMEOUT,
    });

    if (res.status === 404) {
      return base("Gravatar", "gravatar.com");
    }

    if (!res.ok) {
      return base("Gravatar", "gravatar.com", { rateLimit: true });
    }

    const data = await jsonOrNull(res);
    const entry = Array.isArray((data as { entry?: unknown })?.entry)
      ? ((data as { entry: Array<Record<string, unknown>> }).entry[0] ?? null)
      : null;
    const displayName =
      typeof entry?.displayName === "string" ? entry.displayName : null;
    const preferredUsername =
      typeof entry?.preferredUsername === "string"
        ? entry.preferredUsername
        : null;
    const profileUrl = preferredUsername
      ? `https://gravatar.com/${encodeURIComponent(preferredUsername)}`
      : `https://gravatar.com/${hash}`;

    return base("Gravatar", "gravatar.com", {
      exists: true,
      profileUrl,
      others: {
        ...(displayName ? { FullName: displayName } : {}),
        ...(preferredUsername ? { Username: preferredUsername } : {}),
      },
    });
  } catch {
    return base("Gravatar", "gravatar.com", { error: true });
  }
}

/** GitHub — signup email check + author-email commit pivot → profile URL. */
export async function probeGithub(
  email: string,
): Promise<EmailPresenceProbeResult> {
  try {
    const [signupRes, commitsRes] = await Promise.all([
      fetchWithTimeout(
        `https://github.com/signup_check/email?value=${encodeURIComponent(email)}`,
        {
          headers: {
            "User-Agent": UA,
            Accept: "application/json",
            "X-Requested-With": "XMLHttpRequest",
          },
          cache: "no-store",
          timeoutMs: TIMEOUT,
        },
      ),
      fetchWithTimeout(
        `https://api.github.com/search/commits?q=${encodeURIComponent(`author-email:${email}`)}&per_page=5`,
        {
          headers: {
            "User-Agent": "AnyaInt-ContactProfiles",
            Accept: "application/vnd.github.cloak-preview+json",
          },
          cache: "no-store",
          timeoutMs: TIMEOUT,
        },
      ),
    ]);

    let login: string | null = null;

    if (commitsRes.ok) {
      try {
        const payload = (await commitsRes.json()) as {
          items?: Array<{ author?: { login?: string } | null }>;
        };
        const logins = (payload.items ?? [])
          .map((it) => it.author?.login)
          .filter((v): v is string => Boolean(v));
        const unique = [...new Set(logins)];

        if (unique.length === 1) login = unique[0]!;
      } catch {
        /* ignore parse */
      }
    }

    if (login) {
      return base("GitHub", "github.com", {
        exists: true,
        profileUrl: `https://github.com/${encodeURIComponent(login)}`,
        others: { Username: login, Signal: "author-email" },
      });
    }

    if (signupRes.status === 422) {
      return base("GitHub", "github.com", {
        exists: true,
        profileUrl: null,
        others: { Signal: "email_taken" },
      });
    }

    if (signupRes.status === 200) {
      return base("GitHub", "github.com", { exists: false });
    }

    if (signupRes.status === 429 || commitsRes.status === 429) {
      return base("GitHub", "github.com", { rateLimit: true });
    }

    return base("GitHub", "github.com", { rateLimit: true });
  } catch {
    return base("GitHub", "github.com", { error: true });
  }
}

/** Microsoft / Office365 GetCredentialType — IfExistsResult. */
export async function probeMicrosoft(
  email: string,
): Promise<EmailPresenceProbeResult> {
  try {
    const res = await fetchWithTimeout(
      "https://login.microsoftonline.com/common/GetCredentialType",
      {
        method: "POST",
        headers: {
          "User-Agent": UA,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: email,
          isOtherIdpSupported: true,
          checkPhones: false,
          isRemoteNGCSupported: true,
          isCookieBannerShown: false,
          isFidoSupported: false,
          originalRequest: "",
        }),
        cache: "no-store",
        timeoutMs: TIMEOUT,
      },
    );

    if (!res.ok) {
      return base("Microsoft", "microsoft.com", { rateLimit: true });
    }

    const data = await jsonOrNull(res);
    const ifExists = data?.IfExistsResult;

    // 0 = exists, 1 = does not exist (common mapping)
    if (ifExists === 0) {
      return base("Microsoft", "microsoft.com", { exists: true });
    }

    if (ifExists === 1) {
      return base("Microsoft", "microsoft.com", { exists: false });
    }

    return base("Microsoft", "microsoft.com", { rateLimit: true });
  } catch {
    return base("Microsoft", "microsoft.com", { error: true });
  }
}

/** Tumblr — register email check. */
export async function probeTumblr(
  email: string,
): Promise<EmailPresenceProbeResult> {
  try {
    const res = await fetchWithTimeout(
      "https://www.tumblr.com/api/v2/user/validate/email",
      {
        method: "POST",
        headers: {
          "User-Agent": UA,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ email }),
        cache: "no-store",
        timeoutMs: TIMEOUT,
      },
    );

    const data = await jsonOrNull(res);

    if (res.status === 400 || res.status === 403) {
      const msg = JSON.stringify(data ?? {}).toLowerCase();

      if (msg.includes("taken") || msg.includes("registered") || msg.includes("exist")) {
        return base("Tumblr", "tumblr.com", { exists: true });
      }
    }

    if (res.ok) {
      return base("Tumblr", "tumblr.com", { exists: false });
    }

    return base("Tumblr", "tumblr.com", { rateLimit: true });
  } catch {
    return base("Tumblr", "tumblr.com", { error: true });
  }
}

/** Spotify — signup validate. */
export async function probeSpotify(
  email: string,
): Promise<EmailPresenceProbeResult> {
  try {
    const res = await fetchWithTimeout(
      "https://spclient.wg.spotify.com/signup/public/v1/account",
      {
        method: "POST",
        headers: {
          "User-Agent": UA,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          validate: "1",
          email,
        }).toString(),
        cache: "no-store",
        timeoutMs: TIMEOUT,
      },
    );

    const data = await jsonOrNull(res);
    const status = data?.status;
    // Spotify: status 20 often = email already registered
    if (status === 20) {
      return base("Spotify", "spotify.com", { exists: true });
    }

    if (status === 1 || status === 0) {
      return base("Spotify", "spotify.com", { exists: false });
    }

    if (res.status === 429) {
      return base("Spotify", "spotify.com", { rateLimit: true });
    }

    return base("Spotify", "spotify.com", { rateLimit: !res.ok });
  } catch {
    return base("Spotify", "spotify.com", { error: true });
  }
}

/** Firefox Accounts — signup status. */
export async function probeFirefox(
  email: string,
): Promise<EmailPresenceProbeResult> {
  try {
    const res = await fetchWithTimeout(
      "https://api.accounts.firefox.com/v1/account/status",
      {
        method: "POST",
        headers: {
          "User-Agent": UA,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
        cache: "no-store",
        timeoutMs: TIMEOUT,
      },
    );

    const data = await jsonOrNull(res);

    if (typeof data?.exists === "boolean") {
      return base("Firefox", "firefox.com", { exists: data.exists });
    }

    return base("Firefox", "firefox.com", { rateLimit: true });
  } catch {
    return base("Firefox", "firefox.com", { error: true });
  }
}

/** Twitter/X — guest signup email check (often rate-limited). */
export async function probeTwitter(
  email: string,
): Promise<EmailPresenceProbeResult> {
  try {
    const res = await fetchWithTimeout(
      "https://api.twitter.com/i/users/email_available.json?email=" +
        encodeURIComponent(email),
      {
        headers: {
          "User-Agent": UA,
          Accept: "application/json",
        },
        cache: "no-store",
        timeoutMs: TIMEOUT,
      },
    );

    if (res.status === 429 || res.status === 401 || res.status === 403) {
      return base("X", "x.com", { rateLimit: true });
    }

    const data = await jsonOrNull(res);

    if (typeof data?.taken === "boolean") {
      return base("X", "x.com", { exists: data.taken });
    }

    return base("X", "x.com", { rateLimit: true });
  } catch {
    return base("X", "x.com", { error: true });
  }
}

/** Instagram — web create ajax attempt (prefer residential proxy). */
export async function probeInstagram(
  email: string,
): Promise<EmailPresenceProbeResult> {
  try {
    const page = await fetchWithResidentialProxy(
      "https://www.instagram.com/accounts/emailsignup/",
      {
        headers: { "User-Agent": UA, Accept: "text/html" },
        cache: "no-store",
        timeoutMs: PROXY_TIMEOUT,
      },
    );
    const html = await page.text();
    const token =
      html.match(/\\"csrf_token\\":\\"([^"\\]+)\\"/)?.[1] ||
      html.match(/"csrf_token"\s*:\s*"([^"]+)"/)?.[1] ||
      html.match(/{"csrf_token":"([^"]+)"/)?.[1];

    if (!token) {
      return base("Instagram", "instagram.com", { rateLimit: true });
    }

    const res = await fetchWithResidentialProxy(
      "https://www.instagram.com/api/v1/web/accounts/web_create_ajax/attempt/",
      {
        method: "POST",
        headers: {
          "User-Agent": UA,
          "Content-Type": "application/x-www-form-urlencoded",
          "X-CSRFToken": token,
          "X-Requested-With": "XMLHttpRequest",
          "X-IG-App-ID": "936619743392459",
          Cookie: `csrftoken=${token}`,
          Origin: "https://www.instagram.com",
          Referer: "https://www.instagram.com/accounts/emailsignup/",
        },
        body: new URLSearchParams({
          email,
          username: `anya${Date.now().toString(36)}`,
          first_name: "",
          opt_into_one_tap: "false",
        }).toString(),
        cache: "no-store",
        timeoutMs: PROXY_TIMEOUT,
      },
    );

    if (res.status === 429) {
      return base("Instagram", "instagram.com", { rateLimit: true });
    }

    const data = await jsonOrNull(res);
    const errors = data?.errors as Record<string, unknown> | undefined;
    const emailErrors = errors?.email;

    if (Array.isArray(emailErrors)) {
      const code = (emailErrors[0] as { code?: string })?.code;

      if (code === "email_is_taken" || String(emailErrors).includes("sharing")) {
        return base("Instagram", "instagram.com", { exists: true });
      }
    }

    if (data?.status === "fail") {
      return base("Instagram", "instagram.com", { rateLimit: true });
    }

    return base("Instagram", "instagram.com", { exists: false });
  } catch {
    return base("Instagram", "instagram.com", { error: true });
  }
}

/** Adobe — authorization username probe. */
export async function probeAdobe(
  email: string,
): Promise<EmailPresenceProbeResult> {
  try {
    const res = await fetchWithTimeout(
      "https://auth.services.adobe.com/signin/v2/users/authorization",
      {
        method: "POST",
        headers: {
          "User-Agent": UA,
          "Content-Type": "application/json",
          "X-IMS-ClientId": "adobedotcom2",
        },
        body: JSON.stringify({ username: email }),
        cache: "no-store",
        timeoutMs: TIMEOUT,
      },
    );

    if (res.status === 200) {
      return base("Adobe", "adobe.com", { exists: true });
    }

    if (res.status === 401 || res.status === 404) {
      return base("Adobe", "adobe.com", { exists: false });
    }

    return base("Adobe", "adobe.com", { rateLimit: true });
  } catch {
    return base("Adobe", "adobe.com", { error: true });
  }
}

/** Pinterest — signup email resource. */
export async function probePinterest(
  email: string,
): Promise<EmailPresenceProbeResult> {
  try {
    const res = await fetchWithTimeout(
      "https://www.pinterest.com/resource/EmailExistsResource/get/?source_url=%2F&data=" +
        encodeURIComponent(
          JSON.stringify({
            options: { email },
            context: {},
          }),
        ),
      {
        headers: {
          "User-Agent": UA,
          Accept: "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        cache: "no-store",
        timeoutMs: TIMEOUT,
      },
    );

    const data = await jsonOrNull(res);
    const resource = data?.resource_response as
      | { data?: boolean }
      | undefined;

    if (typeof resource?.data === "boolean") {
      return base("Pinterest", "pinterest.com", { exists: resource.data });
    }

    return base("Pinterest", "pinterest.com", { rateLimit: true });
  } catch {
    return base("Pinterest", "pinterest.com", { error: true });
  }
}

/**
 * LinkedIn — signup createAccount duplicate check.
 * Live capture: `{ errorType: "DUPLICATE_EMAIL" }` with no profile URL/URN.
 * Presence only — never yields /in/{slug}.
 */
export async function probeLinkedIn(
  email: string,
): Promise<EmailPresenceProbeResult> {
  try {
    const page = await fetchWithResidentialProxy("https://www.linkedin.com/signup", {
      headers: { "User-Agent": UA, Accept: "text/html" },
      cache: "no-store",
      timeoutMs: PROXY_TIMEOUT,
    });

    if (page.status === 429) {
      return base("LinkedIn", "linkedin.com", { rateLimit: true });
    }

    const html = await page.text();
    const setCookie = page.headers.getSetCookie?.() ?? [];
    const cookie = setCookie.map((c) => c.split(";")[0]).join("; ");
    const csrf =
      html.match(/csrfToken=([a-f0-9-]{20,})/i)?.[1] ||
      html.match(/data-browser-id="([a-f0-9-]{20,})"/i)?.[1];

    if (!csrf) {
      return base("LinkedIn", "linkedin.com", { error: true });
    }

    const res = await fetchWithResidentialProxy(
      `https://www.linkedin.com/signup/api/cors/createAccount?csrfToken=${csrf}`,
      {
        method: "POST",
        headers: {
          "User-Agent": UA,
          "Content-Type": "application/json",
          Accept: "application/json",
          Cookie: cookie,
          Origin: "https://www.linkedin.com",
          Referer: "https://www.linkedin.com/signup",
        },
        body: JSON.stringify({
          emailAddress: email,
          password: "AnyaPresenceCheck1!",
          firstName: "A",
          lastName: "B",
          source: null,
          redirectInfo: null,
          invitationInfo: null,
          sendConfirmationEmail: false,
        }),
        cache: "no-store",
        timeoutMs: PROXY_TIMEOUT,
      },
    );

    if (res.status === 429 || res.status === 999) {
      return base("LinkedIn", "linkedin.com", { rateLimit: true });
    }

    const data = await jsonOrNull(res);

    if (!data) {
      // Challenge / bot HTML — do not claim absence.
      return base("LinkedIn", "linkedin.com", { rateLimit: true });
    }

    const errorType =
      typeof data.errorType === "string" ? data.errorType : null;

    if (errorType === "DUPLICATE_EMAIL") {
      return base("LinkedIn", "linkedin.com", {
        exists: true,
        profileUrl: null,
        others: { Signal: "DUPLICATE_EMAIL" },
      });
    }

    // Bot / captcha gate before LinkedIn will confirm duplicate vs free.
    if (typeof data.challengeUrl === "string" && data.challengeUrl) {
      return base("LinkedIn", "linkedin.com", {
        rateLimit: true,
        others: { Signal: "challenge" },
      });
    }

    if (res.ok) {
      return base("LinkedIn", "linkedin.com", { exists: false });
    }

    return base("LinkedIn", "linkedin.com", {
      exists: false,
      others: errorType ? { Signal: errorType } : null,
    });
  } catch {
    return base("LinkedIn", "linkedin.com", { error: true });
  }
}

/** Flickr — sign up email check. */
export async function probeFlickr(
  email: string,
): Promise<EmailPresenceProbeResult> {
  try {
    const res = await fetchWithTimeout(
      "https://www.flickr.com/join/email",
      {
        method: "POST",
        headers: {
          "User-Agent": UA,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ email }).toString(),
        cache: "no-store",
        redirect: "manual",
        timeoutMs: TIMEOUT,
      },
    );

    const text = await res.text().catch(() => "");
    const lower = text.toLowerCase();

    if (lower.includes("already") || lower.includes("registered") || lower.includes("taken")) {
      return base("Flickr", "flickr.com", { exists: true });
    }

    if (res.status === 429) {
      return base("Flickr", "flickr.com", { rateLimit: true });
    }

    return base("Flickr", "flickr.com", { exists: false });
  } catch {
    return base("Flickr", "flickr.com", { error: true });
  }
}

/** Direct probes — no residential proxy bandwidth. */
export const EMAIL_PRESENCE_FREE_PROBES = [
  probeGravatar,
  probeGithub,
  probeMicrosoft,
  probeFirefox,
  probeSpotify,
  probeTumblr,
  probePinterest,
  probeAdobe,
  probeFlickr,
  probeTwitter,
] as const;

/** Instagram / LinkedIn signup checks — residential proxy. */
export const EMAIL_PRESENCE_PROXY_PROBES = [
  probeInstagram,
  probeLinkedIn,
] as const;

/** @deprecated Prefer FREE + PROXY arrays; kept for callers expecting the full set. */
export const EMAIL_PRESENCE_PROBES = [
  ...EMAIL_PRESENCE_FREE_PROBES,
  ...EMAIL_PRESENCE_PROXY_PROBES,
] as const;

export {
  EMAIL_PRESENCE_EXTRA_PROBES,
  EMAIL_PRESENCE_EXTRA_FREE_PROBES,
  EMAIL_PRESENCE_EXTRA_PROXY_PROBES,
} from "@/lib/email-presence/probes-extra";
export {
  EMAIL_PRESENCE_MAJOR_PROBES,
  EMAIL_PRESENCE_MAJOR_FREE_PROBES,
  EMAIL_PRESENCE_MAJOR_PROXY_PROBES,
} from "@/lib/email-presence/probes-majors";
export {
  probeDuolingo,
  probeSnapchat,
  probeFacebook,
  probeTikTok,
  probeDiscord,
  probeAtlassian,
  probeDropbox,
  probeArchiveOrg,
  probeLastFm,
  probeWordPress,
} from "@/lib/email-presence/probes-extra";
export {
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
} from "@/lib/email-presence/probes-majors";
