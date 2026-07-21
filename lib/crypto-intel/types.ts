import type { CryptoChain, CryptoWalletResult } from "@/lib/crypto-wallet";
import type { EntityLabel } from "@/lib/crypto-intel/labels";

export type CryptoIntelRiskLevel = "low" | "elevated" | "high" | "critical";

export type CryptoAddressIntelResult = {
  kind: "crypto-address";
  wallet: CryptoWalletResult;
  entity: EntityLabel | null;
  riskFlags: string[];
  riskLevel: CryptoIntelRiskLevel;
  explorers: Array<{ name: string; url: string }>;
  disclaimer: string;
  sources: string[];
};

export type CryptoTxParty = {
  address?: string;
  label?: string | null;
  tags?: string[];
};

export type CryptoTxDeepDiveResult = {
  kind: "crypto-tx";
  chain: CryptoChain | "unknown";
  hash: string;
  status?: string;
  timestamp?: string;
  blockNumber?: string;
  fee?: string;
  value?: string;
  method?: string;
  from?: CryptoTxParty;
  to?: CryptoTxParty;
  summary: string;
  stats: Record<string, string>;
  explorers: Array<{ name: string; url: string }>;
  disclaimer: string;
  sources: string[];
};

export type CryptoRiskFinding = {
  id: string;
  severity: CryptoIntelRiskLevel;
  title: string;
  detail: string;
};

export type CryptoRiskCheckResult = {
  kind: "crypto-risk";
  query: string;
  queryType: "address" | "token" | "unknown";
  chain?: CryptoChain;
  entity: EntityLabel | null;
  findings: CryptoRiskFinding[];
  riskLevel: CryptoIntelRiskLevel;
  honeypot?: {
    checked: boolean;
    isHoneypot?: boolean;
    buyTax?: string;
    sellTax?: string;
    detail?: string;
  };
  disclaimer: string;
  sources: string[];
};

export type FundFlowHop = {
  hop: number;
  from: string;
  to: string;
  fromLabel?: string | null;
  toLabel?: string | null;
  txHash?: string;
  amount?: string;
  timestamp?: string;
  direction?: "in" | "out" | "self";
};

export type CryptoFundFlowResult = {
  kind: "crypto-flow";
  rootAddress: string;
  chain: CryptoChain;
  hops: FundFlowHop[];
  counterparties: Array<{
    address: string;
    label?: string | null;
    tags?: string[];
    direction: "in" | "out" | "both";
    txCount: number;
  }>;
  disclaimer: string;
  sources: string[];
};

export type CryptoFullSuiteResult = {
  kind: "crypto-full";
  query: string;
  inputKind: "wallet" | "tx";
  chainLabel: string | null;
  wallet: CryptoWalletResult | null;
  address: CryptoAddressIntelResult | null;
  risk: CryptoRiskCheckResult | null;
  flow: CryptoFundFlowResult | null;
  tx: CryptoTxDeepDiveResult | null;
  errors: Array<{ source: string; message: string }>;
  disclaimer: string;
  sources: string[];
};

export const CRYPTO_INTEL_DISCLAIMER =
  "Authorized OSINT / compliance research only. Uses public blockchain data and a static seed label list — not a substitute for commercial chain analytics or legal advice. Do not use to facilitate sanctions evasion or criminal activity.";
