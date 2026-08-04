/**
 * Phone presence probes (Contact Profiles).
 * Most socials only confirm registration; username leaks are rare.
 */

import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { fetchWithResidentialProxy } from "@/lib/residential-proxy";
import type { ContactPresenceProbeResult } from "@/lib/email-presence/types";
import type { NormalizedContact } from "@/lib/email-presence/normalize";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const TIMEOUT = 8_000;
const PROXY_TIMEOUT = 14_000;

type PhoneContact = Extract<NormalizedContact, { kind: "phone" }>;

function base(
  name: string,
  domain: string,
  partial: Partial<ContactPresenceProbeResult> = {},
): ContactPresenceProbeResult {
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

/** TikTok — passport phone registered check (presence; captcha-heavy). */
export async function probeTikTokPhone(
  phone: PhoneContact,
): Promise<ContactPresenceProbeResult> {
  try {
    const res = await fetchWithResidentialProxy(
      "https://www.tiktok.com/passport/web/user/check_phone_registered?aid=1459",
      {
        method: "POST",
        headers: {
          "User-Agent": UA,
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
          Referer: "https://www.tiktok.com/signup",
        },
        body: new URLSearchParams({
          mobile: phone.e164.replace(/^\+/, ""),
          account_sdk_source: "web",
          mix_mode: "1",
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
        phoneNumber: phone.display,
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

/** Instagram — phone signup availability (presence). */
export async function probeInstagramPhone(
  phone: PhoneContact,
): Promise<ContactPresenceProbeResult> {
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
    const csrf =
      html.match(/"csrf_token":"([^"]+)"/)?.[1] ||
      page.headers.get("set-cookie")?.match(/csrftoken=([^;]+)/)?.[1];

    if (!csrf) {
      return base("Instagram", "instagram.com", { rateLimit: true });
    }

    const res = await fetchWithResidentialProxy(
      "https://www.instagram.com/api/v1/web/accounts/web_create_ajax/attempt/",
      {
        method: "POST",
        headers: {
          "User-Agent": UA,
          "Content-Type": "application/x-www-form-urlencoded",
          "X-CSRFToken": csrf,
          "X-Requested-With": "XMLHttpRequest",
          "X-IG-App-ID": "936619743392459",
          Cookie: `csrftoken=${csrf}`,
          Referer: "https://www.instagram.com/accounts/emailsignup/",
        },
        body: new URLSearchParams({
          email: "",
          username: `anya${Date.now().toString(36)}`,
          first_name: "Anya",
          opt_into_one_tap: "false",
          phone_number: phone.e164,
        }).toString(),
        cache: "no-store",
        timeoutMs: PROXY_TIMEOUT,
      },
    );
    const data = await jsonOrNull(res);
    const blob = JSON.stringify(data ?? {}).toLowerCase();

    if (
      blob.includes("phone_number") &&
      (blob.includes("taken") ||
        blob.includes("registered") ||
        blob.includes("another account"))
    ) {
      return base("Instagram", "instagram.com", {
        exists: true,
        phoneNumber: phone.display,
      });
    }

    if (res.status === 429 || blob.includes("checkpoint") || blob.includes("spam")) {
      return base("Instagram", "instagram.com", { rateLimit: true });
    }

    // errors.phone_number empty + status ok often means available
    if (data && data.status === "ok") {
      return base("Instagram", "instagram.com", { exists: false });
    }

    return base("Instagram", "instagram.com", { rateLimit: true });
  } catch {
    return base("Instagram", "instagram.com", { error: true });
  }
}

/** Snapchat — merlin login with phone (presence when JSON returns). */
export async function probeSnapchatPhone(
  phone: PhoneContact,
): Promise<ContactPresenceProbeResult> {
  try {
    const res = await fetchWithResidentialProxy(
      "https://accounts.snapchat.com/accounts/merlin/login",
      {
        method: "POST",
        headers: {
          "User-Agent": UA,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phoneNumber: phone.e164,
          app: "BITMOJI_APP",
        }),
        cache: "no-store",
        timeoutMs: PROXY_TIMEOUT,
      },
    );

    if (res.status === 204) {
      return base("Snapchat", "snapchat.com", { exists: false });
    }

    const data = await jsonOrNull(res);

    if (typeof data?.hasSnapchat === "boolean") {
      return base("Snapchat", "snapchat.com", {
        exists: data.hasSnapchat,
        phoneNumber: phone.display,
      });
    }

    if (res.status === 405 || res.status === 403 || res.status === 429) {
      return base("Snapchat", "snapchat.com", { rateLimit: true });
    }

    return base("Snapchat", "snapchat.com", { rateLimit: true });
  } catch {
    return base("Snapchat", "snapchat.com", { error: true });
  }
}

/** Facebook — account recover identify by phone (presence heuristic). */
export async function probeFacebookPhone(
  phone: PhoneContact,
): Promise<ContactPresenceProbeResult> {
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
          email: phone.e164,
          did_submit: "1",
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

    if (
      text.includes("identify_browser") ||
      text.includes("account_recovery_initiate") ||
      (text.includes("send code") && text.includes("mobile"))
    ) {
      return base("Facebook", "facebook.com", {
        exists: true,
        phoneNumber: phone.display,
        others: { Signal: "recovery_flow" },
      });
    }

    return base("Facebook", "facebook.com", { rateLimit: true });
  } catch {
    return base("Facebook", "facebook.com", { error: true });
  }
}

/** Microsoft — GetCredentialType with phone-as-username (presence signal). */
export async function probeMicrosoftPhone(
  phone: PhoneContact,
): Promise<ContactPresenceProbeResult> {
  try {
    const res = await fetchWithTimeout(
      "https://login.microsoftonline.com/common/GetCredentialType?mkt=en-US",
      {
        method: "POST",
        headers: {
          "User-Agent": UA,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          username: phone.e164,
          isOtherIdpSupported: true,
          checkPhones: true,
          isRemoteNGCSupported: true,
          isCookieBannerShown: false,
          isFidoSupported: true,
        }),
        cache: "no-store",
        timeoutMs: TIMEOUT,
      },
    );

    if (!res.ok) {
      return base("Microsoft", "microsoft.com", { rateLimit: true });
    }

    const data = await jsonOrNull(res);
    // IfExistsResult: 0 = exists, 1 = not, 5/6 = federated/consumer variants
    const ifExists = data?.IfExistsResult;

    if (ifExists === 1) {
      return base("Microsoft", "microsoft.com", { exists: false });
    }

    if (typeof ifExists === "number") {
      return base("Microsoft", "microsoft.com", {
        exists: ifExists !== 1,
        phoneNumber: phone.display,
        others: { IfExistsResult: String(ifExists) },
      });
    }

    return base("Microsoft", "microsoft.com", { rateLimit: true });
  } catch {
    return base("Microsoft", "microsoft.com", { error: true });
  }
}

/** Twitter/X — phone available stub (often 404/auth-walled). */
export async function probeTwitterPhone(
  phone: PhoneContact,
): Promise<ContactPresenceProbeResult> {
  try {
    const res = await fetchWithResidentialProxy(
      `https://api.twitter.com/i/users/phone_number_available.json?raw_phone_number=${encodeURIComponent(phone.e164)}`,
      {
        headers: {
          "User-Agent": UA,
          Accept: "application/json",
        },
        cache: "no-store",
        timeoutMs: PROXY_TIMEOUT,
      },
    );

    if (res.status === 404 || res.status === 401 || res.status === 403) {
      return base("X (Twitter)", "x.com", { rateLimit: true });
    }

    const data = await jsonOrNull(res);

    if (typeof data?.valid === "boolean") {
      // valid:true usually means available (not taken)
      return base("X (Twitter)", "x.com", {
        exists: data.valid === false,
        phoneNumber: phone.display,
      });
    }

    return base("X (Twitter)", "x.com", { rateLimit: true });
  } catch {
    return base("X (Twitter)", "x.com", { error: true });
  }
}

/** WhatsApp — wa.me deep-link probe (weak presence heuristic via chat page). */
export async function probeWhatsAppPhone(
  phone: PhoneContact,
): Promise<ContactPresenceProbeResult> {
  try {
    const digits = phone.e164.replace(/\D/g, "");
    const res = await fetchWithTimeout(`https://wa.me/${digits}`, {
      headers: { "User-Agent": UA, Accept: "text/html" },
      cache: "no-store",
      redirect: "follow",
      timeoutMs: TIMEOUT,
    });
    const text = (await res.text()).toLowerCase();

    // wa.me always 200 for valid E.164 shapes — cannot reliably prove WA account.
    // Mark as inconclusive/rateLimit so we don't false-positive.
    if (res.ok && text.includes("whatsapp")) {
      return base("WhatsApp", "whatsapp.com", {
        rateLimit: true,
        others: { Signal: "wa_me_inconclusive" },
        phoneNumber: phone.display,
      });
    }

    return base("WhatsApp", "whatsapp.com", { rateLimit: true });
  } catch {
    return base("WhatsApp", "whatsapp.com", { error: true });
  }
}

type PhoneProbe = (
  phone: PhoneContact,
) => Promise<ContactPresenceProbeResult>;

/** Direct phone probes — no residential proxy. */
export const PHONE_PRESENCE_FREE_PROBES: PhoneProbe[] = [
  probeMicrosoftPhone,
  probeWhatsAppPhone,
];

/** Social phone signup checks — residential proxy. */
export const PHONE_PRESENCE_PROXY_PROBES: PhoneProbe[] = [
  probeTikTokPhone,
  probeInstagramPhone,
  probeSnapchatPhone,
  probeFacebookPhone,
  probeTwitterPhone,
];

/** @deprecated Prefer FREE + PROXY arrays. */
export const PHONE_PRESENCE_PROBES: PhoneProbe[] = [
  ...PHONE_PRESENCE_FREE_PROBES,
  ...PHONE_PRESENCE_PROXY_PROBES,
];
