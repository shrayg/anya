/**
 * LinkedIn profile resolution from email/phone.
 *
 * Client network findings (verified 2026-07-21, indoshray@gmail.com):
 * - Signup `createAccount` returns only `{ errorType: "DUPLICATE_EMAIL" }` —
 *   no publicIdentifier, member URN, or /in/ URL is exposed to the browser.
 * - Password reset confirms existence with a masked address + OTP challenge —
 *   again no profile identity in HTML/JSON/cookies.
 * - Guest Sales Nav `viewByEmail` is an empty SPA shell (login wall).
 * - Guest Voyager endpoints fail CSRF / 400 / 404; cookie/CSRF manipulation
 *   alone cannot escalate email → profile.
 * - Official Handle Lookup (`/v2/clientAwareMemberHandles`) needs partner OAuth.
 *
 * Therefore true 100%-for-all-emails LinkedIn reverse lookup is not available
 * from client-visible traffic. Members can also disable email discovery.
 *
 * High confidence LinkedIn URL requires one of:
 * 1) Operator LinkedIn session (`LINKEDIN_LI_AT`) that returns a publicIdentifier
 * 2) SERP hit where the snippet/title contains the identifier + /in/ slug
 * 3) Corroboration across independent pivots (never claimed as 100% alone)
 */

import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { lookupLinkedInByEmailSession } from "@/lib/profile-resolve/linkedin-session";
import {
  getSerperApiKey,
  searchSerper,
  type SerperOrganic,
} from "@/lib/serp/serper";

export type LinkedInResolveConfidence = "high" | "medium" | "low";

export type LinkedInResolveMethod =
  | "session-email"
  | "serp-exact"
  | "serp-loose"
  | "github-author-email"
  | "github-slug-candidate";

export type LinkedInResolveHit = {
  profileUrl: string;
  publicIdentifier: string;
  title: string | null;
  snippet: string | null;
  method: LinkedInResolveMethod;
  confidence: LinkedInResolveConfidence;
  evidence: string[];
};

export type LinkedInResolveResult = {
  query: string;
  kind: "email" | "phone";
  hits: LinkedInResolveHit[];
  /** Deterministic non-LinkedIn pivots that help investigators. */
  pivots: Array<{
    platform: "github";
    url: string;
    label: string;
    confidence: LinkedInResolveConfidence;
    evidence: string[];
  }>;
  methodsTried: string[];
  warning?: string;
  durationMs: number;
};

function extractPublicId(url: string): string | null {
  const m = url.match(/linkedin\.com\/in\/([A-Za-z0-9_\-%]+)/i);

  return m?.[1] ? decodeURIComponent(m[1]).replace(/\/$/, "") : null;
}

function normalizeProfileUrl(url: string): string | null {
  const id = extractPublicId(url);

  return id ? `https://www.linkedin.com/in/${id}` : null;
}

async function serperSearch(q: string): Promise<SerperOrganic[]> {
  return searchSerper(q, 10);
}

function pickLinkedInFromSerp(
  organics: SerperOrganic[],
  identifier: string,
  method: LinkedInResolveMethod,
): LinkedInResolveHit[] {
  const needle = identifier.toLowerCase();
  const hits: LinkedInResolveHit[] = [];

  for (const row of organics) {
    const link = row.link ?? "";
    const profileUrl = normalizeProfileUrl(link);

    if (!profileUrl) continue;

    const publicIdentifier = extractPublicId(profileUrl)!;
    const blob = `${row.title ?? ""} ${row.snippet ?? ""}`.toLowerCase();
    const emailInSnippet = blob.includes(needle);
    const confidence: LinkedInResolveConfidence =
      method === "serp-exact" && emailInSnippet
        ? "high"
        : method === "serp-exact"
          ? "medium"
          : emailInSnippet
            ? "medium"
            : "low";

    hits.push({
      profileUrl,
      publicIdentifier,
      title: row.title ?? null,
      snippet: row.snippet ?? null,
      method,
      confidence,
      evidence: [
        `SERP ${method}`,
        emailInSnippet
          ? "Identifier appears in title/snippet"
          : "LinkedIn URL from SERP without identifier in snippet",
      ],
    });
  }

  return dedupeHits(hits);
}

