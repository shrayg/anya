/**
 * Extra Email Presence / Email→Profile probes (Anya TS, not Holehe package).
 * Prefer probes that return username/profileUrl when the vendor still leaks them.
 */

import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { fetchWithResidentialProxy } from "@/lib/residential-proxy";
import type { EmailPresenceProbeResult } from "@/lib/email-presence/types";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
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

/** Duolingo — public users?email= returns username when registered (Email→Profile). */
export async function probeDuolingo(
  email: string,
): Promise<EmailPresenceProbeResult> {
  try {
    const res = await fetchWithTimeout(
      `https://www.duolingo.com/2017-06-30/users?email=${encodeURIComponent(email)}`,
      {
        headers: { "User-Agent": UA, Accept: "application/json" },
        cache: "no-store",
        timeoutMs: TIMEOUT,
      },
    );

    if (res.status === 429) {
      return base("Duolingo", "duolingo.com", { rateLimit: true });
    }

    if (!res.ok) {
      return base("Duolingo", "duolingo.com", { rateLimit: true });
    }

    const data = await jsonOrNull(res);
    const users = Array.isArray(data?.users) ? data.users : [];

    if (users.length === 0) {
      return base("Duolingo", "duolingo.com", { exists: false });
    }

    const first = users[0] as Record<string, unknown>;
    const username =
      typeof first.username === "string"
        ? first.username
        : typeof first.name === "string"
          ? first.name
          : null;
    const profileUrl = username
      ? `https://www.duolingo.com/profile/${encodeURIComponent(username)}`
      : null;

    return base("Duolingo", "duolingo.com", {
      exists: true,
      profileUrl,
      others: username ? { Username: username } : null,
    });
  } catch {
    return base("Duolingo", "duolingo.com", { error: true });
  }
}

/** Archive.org — registration email taken check. */
export async function probeArchiveOrg(
  email: string,
): Promise<EmailPresenceProbeResult> {
  try {
    const res = await fetchWithTimeout(
      "https://archive.org/account/signup",
      {
        method: "POST",
        headers: {
          "User-Agent": UA,
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: new URLSearchParams({
          username: `anya${Date.now().toString(36)}`,
          email,
          password: "AnyaCheck1!",
          password_confirm: "AnyaCheck1!",
          submit: "Sign up",
        }).toString(),
        cache: "no-store",
        redirect: "manual",
        timeoutMs: TIMEOUT,
      },
    );
    const text = (await res.text()).toLowerCase();

    if (
      text.includes("already been taken") ||
      text.includes("already registered") ||
      text.includes("email address is already")
    ) {
      return base("Internet Archive", "archive.org", { exists: true });
    }

    if (res.status === 429) {
      return base("Internet Archive", "archive.org", { rateLimit: true });
    }

    return base("Internet Archive", "archive.org", { exists: false });
  } catch {
    return base("Internet Archive", "archive.org", { error: true });
  }
}

/** Discord — fingerprint registration email (often rate-limited / captcha). */
export async function probeDiscord(
  email: string,
): Promise<EmailPresenceProbeResult> {
  try {
    const res = await fetchWithResidentialProxy(
      "https://discord.com/api/v9/auth/register",
      {
        method: "POST",
        headers: {
          "User-Agent": UA,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          username: `anya${Date.now().toString(36)}`,
          password: "AnyaCheck1!x",
          date_of_birth: "1995-01-01",
          consent: true,
          gift_code_sku_id: null,
          invite: null,
        }),
        cache: "no-store",
        timeoutMs: PROXY_TIMEOUT,
      },
    );
    const data = await jsonOrNull(res);
    const blob = JSON.stringify(data ?? {}).toLowerCase();

    if (blob.includes("email") && (blob.includes("already") || blob.includes("registered"))) {
      return base("Discord", "discord.com", { exists: true });
    }

    if (res.status === 429 || blob.includes("captcha")) {
      return base("Discord", "discord.com", { rateLimit: true });
    }

    return base("Discord", "discord.com", { exists: false });
  } catch {
    return base("Discord", "discord.com", { error: true });
  }
}

