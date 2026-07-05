import {
  PUBLIC_AI_LABEL,
  PUBLIC_INTEL_SOURCE,
} from "@/lib/public-branding";
import {
  fetchOsintCatEndpoint,
  fetchOsintCatStealerLogs,
  filterDiscordResultsForId,
} from "@/lib/osintcat";
import {
  fetchGodsEyeEmailReport,
  fetchGodsEyeFivem,
  fetchGodsEyeSearchSafe,
  resolveGodsEyeSearchType,
  sanitizeGodsEyeSearch,
} from "@/lib/godseye";
import {
  fetchCombinedOsintCatEndpoint,
  fetchCombinedStealerLogs,
} from "@/lib/osint-combined";
import {
  detectCryptoChain,
  lookupCryptoWallet,
  type CryptoWalletResult,
} from "@/lib/crypto-wallet";
import { fetchDiscordProfile } from "@/lib/discord-profile";
import { normalizeDomain } from "@/lib/domain-search";
import {
  normalizeEmail,
  searchProxynovaCombForDomain,
  searchProxynovaCombForEmail,
} from "@/lib/proxynova-comb";

export { detectCryptoChain };

export type AiMode =
  | "search"
  | "deep"
  | "crypto"
  | "threat"
  | "email"
  | "username"
  | "domain"
  | "identity"
  | "phishing"
  | "social"
  | "stealer"
  | "pattern"
  | "summary"
  | "auto";

export type AiSignal = {
  level: "info" | "warn" | "critical";
  title: string;
  detail: string;
};

export type AiPivot = {
  label: string;
  slug: string;
  reason: string;
};

export type AiIntelResult = {
  mode: AiMode;
  query: string;
  queryType: string;
  riskScore: number;
  riskLabel: "Low" | "Moderate" | "Elevated" | "High";
  aiBrief: string;
  signals: AiSignal[];
  recommendations: string[];
  entities: { label: string; value: string }[];
  sources: string[];
  elapsedMs: number;
  confidence?: number;
  insights?: string[];
  pivots?: AiPivot[];
  raw?: Record<string, unknown>;
};