function dedupeHits(hits: LinkedInResolveHit[]): LinkedInResolveHit[] {
  const byId = new Map<string, LinkedInResolveHit>();

  for (const hit of hits) {
    const prev = byId.get(hit.publicIdentifier.toLowerCase());

    if (!prev || rank(hit) > rank(prev)) {
      byId.set(hit.publicIdentifier.toLowerCase(), hit);
    }
  }

  return [...byId.values()].sort((a, b) => rank(b) - rank(a));
}

function rank(hit: LinkedInResolveHit): number {
  const conf = hit.confidence === "high" ? 3 : hit.confidence === "medium" ? 2 : 1;
  const method =
    hit.method === "session-email"
      ? 40
      : hit.method === "serp-exact"
        ? 30
        : hit.method === "serp-loose"
          ? 20
          : 10;

  return conf * 10 + method;
}

async function resolveViaSerp(email: string): Promise<{
  hits: LinkedInResolveHit[];
  tried: string[];
}> {
  const tried: string[] = [];
  const hits: LinkedInResolveHit[] = [];

  if (!getSerperApiKey()) {
    return { hits, tried: ["serper(skipped-no-key)"] };
  }

  const exactQ = `"${email}" site:linkedin.com`;

  tried.push(`serper:${exactQ}`);
  hits.push(
    ...pickLinkedInFromSerp(await serperSearch(exactQ), email, "serp-exact"),
  );

  if (hits.length === 0) {
    const looseQ = `${email} site:linkedin.com`;

    tried.push(`serper:${looseQ}`);
    hits.push(
      ...pickLinkedInFromSerp(await serperSearch(looseQ), email, "serp-loose"),
    );
  }

  return { hits: dedupeHits(hits), tried };
}

type GithubCommitSearch = {
  total_count: number;
  items?: Array<{
    html_url?: string;
    author?: { login?: string; html_url?: string } | null;
    commit?: { author?: { name?: string; email?: string } };
  }>;
};

const githubEmailCache = new Map<
  string,
  {
    pivots: LinkedInResolveResult["pivots"];
    slugCandidates: string[];
    tried: string[];
    at: number;
  }
>();

const GITHUB_CACHE_MS = 5 * 60_000;

async function resolveViaGithubEmail(email: string): Promise<{
  pivots: LinkedInResolveResult["pivots"];
  slugCandidates: string[];
  tried: string[];
}> {
  const cached = githubEmailCache.get(email);

  if (cached && Date.now() - cached.at < GITHUB_CACHE_MS) {
    return {
      pivots: cached.pivots,
      slugCandidates: cached.slugCandidates,
      tried: [...cached.tried, "github:cache-hit"],
    };
  }

  const tried = [`github:author-email:${email}`];
  const pivots: LinkedInResolveResult["pivots"] = [];
  const slugCandidates: string[] = [];

  try {
    const url = `https://api.github.com/search/commits?q=${encodeURIComponent(
      `author-email:${email}`,
    )}&per_page=10`;
    const res = await fetchWithTimeout(url, {
      headers: {
        "User-Agent": "AnyaInt-LinkedInResolve",
        Accept: "application/vnd.github.cloak-preview+json",
      },
      cache: "no-store",
      timeoutMs: 12_000,
    });

    if (!res.ok) {
      tried.push(`github:http-${res.status}`);
      const empty = { pivots, slugCandidates, tried };

      if (res.status === 403 || res.status === 429) {
        // Keep prior cache if any
        if (cached) return { ...cached, tried: [...tried, "github:stale-cache"] };
      }

      return empty;
    }

    const json = (await res.json()) as GithubCommitSearch;
    const logins = new Map<string, number>();

    for (const item of json.items ?? []) {
      const login = item.author?.login?.trim();

      if (!login) continue;
      logins.set(login, (logins.get(login) ?? 0) + 1);
    }

    const ranked = [...logins.entries()].sort((a, b) => b[1] - a[1]);

    for (const [login, count] of ranked.slice(0, 3)) {
      pivots.push({
        platform: "github",
        url: `https://github.com/${login}`,
        label: login,
        confidence: "high",
        evidence: [
          `GitHub commit author-email matches (${count} sample hit(s); total≈${json.total_count})`,
        ],
      });
      slugCandidates.push(login);

      // Common vanity variants worth checking as LinkedIn slug candidates only.
      if (/g$/i.test(login) && login.length > 2) {
        slugCandidates.push(login.slice(0, -1));
        slugCandidates.push(`${login.slice(0, -1)}y`);
      }
    }

    const packed = { pivots, slugCandidates, tried, at: Date.now() };

    githubEmailCache.set(email, packed);
  } catch {
    tried.push("github:error");
    if (cached) return { ...cached, tried: [...tried, "github:stale-cache"] };
  }

  return {
    pivots,
    slugCandidates: [...new Set(slugCandidates.map((s) => s.toLowerCase()))],
    tried,
  };
}

