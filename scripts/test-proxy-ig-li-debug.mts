import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal();

const email = process.argv[2]?.trim() || "indoshray@gmail.com";
const { fetchWithResidentialProxy } = await import("../lib/residential-proxy.ts");
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const page = await fetchWithResidentialProxy(
  "https://www.instagram.com/accounts/emailsignup/",
  {
    headers: { "User-Agent": UA, Accept: "text/html" },
    timeoutMs: 20000,
  },
);
const html = await page.text();
const patterns = [
  /\\"csrf_token\\":\\"([^"\\]+)\\"/,
  /"csrf_token":"([^"]+)"/,
  /csrf_token","([^"]+)"/,
  /{"csrf_token":"([^"]+)"/,
];
for (const p of patterns) {
  const m = html.match(p);
  console.log("pattern", p.toString(), "->", m?.[1]?.slice(0, 20) ?? null);
}

const token =
  html.match(/\\"csrf_token\\":\\"([^"\\]+)\\"/)?.[1] ||
  html.match(/"csrf_token"\s*:\s*"([^"]+)"/)?.[1] ||
  html.match(/csrf_token","([^"]+)"/)?.[1];

console.log("token?", Boolean(token), token?.slice(0, 12));

if (token) {
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
      timeoutMs: 20000,
    },
  );
  console.log("ig attempt", res.status, (await res.text()).slice(0, 500));
}

const liPage = await fetchWithResidentialProxy("https://www.linkedin.com/signup", {
  headers: { "User-Agent": UA, Accept: "text/html" },
  timeoutMs: 20000,
});
const liHtml = await liPage.text();
const cookies = liPage.headers.getSetCookie?.() ?? [];
const cookie = cookies.map((c) => c.split(";")[0]).join("; ");
const csrf =
  liHtml.match(/csrfToken=([a-f0-9-]{20,})/i)?.[1] ||
  liHtml.match(/data-browser-id="([a-f0-9-]{20,})"/i)?.[1];
console.log("li csrf", csrf, "cookies", cookies.length);

const liRes = await fetchWithResidentialProxy(
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
    timeoutMs: 20000,
  },
);
console.log("li create", liRes.status, (await liRes.text()).slice(0, 400));