/** Atlassian — check-email (presence). */
export async function probeAtlassian(
  email: string,
): Promise<EmailPresenceProbeResult> {
  try {
    const res = await fetchWithTimeout(
      "https://id.atlassian.com/rest/check-email",
      {
        method: "POST",
        headers: {
          "User-Agent": UA,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ email }),
        cache: "no-store",
        redirect: "follow",
        timeoutMs: TIMEOUT,
      },
    );

    if (res.status === 429) {
      return base("Atlassian", "atlassian.com", { rateLimit: true });
    }

    const data = await jsonOrNull(res);

    if (typeof data?.accountExists === "boolean") {
      return base("Atlassian", "atlassian.com", {
        exists: data.accountExists,
      });
    }

    if (typeof data?.exists === "boolean") {
      return base("Atlassian", "atlassian.com", { exists: data.exists });
    }

    // Some responses use action: "signup" | "login"
    if (data?.action === "login") {
      return base("Atlassian", "atlassian.com", { exists: true });
    }

    if (data?.action === "signup") {
      return base("Atlassian", "atlassian.com", { exists: false });
    }

    return base("Atlassian", "atlassian.com", { rateLimit: !res.ok });
  } catch {
    return base("Atlassian", "atlassian.com", { error: true });
  }
}

/** Dropbox — email exists (when endpoint available). */
export async function probeDropbox(
  email: string,
): Promise<EmailPresenceProbeResult> {
  try {
    const res = await fetchWithTimeout(
      "https://www.dropbox.com/clo/email_exists",
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

    if (res.status === 404) {
      return base("Dropbox", "dropbox.com", { rateLimit: true });
    }

    const data = await jsonOrNull(res);

    if (typeof data?.email_exists === "boolean") {
      return base("Dropbox", "dropbox.com", { exists: data.email_exists });
    }

    if (typeof data?.exists === "boolean") {
      return base("Dropbox", "dropbox.com", { exists: data.exists });
    }

    return base("Dropbox", "dropbox.com", { rateLimit: true });
  } catch {
    return base("Dropbox", "dropbox.com", { error: true });
  }
}

/**
 * Snapchat — legacy merlin/login when xsrf is present; otherwise the new
 * Janus WebLogin path requires Web Attestation (WASM) and is marked rateLimited
 * for server-side scans. Browser login for indoshray@gmail.com advanced to the
 * password step (account exists) but did not expose a username/profile URL.
 */
export async function probeSnapchat(
  email: string,
): Promise<EmailPresenceProbeResult> {
  try {
    const page = await fetchWithResidentialProxy("https://accounts.snapchat.com", {
      headers: { "User-Agent": UA, Accept: "text/html" },
      cache: "no-store",
      timeoutMs: PROXY_TIMEOUT,
    });
    const html = await page.text();
    const xsrf = html.match(/data-xsrf="([^"]+)"/)?.[1];
    const webClientId =
      html.match(/data-web-client-id="([^"]+)"/)?.[1] ||
      html.match(/ata-web-client-id="([^"]+)"/)?.[1];

    if (!xsrf) {
      // New Next.js accounts UI — try JSON merlin without token (often 403).
      const res = await fetchWithResidentialProxy(
        "https://accounts.snapchat.com/accounts/merlin/login",
        {
          method: "POST",
          headers: {
            "User-Agent": UA,
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, app: "BITMOJI_APP" }),
          cache: "no-store",
          timeoutMs: PROXY_TIMEOUT,
        },
      );
      const text = await res.text();

      if (res.status === 204) {
        return base("Snapchat", "snapchat.com", { exists: false });
      }

      try {
        const data = JSON.parse(text) as { hasSnapchat?: boolean };

        if (typeof data.hasSnapchat === "boolean") {
          return base("Snapchat", "snapchat.com", {
            exists: data.hasSnapchat,
          });
        }
      } catch {
        /* fall through */
      }

      return base("Snapchat", "snapchat.com", { rateLimit: true });
    }

    const res = await fetchWithResidentialProxy(
      "https://accounts.snapchat.com/accounts/merlin/login",
      {
        method: "POST",
        headers: {
          "User-Agent": UA,
          Accept: "*/*",
          "X-XSRF-TOKEN": xsrf,
          "Content-Type": "application/json",
          Cookie: `xsrf_token=${xsrf}; web_client_id=${webClientId ?? ""}`,
        },
        body: JSON.stringify({ email, app: "BITMOJI_APP" }),
        cache: "no-store",
        timeoutMs: PROXY_TIMEOUT,
      },
    );

    if (res.status === 204) {
      return base("Snapchat", "snapchat.com", { exists: false });
    }

    const data = await jsonOrNull(res);

    if (typeof data?.hasSnapchat === "boolean") {
      return base("Snapchat", "snapchat.com", { exists: data.hasSnapchat });
    }

    return base("Snapchat", "snapchat.com", { rateLimit: true });
  } catch {
    return base("Snapchat", "snapchat.com", { error: true });
  }
}