function slugCandidateHits(
  slugs: string[],
  githubLogins: string[],
): LinkedInResolveHit[] {
  const hits: LinkedInResolveHit[] = [];

  for (const slug of slugs) {
    const exactGithub = githubLogins.includes(slug);
    const evidence = [
      "Candidate LinkedIn vanity URL derived from GitHub identity",
      exactGithub
        ? "Slug equals GitHub login (stronger candidate — still needs SERP/contact corroboration for LinkedIn)"
        : "Slug variant heuristic from GitHub login (weak — not proof)",
    ];

    hits.push({
      profileUrl: `https://www.linkedin.com/in/${slug}`,
      publicIdentifier: slug,
      title: null,
      snippet: null,
      method: "github-slug-candidate",
      confidence: exactGithub ? "medium" : "low",
      evidence,
    });
  }

  return hits;
}

export async function resolveLinkedInFromIdentifier(input: {
  query: string;
  kind?: "email" | "phone";
}): Promise<LinkedInResolveResult> {
  const started = Date.now();
  const query = input.query.trim();
  const kind =
    input.kind ??
    (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(query) ? "email" : "phone");

  const methodsTried: string[] = [];
  let hits: LinkedInResolveHit[] = [];
  let pivots: LinkedInResolveResult["pivots"] = [];

  if (kind === "email") {
    const email = query.toLowerCase();

    // 1) Operator LinkedIn session (only path that can return LinkedIn-native identity)
    const session = await lookupLinkedInByEmailSession(email);

    methodsTried.push(...session.methodsTried);

    if (session.status === "matched" && session.hit) {
      hits.push({
        profileUrl: session.hit.profileUrl,
        publicIdentifier: session.hit.publicIdentifier,
        title:
          [session.hit.firstName, session.hit.lastName]
            .filter(Boolean)
            .join(" ") || null,
        snippet: session.hit.headline,
        method: "session-email",
        confidence: "high",
        evidence: [
          "Operator LinkedIn session returned publicIdentifier for this email",
          session.detail ?? "session-email",
        ],
      });
    } else if (session.status !== "no_session") {
      methodsTried.push(`session:status:${session.status}`);
    }

    // 2) SERP + GitHub pivots (secondary; SERP only when Contact Info is indexed)
    const serp = await resolveViaSerp(email);

    methodsTried.push(...serp.tried);
    hits.push(...serp.hits);

    const github = await resolveViaGithubEmail(email);

    methodsTried.push(...github.tried);
    pivots = github.pivots;

    const githubLogins = pivots.map((p) => p.label.toLowerCase());

    // Only surface slug candidates when we lack a high LinkedIn hit.
    if (!hits.some((h) => h.confidence === "high")) {
      hits.push(...slugCandidateHits(github.slugCandidates, githubLogins));
    }
  } else {
    methodsTried.push("phone:serp-variants-deferred-to-index-sweep");
  }

  hits = dedupeHits(hits);

  const high = hits.filter((h) => h.confidence === "high");
  const warningParts: string[] = [];

  if (!getSerperApiKey()) {
    warningParts.push(
      "SERPER_API_KEY is not set — live Google SERP resolution is disabled.",
    );
  }

  if (kind === "email" && high.length === 0) {
    warningParts.push(
      "No high-confidence LinkedIn match. Guest LinkedIn email forms only confirm account existence (DUPLICATE_EMAIL / reset OTP) and never expose /in/{slug} to the client. Set LINKEDIN_LI_AT for operator session reverse-email, or rely on indexed Contact Info / pivots. Members who disable email discovery cannot be resolved this way — 100% coverage for all emails is not available.",
    );
  }

  return {
    query,
    kind,
    hits,
    pivots,
    methodsTried,
    warning: warningParts.length ? warningParts.join(" ") : undefined,
    durationMs: Date.now() - started,
  };
}
