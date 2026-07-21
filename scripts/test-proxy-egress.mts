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

const { fetchWithResidentialProxy, residentialProxyHostLabel } = await import(
  "../lib/residential-proxy.ts"
);
const { fetchWithTimeout } = await import("../lib/fetch-with-timeout.ts");

console.log("proxyHost", residentialProxyHostLabel());

const direct = await fetchWithTimeout("https://api.ipify.org?format=json", {
  timeoutMs: 15000,
});
console.log("direct", await direct.text());

const via = await fetchWithResidentialProxy("https://api.ipify.org?format=json", {
  timeoutMs: 20000,
  forceProxy: true,
});
console.log("viaProxy", await via.text());

// LinkedIn signup page status via proxy
const li = await fetchWithResidentialProxy("https://www.linkedin.com/signup", {
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    Accept: "text/html",
  },
  timeoutMs: 20000,
});
const html = await li.text();
console.log(
  JSON.stringify({
    linkedInStatus: li.status,
    len: html.length,
    hasCsrf: /csrfToken=|data-browser-id=/.test(html),
    title: html.match(/<title>([^<]+)/i)?.[1]?.trim()?.slice(0, 80),
    challenge: /challenge|captcha|authwall/i.test(html),
  }),
);

const ig = await fetchWithResidentialProxy(
  "https://www.instagram.com/accounts/emailsignup/",
  {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Accept: "text/html",
    },
    timeoutMs: 20000,
  },
);
const ightml = await ig.text();
console.log(
  JSON.stringify({
    igStatus: ig.status,
    len: ightml.length,
    hasCsrf: /csrf_token/.test(ightml),
    loginWall: /login|challenge|checkpoint/i.test(ightml.slice(0, 2000)),
    sniff: ightml.slice(0, 200).replace(/\s+/g, " "),
  }),
);
