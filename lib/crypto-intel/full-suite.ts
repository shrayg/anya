import { runAddressIntel } from "@/lib/crypto-intel/address-intel";
import { detectCryptoInput } from "@/lib/crypto-intel/detect";
import { runFundFlow } from "@/lib/crypto-intel/fund-flow";
import { runRiskCheck } from "@/lib/crypto-intel/risk-check";
import { runTxDeepDive } from "@/lib/crypto-intel/tx-deep-dive";
import type { CryptoFullSuiteResult } from "@/lib/crypto-intel/types";
import { CRYPTO_INTEL_DISCLAIMER } from "@/lib/crypto-intel/types";
import {
  CRYPTO_WALLET_INVALID_MESSAGE,
  detectCryptoChain,
  lookupCryptoWallet,
} from "@/lib/crypto-wallet";

async function settle<T>(
  source: string,
  work: () => Promise<T>,
): Promise<{ value: T | null; error: string | null }> {
  try {
    return { value: await work(), error: null };
  } catch (err) {
    return {
      value: null,
      error: err instanceof Error ? err.message : `${source} failed`,
    };
  }
}

/**
 * One-shot crypto suite: wallet → address + risk + flow, or tx → deep dive.
 */
export async function runCryptoFullSuite(
  query: string,
): Promise<CryptoFullSuiteResult> {
  const trimmed = query.trim();
  const detected = detectCryptoInput(trimmed);

  if (detected.kind === "tx") {
    const tx = await settle("tx", () => runTxDeepDive(trimmed));

    if (!tx.value) {
      throw new Error(tx.error || "Transaction lookup failed");
    }

    return {
      kind: "crypto-full",
      query: trimmed,
      inputKind: "tx",
      chainLabel: detected.chainLabel,
      wallet: null,
      address: null,
      risk: null,
      flow: null,
      tx: tx.value,
      errors: [],
      disclaimer: CRYPTO_INTEL_DISCLAIMER,
      sources: tx.value.sources,
    };
  }

  if (!detectCryptoChain(trimmed)) {
    throw new Error(CRYPTO_WALLET_INVALID_MESSAGE);
  }

  const [wallet, address, risk, flow] = await Promise.all([
    settle("wallet", () => lookupCryptoWallet(trimmed)),
    settle("address", () => runAddressIntel(trimmed)),
    settle("risk", () => runRiskCheck(trimmed)),
    settle("flow", () => runFundFlow(trimmed)),
  ]);

  const errors: Array<{ source: string; message: string }> = [];

  if (wallet.error) errors.push({ source: "wallet", message: wallet.error });
  if (address.error) errors.push({ source: "address", message: address.error });
  if (risk.error) errors.push({ source: "risk", message: risk.error });
  if (flow.error) errors.push({ source: "flow", message: flow.error });

  if (!wallet.value && !address.value && !risk.value && !flow.value) {
    throw new Error(errors[0]?.message || "Crypto intel suite failed");
  }

  const sources = [
    ...new Set([
      ...(wallet.value ? ["wallet-live"] : []),
      ...(address.value?.sources ?? []),
      ...(risk.value?.sources ?? []),
      ...(flow.value?.sources ?? []),
    ]),
  ];

  return {
    kind: "crypto-full",
    query: trimmed,
    inputKind: "wallet",
    chainLabel: detected.chainLabel,
    wallet: wallet.value,
    address: address.value,
    risk: risk.value,
    flow: flow.value,
    tx: null,
    errors,
    disclaimer: CRYPTO_INTEL_DISCLAIMER,
    sources,
  };
}