/** Facebook — recover identify (HTML/ajax; often blocked without browser cookies). */
export async function probeFacebook(
  email: string,
): Promise<EmailPresenceProbeResult> {
  try {
    const res = await fetchWithResidentialProxy(
      "https://www.facebook.com/login/identify/?ctx=recover",
      {
        method: "POST",
        headers: {
          "User-Agent": UA,
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "text/html",
          Origin: "https://www.facebook.com",
          Referer: "https://www.facebook.com/login/identify/?ctx=recover",
        },
        body: new URLSearchParams({
          email,
          did_submit: "1",
          lsdd: "",
          lsdd_reset: "",
        }).toString(),
        cache: "no-store",
        redirect: "manual",
        timeoutMs: PROXY_TIMEOUT,
      },
    );
    const text = (await res.text()).toLowerCase();

    if (
      text.includes("no search results") ||
      text.includes("couldn't find your account") ||
      text.includes("could not find your account") ||
      text.includes("we couldn't find")
    ) {
      return base("Facebook", "facebook.com", { exists: false });
    }

    // Stronger positive: account picker / masked identity surfaces.
    if (
      text.includes("identify_browser") ||
      text.includes("account_recovery_initiate") ||
      (text.includes("send code") && text.includes("@"))
    ) {
      return base("Facebook", "facebook.com", {
        exists: true,
        others: { Signal: "recovery_flow" },
      });
    }

    return base("Facebook", "facebook.com", { rateLimit: true });
  } catch {
    return base("Facebook", "facebook.com", { error: true });
  }
}

/** TikTok — passport check_email_registered (captcha-heavy). */
export async function probeTikTok(
  email: string,
): Promise<EmailPresenceProbeResult> {
  try {
    const res = await fetchWithResidentialProxy(
      "https://www.tiktok.com/passport/web/user/check_email_registered?aid=1459",
      {
        method: "POST",
        headers: {
          "User-Agent": UA,
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
          Referer: "https://www.tiktok.com/signup",
        },
        body: new URLSearchParams({
          email,
          account_sdk_source: "web",
        }).toString(),
        cache: "no-store",
        timeoutMs: PROXY_TIMEOUT,
      },
    );
    const data = await jsonOrNull(res);
    const inner = (data?.data as Record<string, unknown> | undefined) ?? data;
    const errorCode = inner?.error_code ?? data?.error_code;
    const isRegistered = inner?.is_registered ?? inner?.registered;

    if (typeof isRegistered === "boolean" || isRegistered === 0 || isRegistered === 1) {
      return base("TikTok", "tiktok.com", {
        exists: Boolean(isRegistered),
      });
    }

    if (errorCode === 7 || res.status === 429) {
      return base("TikTok", "tiktok.com", { rateLimit: true });
    }

    return base("TikTok", "tiktok.com", { rateLimit: true });
  } catch {
    return base("TikTok", "tiktok.com", { error: true });
  }
}

/** Last.fm — signup email check. */
export async function probeLastFm(
  email: string,
): Promise<EmailPresenceProbeResult> {
  try {
    const res = await fetchWithTimeout(
      "https://www.last.fm/join/partial/email",
      {
        method: "POST",
        headers: {
          "User-Agent": UA,
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: new URLSearchParams({ email }).toString(),
        cache: "no-store",
        timeoutMs: TIMEOUT,
      },
    );
    const data = await jsonOrNull(res);
    const text = JSON.stringify(data ?? {}).toLowerCase();

    if (text.includes("already") || text.includes("taken") || text.includes("registered")) {
      return base("Last.fm", "last.fm", { exists: true });
    }

    if (res.ok && (data?.valid === true || data?.available === true)) {
      return base("Last.fm", "last.fm", { exists: false });
    }

    if (res.status === 429) {
      return base("Last.fm", "last.fm", { rateLimit: true });
    }

    return base("Last.fm", "last.fm", { exists: false });
  } catch {
    return base("Last.fm", "last.fm", { error: true });
  }
}

/** WordPress.com — signup email validation. */
export async function probeWordPress(
  email: string,
): Promise<EmailPresenceProbeResult> {
  try {
    const res = await fetchWithTimeout(
      "https://public-api.wordpress.com/rest/v1.1/users/email/" +
        encodeURIComponent(email) +
        "/validate",
      {
        headers: { "User-Agent": UA, Accept: "application/json" },
        cache: "no-store",
        timeoutMs: TIMEOUT,
      },
    );
    const data = await jsonOrNull(res);

    if (data?.success === false || data?.error === "email_exists") {
      return base("WordPress", "wordpress.com", { exists: true });
    }

    if (data?.success === true) {
      return base("WordPress", "wordpress.com", { exists: false });
    }

    return base("WordPress", "wordpress.com", { rateLimit: !res.ok });
  } catch {
    return base("WordPress", "wordpress.com", { error: true });
  }
}

export const EMAIL_PRESENCE_EXTRA_PROBES = [
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
] as const;