const VALID_AI_MODES = new Set<string>([
  "search",
  "deep",
  "crypto",
  "threat",
  "email",
  "username",
  "domain",
  "identity",
  "phishing",
  "social",
  "stealer",
  "pattern",
  "summary",
  "auto",
]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const IP_RE = /^(?:\d{1,3}\.){3}\d{1,3}$/;
const DOMAIN_RE = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const URL_RE = /^https?:\/\//i;

const DISPOSABLE_DOMAINS = new Set([
  "tempmail.com",
  "guerrillamail.com",
  "mailinator.com",
  "yopmail.com",
  "10minutemail.com",
  "throwaway.email",
  "sharklasers.com",
]);

const SUSPICIOUS_TLDS = new Set([
  "xyz",
  "top",
  "tk",
  "ml",
  "ga",
  "cf",
  "gq",
  "buzz",
  "cam",
]);

export function resolveAiMode(mode: string | null, query: string): AiMode {
  if (mode && VALID_AI_MODES.has(mode)) {
    return mode as AiMode;
  }

  if (detectCryptoChain(query)) return "crypto";
  return "search";
}

export function classifyQuery(query: string): string {
  const trimmed = query.trim();

  if (detectCryptoChain(trimmed)) {
    return `crypto:${detectCryptoChain(trimmed)}`;
  }
  if (URL_RE.test(trimmed)) return "url";
  if (EMAIL_RE.test(trimmed)) return "email";
  if (IP_RE.test(trimmed)) return "ip";
  if (/^\d{17,20}$/.test(trimmed)) return "discord";
  if (DOMAIN_RE.test(trimmed)) return "domain";
  if (/^[a-f0-9]{32}$/i.test(trimmed)) return "hash:md5";
  if (/^[a-f0-9]{40}$/i.test(trimmed)) return "hash:sha1";
  if (/^[a-f0-9]{64}$/i.test(trimmed)) return "hash:sha256";
  if (trimmed.length >= 3) return "username";

  return "unknown";
}

function riskLabel(score: number): AiIntelResult["riskLabel"] {
  if (score >= 75) return "High";
  if (score >= 50) return "Elevated";
  if (score >= 25) return "Moderate";
  return "Low";
}

function baseResult(
  mode: AiMode,
  query: string,
  queryType: string,
  start: number,
): Pick<
  AiIntelResult,
  "mode" | "query" | "queryType" | "elapsedMs"
> & {
  signals: AiSignal[];
  recommendations: string[];
  entities: { label: string; value: string }[];
  sources: string[];
  insights: string[];
  pivots: AiPivot[];
} {
  return {
    mode,
    query,
    queryType,
    signals: [],
    recommendations: [],
    entities: [],
    sources: [],
    insights: [],
    pivots: [],
    elapsedMs: Date.now() - start,
  };
}

async function fetchOsint(
  _apiKey: string,
  endpoint: string,
  query: string,
): Promise<Record<string, unknown> | null> {
  try {
    return await fetchOsintCatEndpoint(endpoint, query);
  } catch {
    return null;
  }
}

function countBreachHits(data: Record<string, unknown> | null): number {
  if (!data) return 0;

  const breachData = data.breach_data ?? data.results ?? data.data;

  if (Array.isArray(breachData)) return breachData.length;
  if (typeof data.results_count === "number") return data.results_count;

  return 0;
}

function isExposureSource(source: string): boolean {
  return (
    source.includes("Stealer") ||
    source.includes("Breach") ||
    source.includes("COMB") ||
    source.includes("Discord Leaks")
  );
}

function countIntelHits(
  data: Record<string, unknown> | null,
  source?: string,
): number {
  if (!data) return 0;

  if (source && !isExposureSource(source)) {
    return 0;
  }

  if (typeof data.returned === "number" && Array.isArray(data.credentials)) {
    return data.returned;
  }

  if (typeof data.count === "number" && Array.isArray(data.results)) {
    return data.count;
  }

  const leaks = data.leaks as Record<string, unknown> | undefined;

  if (leaks && typeof leaks.count === "number") {
    return leaks.count;
  }

  return countBreachHits(data);
}

function applyPayloadHits(
  partial: ReturnType<typeof baseResult>,
  payloads: Record<string, Record<string, unknown> | null>,
  riskScore: { value: number },
): number {
  let totalHits = 0;

  for (const [source, data] of Object.entries(payloads)) {
    if (!data) continue;

    const hits = countIntelHits(data, source);

    if (hits <= 0) continue;

    totalHits += hits;
    partial.entities.push({ label: source, value: `${hits} hit(s)` });
    addBreachSignals(partial.signals, source, hits, riskScore);

    if (!partial.sources.includes(source)) {
      partial.sources.push(source);
    }
  }

  return totalHits;
}

function addBreachSignals(
  signals: AiSignal[],
  source: string,
  hits: number,
  riskScore: { value: number },
) {
  if (hits > 0) {
    signals.push({
      level: hits >= 5 ? "critical" : "warn",
      title: `${source} exposure`,
      detail: `${hits} indexed record(s) matched this target.`,
    });
    riskScore.value += Math.min(40, hits * 8);
  }
}

function usernameVariants(username: string): string[] {
  const base = username.replace(/^@/, "").trim();
  const variants = new Set([
    base,
    `${base}1`,
    `${base}123`,
    `${base}_`,
    `_${base}`,
    `${base}.official`,
    `${base}x`,
    base.toLowerCase(),
    base.toUpperCase(),
  ]);

  return Array.from(variants).slice(0, 8);
}

function extractDomain(input: string): string {
  const trimmed = input.trim().toLowerCase();

  try {
    if (URL_RE.test(trimmed)) {
      return new URL(trimmed).hostname;
    }
  } catch {
    return trimmed.replace(/^www\./, "");
  }

  return trimmed.replace(/^www\./, "");
}

async function gatherOsint(
  apiKey: string | undefined,
  query: string,
  queryType: string,
  depth: "normal" | "deep" | "stealer" = "normal",
): Promise<Record<string, Record<string, unknown> | null>> {
  const payloads: Record<string, Record<string, unknown> | null> = {};
  const trimmed = query.trim();
  const isDeep = depth === "deep" || depth === "stealer";
  const tasks: Promise<void>[] = [];

  const add = (label: string, promise: Promise<unknown>) => {
    tasks.push(
      promise
        .then((data) => {
          payloads[label] = data as Record<string, unknown>;
        })
        .catch(() => {
          payloads[label] = null;
        }),
    );
  };

  const email = normalizeEmail(trimmed);
  const domain =
    normalizeDomain(trimmed) ??
    (queryType === "domain" || queryType === "url" ? extractDomain(trimmed) : null);

  if (email) {
    add("Breached Data (COMB)", searchProxynovaCombForEmail(email, { limit: 100 }));
    add("Stealer Logs", fetchCombinedStealerLogs(email));
    add(
      `${PUBLIC_INTEL_SOURCE} · Email`,
      fetchGodsEyeEmailReport(email).then((report) => report ?? {}),
    );
  } else if (domain) {
    add("Breached Data (COMB)", searchProxynovaCombForDomain(domain, { limit: 100 }));
    add("Stealer Logs", fetchCombinedStealerLogs(domain));
    add(
      "DNS",
      fetchCombinedOsintCatEndpoint("dns-resolver", domain, "domain"),
    );
    add(
      `${PUBLIC_INTEL_SOURCE} · Domain`,
      fetchGodsEyeSearchSafe("domain", domain).then((data) => data ?? {}),
    );
  } else if (queryType === "ip" || IP_RE.test(trimmed)) {
    add("IP Geo", fetchCombinedOsintCatEndpoint("ip", trimmed, "ip"));
    add(
      `${PUBLIC_INTEL_SOURCE} · IP`,
      fetchGodsEyeSearchSafe("ip", trimmed).then((data) => data ?? {}),
    );
    if (apiKey) {
      add(`${PUBLIC_INTEL_SOURCE} · Breach`, fetchOsintCatEndpoint("breach", trimmed));
    }
  } else if (queryType === "discord") {
    add(
      "Discord Profile",
      fetchDiscordProfile(trimmed).then((profile) => ({ profile })),
    );

    add(
      "Discord Leaks",
      fetchOsintCatEndpoint("discord", trimmed)
        .then((data) => filterDiscordResultsForId(trimmed, data))
        .catch(() => ({ count: 0, results: [] })),
    );
    add(
      `${PUBLIC_INTEL_SOURCE} · Discord`,
      fetchGodsEyeSearchSafe("discord", trimmed).then((data) =>
        sanitizeGodsEyeSearch(data),
      ),
    );
    add(
      `${PUBLIC_INTEL_SOURCE} · FiveM`,
      Promise.all([
        fetchGodsEyeFivem("accounts", trimmed),
        fetchGodsEyeFivem("bans", trimmed),
      ]).then(([accounts, bans]) => ({ accounts, bans })),
    );
    if (apiKey) {
      add(`${PUBLIC_INTEL_SOURCE} · Breach`, fetchOsintCatEndpoint("breach", trimmed));
    }
  } else {
    const searchType = resolveGodsEyeSearchType(trimmed, null, queryType);

    if (apiKey) {
      add(`${PUBLIC_INTEL_SOURCE} · Breach`, fetchOsintCatEndpoint("breach", trimmed));
    }

    add(
      `${PUBLIC_INTEL_SOURCE} · Search`,
      fetchGodsEyeSearchSafe(searchType, trimmed).then((data) => data ?? {}),
    );

    if (isDeep) {
      add("Stealer Logs", fetchCombinedStealerLogs(trimmed));
    }
  }

  if (isDeep) {
    if (queryType !== "discord" && !queryType.startsWith("crypto:")) {
      add(
        `${PUBLIC_INTEL_SOURCE} · Reddit`,
        fetchGodsEyeSearchSafe("reddit", trimmed).then((data) => data ?? {}),
      );
      add(
        `${PUBLIC_INTEL_SOURCE} · Roblox`,
        fetchGodsEyeSearchSafe("roblox", trimmed).then((data) => data ?? {}),
      );
    }

    if (!email && !domain && queryType !== "ip" && queryType !== "discord") {
      add("Stealer Logs", fetchCombinedStealerLogs(trimmed));
    }
  }

  await Promise.all(tasks);

  return payloads;
}

function finalizeResult(
  partial: ReturnType<typeof baseResult> & {
    riskScore: number;
    aiBrief: string;
    confidence?: number;
    raw?: Record<string, unknown>;
  },
): AiIntelResult {
  const score = Math.min(100, Math.max(0, partial.riskScore));

  return {
    ...partial,
    riskScore: score,
    riskLabel: riskLabel(score),
    confidence: partial.confidence ?? Math.min(95, 55 + partial.sources.length * 8),
  };
}

function chainDisplay(chain: CryptoWalletResult["chain"]): string {
  if (chain === "bitcoin") return "Bitcoin";
  if (chain === "ethereum") return "Ethereum";
  return "Solana";
}

function buildCryptoAnalysis(
  query: string,
  wallet: CryptoWalletResult,
  breachData: Record<string, unknown> | null,
  stealerData: Record<string, unknown> | null,
): AiIntelResult {
  const start = Date.now();
  const partial = baseResult("crypto", query, `crypto:${wallet.chain}`, start);
  let riskScore = 12;

  partial.entities.push({ label: "Chain", value: chainDisplay(wallet.chain) });
  partial.entities.push({ label: "Address", value: wallet.address });
  partial.entities.push({ label: "Balance", value: wallet.balance });
  if (wallet.balanceUsd) {
    partial.entities.push({ label: "Balance (USD)", value: wallet.balanceUsd });
  }
  partial.entities.push({ label: "Transactions", value: String(wallet.txCount) });
  if (wallet.ensName) {
    partial.entities.push({ label: "ENS", value: wallet.ensName });
  }

  if (wallet.txCount > 500) {
    partial.signals.push({
      level: "warn",
      title: "High transaction volume",
      detail: `${wallet.txCount.toLocaleString()} txs — likely service, exchange, or mixer wallet.`,
    });
    riskScore += 28;
  } else if (wallet.txCount === 0) {
    partial.signals.push({
      level: "info",
      title: "No on-chain activity",
      detail: "Address has no indexed transactions yet.",
    });
  }

  if (wallet.isContract) {
    partial.signals.push({
      level: "info",
      title: "Smart contract",
      detail: "Address is a contract — flows may be automated routing or token contracts.",
    });
    riskScore += 10;
  }

  if (wallet.tokens.length > 15) {
    partial.signals.push({
      level: "warn",
      title: "Wide token exposure",
      detail: `${wallet.tokens.length} token balances detected — common for DeFi or exchange wallets.`,
    });
    riskScore += 12;
  }

  partial.insights.push(
    `On-chain activity: ${wallet.txCount.toLocaleString()} transactions indexed.`,
  );

  if (wallet.recentTransactions.length > 0) {
    partial.insights.push(
      `${wallet.recentTransactions.length} recent transaction(s) captured for flow review.`,
    );
  }

  const breachHits = countIntelHits(breachData);
  const stealerHits = countIntelHits(stealerData);

  if (breachHits > 0) {
    addBreachSignals(partial.signals, "Breach index", breachHits, { value: riskScore });
    partial.entities.push({ label: "Breach rows", value: String(breachHits) });
    partial.insights.push(`${breachHits} breach record(s) mention this address.`);
    partial.sources.push(`${PUBLIC_INTEL_SOURCE} · Breach`);
  }

  if (stealerHits > 0) {
    addBreachSignals(partial.signals, "Stealer Logs", stealerHits, { value: riskScore });
    partial.entities.push({ label: "Stealer log rows", value: String(stealerHits) });
    partial.insights.push(`${stealerHits} stealer log row(s) tied to this wallet.`);
    partial.sources.push("Stealer Logs");
  }

  partial.sources.push(PUBLIC_AI_LABEL, "On-chain index");
  partial.recommendations.push("Trace flows on a block explorer.");
  partial.recommendations.push("Run Stealer Logs if linked to infostealer data.");
  partial.pivots.push({
    label: "Stealer Logs",
    slug: "stealer-logs",
    reason: "Cross-check wallet against stealer-derived identifiers.",
  });

  return finalizeResult({
    ...partial,
    riskScore,
    aiBrief: `${chainDisplay(wallet.chain)} wallet ${wallet.balance}${wallet.balanceUsd ? ` (${wallet.balanceUsd})` : ""}. Risk ${riskLabel(riskScore)} (${riskScore}/100).`,
    raw: { wallet, breach: breachData, stealer: stealerData },
  });
}

function buildEmailProfiler(
  query: string,
  payloads: Record<string, Record<string, unknown> | null>,
): AiIntelResult {
  const start = Date.now();
  const partial = baseResult("email", query, "email", start);
  let riskScore = 10;
  const domain = query.split("@")[1]?.toLowerCase() ?? "";

  partial.entities.push({ label: "Email", value: query });
  partial.entities.push({ label: "Domain", value: domain });

  if (DISPOSABLE_DOMAINS.has(domain)) {
    partial.signals.push({
      level: "warn",
      title: "Disposable inbox",
      detail: `${domain} is a known throwaway email provider.`,
    });
    riskScore += 25;
    partial.insights.push("Target uses a disposable email domain.");
  }

  const risk = { value: riskScore };
  const totalHits = applyPayloadHits(partial, payloads, risk);
  riskScore = risk.value;

  if (totalHits > 0) {
    partial.insights.push(
      `${totalHits} total exposure row(s) across breaches and stealer indexes.`,
    );
  } else {
    partial.signals.push({
      level: "info",
      title: "No indexed exposure",
      detail: "Email not found in COMB, stealer logs, or breach indexes this pass.",
    });
  }

  partial.sources.unshift(`${PUBLIC_AI_LABEL} · Email`);
  partial.recommendations.push("Review stealer log rows for recovered passwords and cookies.");
  partial.recommendations.push("Pivot to username variants on social modules.");
  partial.pivots.push(
    { label: "Stealer Logs", slug: "stealer-logs", reason: "Raw stealer + breach rows." },
    { label: "Breaches", slug: "breaches", reason: "COMB credential dump pass." },
    { label: "AI Deep Scan", slug: "ai-deep-scan", reason: "Fuse with other identifiers." },
  );

  return finalizeResult({
    ...partial,
    riskScore,
    aiBrief: `Email profiler scored ${query}. ${totalHits} exposure row(s). Risk ${riskLabel(riskScore)}.`,
    raw: payloads,
  });
}

function buildUsernameGraph(
  query: string,
  payloads: Record<string, Record<string, unknown> | null>,
): AiIntelResult {
  const start = Date.now();
  const partial = baseResult("username", query, "username", start);
  const risk = { value: 8 };
  const variants = usernameVariants(query);

  partial.entities.push({ label: "Base handle", value: query });
  partial.entities.push({ label: "AI variants", value: variants.join(", ") });

  const totalHits = applyPayloadHits(partial, payloads, risk);

  if (totalHits > 0) {
    partial.insights.push(`${totalHits} breach or stealer row(s) mention this handle.`);
  }

  partial.insights.push(`Generated ${variants.length} handle variants for pivoting.`);
  partial.insights.push("Try variants on Instagram, GitHub, and Reddit modules.");

  partial.sources.unshift(`${PUBLIC_AI_LABEL} · Username`);
  partial.recommendations.push("Try platform modules for handle expansion.");
  partial.pivots.push(
    { label: "Stealer Logs", slug: "stealer-logs", reason: "Infostealer mentions." },
    { label: "Instagram", slug: "instagram", reason: "Expand social footprint." },
    { label: "Reddit", slug: "reddit", reason: "Check Reddit profile history." },
    { label: "GitHub", slug: "github", reason: "Find repos and commit emails." },
  );

  return finalizeResult({
    ...partial,
    riskScore: risk.value,
    aiBrief: `Username graph mapped "${query}" with ${variants.length} variants and ${totalHits} exposure row(s).`,
    raw: { ...payloads, variants },
  });
}

function buildDomainIntel(
  query: string,
  domain: string,
  payloads: Record<string, Record<string, unknown> | null>,
): AiIntelResult {
  const start = Date.now();
  const partial = baseResult("domain", query, "domain", start);
  const risk = { value: 10 };
  const tld = domain.split(".").pop()?.toLowerCase() ?? "";

  partial.entities.push({ label: "Domain", value: domain });

  if (SUSPICIOUS_TLDS.has(tld)) {
    partial.signals.push({
      level: "warn",
      title: "Suspicious TLD",
      detail: `.${tld} domains appear frequently in phishing and spam campaigns.`,
    });
    risk.value += 22;
  }

  if (domain.split(".").length > 3) {
    partial.signals.push({
      level: "info",
      title: "Deep subdomain",
      detail: "Multi-level subdomain — common in tracking and phishing pages.",
    });
    risk.value += 10;
  }

  const totalHits = applyPayloadHits(partial, payloads, risk);

  if (payloads.DNS) {
    partial.insights.push("DNS records retrieved for enrichment.");
  }

  if (totalHits > 0) {
    partial.insights.push(
      `${totalHits} stealer or breach row(s) tied to this domain.`,
    );
  }

  partial.sources.unshift(`${PUBLIC_AI_LABEL} · Domain`);
  partial.recommendations.push("Run Threat Brief on suspicious URLs.");
  partial.pivots.push(
    { label: "Stealer Logs", slug: "stealer-logs", reason: "Stealer logs and breached data for this site." },
    { label: "Threat Brief", slug: "threat-brief", reason: "Score exposure risk." },
  );

  return finalizeResult({
    ...partial,
    riskScore: risk.value,
    aiBrief: `Domain intel for ${domain}. ${totalHits} exposure row(s). Risk ${riskLabel(risk.value)}.`,
    raw: payloads,
  });
}

function buildPhishingCheck(query: string, queryType: string): AiIntelResult {
  const start = Date.now();
  const partial = baseResult("phishing", query, queryType, start);
  let riskScore = 15;
  const target = queryType === "url" ? extractDomain(query) : query;

  partial.entities.push({ label: "Target", value: target });

  if (queryType === "url" && query.includes("@")) {
    partial.signals.push({
      level: "critical",
      title: "Credential trap URL",
      detail: "URL contains @ — classic credential phishing pattern.",
    });
    riskScore += 45;
  }

  if (/login|secure|verify|account|wallet|update/i.test(query)) {
    partial.signals.push({
      level: "warn",
      title: "Phishing keyword match",
      detail: "Path or host contains high-risk social-engineering terms.",
    });
    riskScore += 20;
  }

  const tld = extractDomain(target).split(".").pop()?.toLowerCase() ?? "";

  if (SUSPICIOUS_TLDS.has(tld)) {
    partial.signals.push({
      level: "warn",
      title: "Risky TLD",
      detail: `.${tld} frequently used in short-lived phishing hosts.`,
    });
    riskScore += 18;
  }

  partial.insights.push("Heuristic pass — no live sandbox execution.");
  partial.sources.push(`${PUBLIC_AI_LABEL} · Phishing`);
  partial.recommendations.push("Compare against known brand domains.");
  partial.pivots.push({ label: "Stealer Logs", slug: "stealer-logs", reason: "Stealer logs and breached data pass." });

  return finalizeResult({
    ...partial,
    riskScore,
    aiBrief: `Phishing check on "${target}": ${partial.signals.length} flag(s). Risk ${riskLabel(riskScore)}.`,
  });
}

function buildSocialPivot(
  query: string,
  payloads: Record<string, Record<string, unknown> | null>,
): AiIntelResult {
  const start = Date.now();
  const partial = baseResult("social", query, "username", start);
  const risk = { value: 8 };
  const handle = query.replace(/^@/, "").replace(/.*\//, "");

  partial.entities.push({ label: "Handle", value: handle });

  const platforms = [
    "Instagram",
    "Twitter",
    "TikTok",
    "Reddit",
    "GitHub",
    "Telegram",
    "Discord",
  ];

  partial.insights.push(`Suggested platform pivots: ${platforms.join(", ")}.`);

  const totalHits = applyPayloadHits(partial, payloads, risk);

  if (totalHits > 0) {
    partial.insights.push(`${totalHits} breach or stealer row(s) mention this handle.`);
  }

  partial.sources.unshift(`${PUBLIC_AI_LABEL} · Social`);
  partial.recommendations.push("Open each platform module with this handle.");
  partial.pivots.push(
    { label: "Stealer Logs", slug: "stealer-logs", reason: "Infostealer cross-check." },
    { label: "Instagram", slug: "instagram", reason: "Profile and link search." },
    { label: "Twitter", slug: "twitter", reason: "X / Twitter footprint." },
    { label: "Username", slug: "username", reason: "Generate handle variants." },
  );

  return finalizeResult({
    ...partial,
    riskScore: risk.value,
    aiBrief: `Social pivot map for "${handle}" — ${totalHits} exposure row(s), ${platforms.length} platform routes.`,
    raw: { ...payloads, platforms },
  });
}

function buildStealerCorrelator(
  query: string,
  queryType: string,
  payloads: Record<string, Record<string, unknown> | null>,
): AiIntelResult {
  const start = Date.now();
  const partial = baseResult("stealer", query, queryType, start);
  let riskScore = 14;

  partial.entities.push({ label: "Seed", value: query });
  partial.entities.push({ label: "Seed type", value: queryType });

  let totalHits = 0;

  for (const [source, data] of Object.entries(payloads)) {
    const hits = countIntelHits(data, source);

    totalHits += hits;

    if (hits > 0) {
      partial.signals.push({
        level: hits >= 3 ? "critical" : "warn",
        title: `${source} stealer correlation`,
        detail: `${hits} record(s) — possible infostealer log overlap.`,
      });
      riskScore += Math.min(35, hits * 9);
    }
  }

  if (totalHits === 0) {
    partial.signals.push({
      level: "info",
      title: "No stealer correlation",
      detail: "Seed not strongly linked to indexed stealer/breach rows.",
    });
  } else {
    partial.insights.push(`${totalHits} total correlated rows across indexes.`);
  }

  partial.sources.push(`${PUBLIC_AI_LABEL} · Stealer`, ...Object.keys(payloads));
  partial.recommendations.push("File results into Case ID mind map.");
  partial.pivots.push(
    { label: "Stealer Logs", slug: "stealer-logs", reason: "Raw stealer module." },
    { label: "IntelX", slug: "intelx", reason: "Pull archived storage IDs." },
  );

  return finalizeResult({
    ...partial,
    riskScore,
    aiBrief: `Stealer correlator found ${totalHits} linked row(s) for ${queryType} "${query}".`,
    raw: payloads,
  });
}

function buildPatternMatch(query: string, queryType: string): AiIntelResult {
  const start = Date.now();
  const partial = baseResult("pattern", query, queryType, start);
  let riskScore = 5;

  partial.entities.push({ label: "Input type", value: queryType });
  partial.entities.push({ label: "Length", value: String(query.length) });

  if (queryType.startsWith("hash:")) {
    partial.signals.push({
      level: "info",
      title: "Hash format confirmed",
      detail: `Input matches ${queryType.replace("hash:", "").toUpperCase()} pattern.`,
    });
    partial.insights.push("Pivot hash to breach and stealer modules.");
    partial.pivots.push({ label: "Hash", slug: "username", reason: "Run as breach query." });
  } else if (query.length < 8) {
    partial.signals.push({
      level: "warn",
      title: "Weak secret length",
      detail: "Short strings crack quickly in offline attacks.",
    });
    riskScore += 20;
  } else if (/[A-Z]/.test(query) && /[a-z]/.test(query) && /\d/.test(query)) {
    partial.insights.push("Mixed charset — moderate password complexity.");
  }

  partial.sources.push(`${PUBLIC_AI_LABEL} · Pattern`);
  partial.recommendations.push("Never reuse leaked passwords across services.");

  return finalizeResult({
    ...partial,
    riskScore,
    aiBrief: `Pattern analysis classified input as ${queryType}.`,
  });
}

function buildCaseSummary(query: string): AiIntelResult {
  const start = Date.now();
  const partial = baseResult("summary", query.slice(0, 200), "intel-blob", start);
  let riskScore = 10;

  const emails = query.match(/[^\s@]+@[^\s@]+\.[^\s@]+/g) ?? [];
  const ips = query.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g) ?? [];
  const domains = query.match(/\b[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g) ?? [];

  partial.entities.push({ label: "Emails found", value: String(emails.length) });
  partial.entities.push({ label: "IPs found", value: String(ips.length) });
  partial.entities.push({ label: "Domains found", value: String(domains.length) });
  partial.entities.push({ label: "Char count", value: String(query.length) });

  if (emails.length > 0) {
    const email = emails[0]!;
    partial.insights.push(`Primary email candidate: ${email}`);
    partial.pivots.push({ label: "Email", slug: "email", reason: email });
    riskScore += 10;
  }

  if (ips.length > 0) {
    partial.pivots.push({ label: "IP", slug: "ip", reason: ips[0]! });
  }

  partial.sources.push(`${PUBLIC_AI_LABEL} · Case summary`);
  partial.recommendations.push("Add structured findings to Case ID.");

  return finalizeResult({
    ...partial,
    riskScore,
    aiBrief: `Summarized intel blob: ${emails.length} email(s), ${ips.length} IP(s), ${domains.length} domain(s).`,
    raw: { emails, ips, domains: domains.slice(0, 20) },
  });
}

function buildDeepScan(
  query: string,
  queryType: string,
  payloads: Record<string, Record<string, unknown> | null>,
): AiIntelResult {
  const start = Date.now();
  const partial = baseResult("deep", query, queryType, start);
  const risk = { value: 12 };

  const profilePayload = payloads["Discord Profile"];

  if (profilePayload?.profile && typeof profilePayload.profile === "object") {
    const profile = profilePayload.profile as {
      displayName?: string;
      username?: string;
    };

    partial.entities.push({
      label: "Discord",
      value: profile.displayName || profile.username || query,
    });
    partial.insights.push("Live Discord profile resolved.");
    partial.sources.push("Discord Profile");
  }

  const totalHits = applyPayloadHits(partial, payloads, risk);

  partial.insights.push(`Deep scan queried ${Object.keys(payloads).length} indexes.`);
  partial.insights.push(`Aggregate exposure rows: ${totalHits}.`);

  partial.sources.unshift(`${PUBLIC_AI_LABEL} · Deep scan`);
  partial.recommendations.push("Run Threat Brief for a tighter risk read.");
  partial.pivots.push(
    { label: "Stealer Logs", slug: "stealer-logs", reason: "Raw stealer module." },
    { label: "Threat Brief", slug: "threat-brief", reason: "Focused risk pass." },
    { label: "AI Search", slug: "ai-search", reason: "Synthesize findings." },
  );

  return finalizeResult({
    ...partial,
    riskScore: risk.value,
    aiBrief: `Deep scan complete on ${queryType} "${query}" — ${totalHits} total exposure row(s).`,
    confidence: Math.min(98, 60 + partial.sources.length * 6),
    raw: payloads,
  });
}

function buildThreatBrief(
  query: string,
  queryType: string,
  osintPayloads: Record<string, Record<string, unknown> | null>,
): AiIntelResult {
  const start = Date.now();
  const partial = baseResult("threat", query, queryType, start);
  const risk = { value: 10 };

  const totalHits = applyPayloadHits(partial, osintPayloads, risk);

  if (partial.signals.length === 0) {
    partial.signals.push({
      level: "info",
      title: "Clean surface scan",
      detail: "No exposures in COMB, stealer logs, or breach indexes.",
    });
  } else {
    partial.insights.push(`${totalHits} total exposure row(s) across queried sources.`);
  }

  partial.sources.unshift(`${PUBLIC_AI_LABEL} · Threat brief`);
  partial.recommendations.push("Add findings to Case ID mind map.");

  return finalizeResult({
    ...partial,
    riskScore: risk.value,
    aiBrief: `Threat brief: ${partial.signals.length} signal(s), ${totalHits} exposure row(s) for ${queryType} "${query}".`,
    raw: osintPayloads,
  });
}

function buildAiSearch(
  query: string,
  queryType: string,
  osintPayloads: Record<string, Record<string, unknown> | null>,
): AiIntelResult {
  const start = Date.now();
  const partial = baseResult("search", query, queryType, start);
  const risk = { value: 8 };

  partial.entities.push({ label: "Detected type", value: queryType });

  const totalHits = applyPayloadHits(partial, osintPayloads, risk);

  if (totalHits > 0) {
    partial.insights.push(
      `${totalHits} exposure row(s) from breaches, stealer logs, and related indexes.`,
    );
  } else if (queryType === "email") {
    partial.signals.push({
      level: "info",
      title: "No indexed exposure",
      detail: "Email clear in COMB and stealer indexes this pass.",
    });
  }

  partial.sources.unshift(PUBLIC_AI_LABEL);
  partial.pivots.push(
    { label: "Stealer Logs", slug: "stealer-logs", reason: "View raw stealer rows." },
    { label: "AI Deep Scan", slug: "ai-deep-scan", reason: "Go deeper." },
  );

  return finalizeResult({
    ...partial,
    riskScore: risk.value,
    aiBrief: `AI Search classified "${query}" as ${queryType}. ${totalHits} exposure row(s). Risk ${riskLabel(risk.value)}.`,
    raw: osintPayloads,
  });
}

function buildIdentityMerge(
  query: string,
  queryType: string,
  payloads: Record<string, Record<string, unknown> | null>,
): AiIntelResult {
  const start = Date.now();
  const partial = baseResult("identity", query, queryType, start);
  const risk = { value: 10 };

  partial.entities.push({ label: "Primary identifier", value: query });
  partial.entities.push({ label: "Class", value: queryType });

  for (const [source, data] of Object.entries(payloads)) {
    if (!data) continue;

    if (!partial.sources.includes(source)) {
      partial.sources.push(source);
    }

    const hits = countIntelHits(data, source);

    if (hits > 0) {
      partial.insights.push(`${source}: ${hits} matching record(s).`);
    }
  }

  applyPayloadHits(partial, payloads, risk);

  partial.sources.unshift(`${PUBLIC_AI_LABEL} · Identity`);
  partial.recommendations.push("Link merged intel into a Case ID file.");
  partial.pivots.push(
    { label: "Stealer Logs", slug: "stealer-logs", reason: "Cross-check infostealer data." },
    { label: "AI Deep Scan", slug: "ai-deep-scan", reason: "Expand index coverage." },
    { label: "Breaches", slug: "breaches", reason: "COMB credential pass." },
  );

  return finalizeResult({
    ...partial,
    riskScore: risk.value,
    aiBrief: `Identity merge fused ${Object.keys(payloads).length} source(s) for ${queryType} "${query}".`,
    raw: payloads,
  });
}

export async function runAiIntel(
  query: string,
  mode: AiMode,
  apiKey: string | undefined,
): Promise<AiIntelResult> {
  const trimmed = query.trim();
  const queryType = classifyQuery(trimmed);
  const resolvedMode = mode === "auto" ? resolveAiMode(null, trimmed) : mode;

  if (resolvedMode === "crypto" || (resolvedMode !== "phishing" && queryType.startsWith("crypto:"))) {
    const chain = detectCryptoChain(trimmed);

    if (!chain) {
      return finalizeResult({
        ...baseResult("crypto", trimmed, queryType, Date.now()),
        riskScore: 0,
        aiBrief:
          "Invalid crypto address. Expected Bitcoin (1/3/bc1), Ethereum (0x), or Solana.",
        signals: [
          {
            level: "warn",
            title: "Format mismatch",
            detail: "Input does not match supported wallet patterns.",
          },
        ],
        recommendations: ["Verify address and chain."],
      });
    }

    const breachPromise = apiKey
      ? fetchOsint(apiKey, "breach", trimmed)
      : Promise.resolve(null);
    const stealerPromise = fetchCombinedStealerLogs(trimmed).catch(() => null);
    const godseyePromise = fetchGodsEyeSearchSafe("crypto", trimmed);

    let wallet: CryptoWalletResult;

    try {
      wallet = await lookupCryptoWallet(trimmed);
    } catch (error) {
      return finalizeResult({
        ...baseResult("crypto", trimmed, queryType, Date.now()),
        riskScore: 0,
        aiBrief:
          error instanceof Error ? error.message : "Wallet lookup failed.",
        signals: [
          {
            level: "warn",
            title: "Lookup failed",
            detail: "Could not resolve wallet data from on-chain sources.",
          },
        ],
        recommendations: ["Verify address and chain."],
      });
    }

    const [breachData, stealerData, godseyeData] = await Promise.all([
      breachPromise,
      stealerPromise,
      godseyePromise,
    ]);

    const result = buildCryptoAnalysis(
      trimmed,
      wallet,
      breachData,
      stealerData as Record<string, unknown> | null,
    );

    const godseyeHits = countIntelHits(
      godseyeData as Record<string, unknown> | null,
    );

    if (godseyeHits > 0) {
      result.signals.push({
        level: godseyeHits >= 5 ? "critical" : "warn",
        title: `${PUBLIC_INTEL_SOURCE} exposure`,
        detail: `${godseyeHits} indexed record(s) matched this wallet.`,
      });
      result.sources.push(PUBLIC_INTEL_SOURCE);
      result.raw = {
        ...(result.raw ?? {}),
        godseye: godseyeData,
      };
    }

    return result;
  }

  if (resolvedMode === "summary") {
    return buildCaseSummary(trimmed);
  }

  if (resolvedMode === "pattern") {
    return buildPatternMatch(trimmed, queryType);
  }

  if (resolvedMode === "phishing") {
    return buildPhishingCheck(trimmed, queryType);
  }

  if (resolvedMode === "email") {
    const payloads = await gatherOsint(apiKey, trimmed, "email", "normal");
    return buildEmailProfiler(trimmed, payloads);
  }

  if (resolvedMode === "username") {
    const payloads = await gatherOsint(apiKey, trimmed, "username", "normal");
    return buildUsernameGraph(trimmed, payloads);
  }

  if (resolvedMode === "domain") {
    const payloads = await gatherOsint(apiKey, trimmed, "domain", "normal");
    return buildDomainIntel(trimmed, extractDomain(trimmed), payloads);
  }

  if (resolvedMode === "social") {
    const payloads = await gatherOsint(apiKey, trimmed, "username", "normal");
    return buildSocialPivot(trimmed, payloads);
  }

  if (resolvedMode === "stealer") {
    const payloads = await gatherOsint(apiKey, trimmed, queryType, "stealer");
    return buildStealerCorrelator(trimmed, queryType, payloads);
  }

  if (resolvedMode === "deep") {
    const payloads = await gatherOsint(apiKey, trimmed, queryType, "deep");
    return buildDeepScan(trimmed, queryType, payloads);
  }

  if (resolvedMode === "identity") {
    const payloads = await gatherOsint(apiKey, trimmed, queryType, "deep");
    return buildIdentityMerge(trimmed, queryType, payloads);
  }

  const osintPayloads = await gatherOsint(apiKey, trimmed, queryType, "normal");

  if (resolvedMode === "threat") {
    return buildThreatBrief(trimmed, queryType, osintPayloads);
  }

  return buildAiSearch(trimmed, queryType, osintPayloads);
}

export function aiModeFromSidebarItem(itemName: string | null): AiMode {
  const map: Record<string, AiMode> = {
    "AI Search": "search",
    "AI Deep Scan": "deep",
    "Crypto AI Analyse": "crypto",
    "Threat Brief": "threat",
  };

  if (itemName && map[itemName]) return map[itemName];
  return "auto";
}
