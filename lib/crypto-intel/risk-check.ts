import { detectCryptoChain, type CryptoChain } from "@/lib/crypto-wallet";
import {
  isMixerTagged,
  isSanctionTagged,
  lookupEntityLabel,
} from "@/lib/crypto-intel/labels";
import {
  CRYPTO_INTEL_DISCLAIMER,
  type CryptoIntelRiskLevel,
  type CryptoRiskCheckResult,
  type CryptoRiskFinding,
} from "@/lib/crypto-intel/types";

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });

    if (!res.ok) return null;

    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function maxSeverity(
  findings: CryptoRiskFinding[],
): CryptoIntelRiskLevel {
  const order: CryptoIntelRiskLevel[] = [
    "low",
    "elevated",
    "high",
    "critical",
  ];
  let best: CryptoIntelRiskLevel = "low";

  for (const finding of findings) {
    if (order.indexOf(finding.severity) > order.indexOf(best)) {
      best = finding.severity;
    }
  }

  return best;
}

type GoPlusTokenSecurity = {
  code?: number;
  result?: Record<
    string,
    {
      is_honeypot?: string;
      buy_tax?: string;
      sell_tax?: string;
      is_blacklisted?: string;
      is_open_source?: string;
      holder_count?: string;
      is_proxy?: string;
      cannot_sell_all?: string;
    }
  >;
};

async function checkEthTokenHoneypot(address: string): Promise<{
  checked: boolean;
  isHoneypot?: boolean;
  buyTax?: string;
  sellTax?: string;
  detail?: string;
  findings: CryptoRiskFinding[];
}> {
  const findings: CryptoRiskFinding[] = [];
  const data = await fetchJson<GoPlusTokenSecurity>(
    `https://api.gopluslabs.io/api/v1/token_security/1?contract_addresses=${encodeURIComponent(address.toLowerCase())}`,
  );

  const entry = data?.result?.[address.toLowerCase()];

  if (!entry) {
    return {
      checked: false,
      detail: "GoPlus token security unavailable or not a token contract.",
      findings,
    };
  }

  const isHoneypot = entry.is_honeypot === "1";
  const buyTax = entry.buy_tax;
  const sellTax = entry.sell_tax;

  if (isHoneypot) {
    findings.push({
      id: "honeypot",
      severity: "critical",
      title: "Honeypot signal",
      detail:
        "GoPlus flagged this contract as a honeypot (cannot sell / trap token). Treat as high risk.",
    });
  }

  if (entry.cannot_sell_all === "1") {
    findings.push({
      id: "cannot-sell-all",
      severity: "high",
      title: "Cannot sell all",
      detail: "Token may restrict selling the full balance.",
    });
  }

  if (entry.is_blacklisted === "1") {
    findings.push({
      id: "blacklist",
      severity: "high",
      title: "Blacklist function",
      detail: "Contract may have an address blacklist capability.",
    });
  }

  if (buyTax && Number(buyTax) > 10) {
    findings.push({
      id: "buy-tax",
      severity: "elevated",
      title: "High buy tax",
      detail: `Reported buy tax ≈ ${buyTax}%`,
    });
  }

  if (sellTax && Number(sellTax) > 10) {
    findings.push({
      id: "sell-tax",
      severity: "elevated",
      title: "High sell tax",
      detail: `Reported sell tax ≈ ${sellTax}%`,
    });
  }

  if (entry.is_open_source === "0") {
    findings.push({
      id: "not-open-source",
      severity: "elevated",
      title: "Not verified open source",
      detail: "Contract source may not be verified on explorers.",
    });
  }

  return {
    checked: true,
    isHoneypot,
    buyTax,
    sellTax,
    detail: isHoneypot
      ? "Honeypot indicators present"
      : "No honeypot flag from GoPlus (limited check)",
    findings,
  };
}

export async function runRiskCheck(
  query: string,
): Promise<CryptoRiskCheckResult> {
  const trimmed = query.trim();
  const chain = detectCryptoChain(trimmed) as CryptoChain | null;
  const findings: CryptoRiskFinding[] = [];
  const sources = ["Static entity label seed"];

  if (!chain) {
    return {
      kind: "crypto-risk",
      query: trimmed,
      queryType: "unknown",
      entity: null,
      findings: [
        {
          id: "invalid",
          severity: "elevated",
          title: "Unrecognized input",
          detail:
            "Enter a BTC / ETH / LTC / SOL address (or ETH token contract) for risk screening.",
        },
      ],
      riskLevel: "elevated",
      disclaimer: CRYPTO_INTEL_DISCLAIMER,
      sources,
    };
  }

  const entity = lookupEntityLabel(trimmed);

  if (isSanctionTagged(entity)) {
    findings.push({
      id: "sanctions",
      severity: "critical",
      title: "Sanctions seed match",
      detail: `${entity!.label} — tagged in the local OFAC-style seed list (${entity!.source}). Confirm against official SDN before acting.`,
    });
  }

  if (isMixerTagged(entity)) {
    findings.push({
      id: "mixer",
      severity: "high",
      title: "Mixer / tumbler seed match",
      detail: `${entity!.label} — labeled as a mixer in the static seed list. For compliance research only.`,
    });
  }

  if (entity && (entity.tags.includes("exchange") || entity.tags.includes("cex"))) {
    findings.push({
      id: "exchange",
      severity: "elevated",
      title: "Known exchange / CEX label",
      detail: `${entity.label} — appears in public exchange wallet label seeds.`,
    });
  }

  if (entity && entity.tags.includes("defi")) {
    findings.push({
      id: "defi",
      severity: "low",
      title: "Known DeFi contract",
      detail: `${entity.label} — public DEX / DeFi label.`,
    });
  }

  let honeypot: CryptoRiskCheckResult["honeypot"];

  if (chain === "ethereum") {
    const hp = await checkEthTokenHoneypot(trimmed);

    honeypot = {
      checked: hp.checked,
      isHoneypot: hp.isHoneypot,
      buyTax: hp.buyTax,
      sellTax: hp.sellTax,
      detail: hp.detail,
    };
    findings.push(...hp.findings);
    if (hp.checked) sources.push("GoPlus token security (free)");
  }

  if (findings.length === 0) {
    findings.push({
      id: "clear",
      severity: "low",
      title: "No seed / honeypot flags",
      detail:
        "No matches in the static label seed" +
        (chain === "ethereum"
          ? " and no GoPlus honeypot flag (when available)."
          : ".") +
        " Absence of flags is not clearance — expand labels or use commercial screening for production AML.",
    });
  }

  return {
    kind: "crypto-risk",
    query: trimmed,
    queryType: chain === "ethereum" ? "token" : "address",
    chain,
    entity,
    findings,
    riskLevel: maxSeverity(findings),
    honeypot,
    disclaimer: CRYPTO_INTEL_DISCLAIMER,
    sources,
  };
}
