import {
  detectCryptoChain,
  type CryptoChain,
} from "@/lib/crypto-wallet";

export type CryptoInputKind = "wallet" | "tx" | "unknown";

export type CryptoInputDetection = {
  kind: CryptoInputKind;
  chain: CryptoChain | null;
  /** Human label for the detected chain, or null. */
  chainLabel: string | null;
  /** Suggested submodule tool id inside crypto-intel. */
  suggestedToolId: string;
};

const CHAIN_LABELS: Record<CryptoChain, string> = {
  bitcoin: "Bitcoin",
  ethereum: "Ethereum",
  litecoin: "Litecoin",
  solana: "Solana",
};

/** Ethereum tx hash: 0x + 64 hex (addresses are 0x + 40). */
function looksLikeEthTx(value: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(value);
}

/** Bitcoin / generic 64-hex txid (not a bech32/base58 wallet). */
function looksLikeBtcTxid(value: string): boolean {
  return /^[a-fA-F0-9]{64}$/.test(value);
}

/** Solana signatures are long base58 (typically 87–88). */
function looksLikeSolSignature(value: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{80,90}$/.test(value);
}

export function detectCryptoTxInput(query: string): boolean {
  const trimmed = query.trim();

  if (!trimmed || /\s/.test(trimmed)) return false;

  return (
    looksLikeEthTx(trimmed) ||
    looksLikeBtcTxid(trimmed) ||
    looksLikeSolSignature(trimmed)
  );
}

/**
 * Classify pasted crypto input as wallet vs transaction and suggest a tool.
 * Wallet detection reuses checksum-aware `detectCryptoChain`.
 */
export function detectCryptoInput(query: string): CryptoInputDetection {
  const trimmed = query.trim();

  if (!trimmed) {
    return {
      kind: "unknown",
      chain: null,
      chainLabel: null,
      suggestedToolId: "full",
    };
  }

  if (detectCryptoTxInput(trimmed)) {
    let chain: CryptoChain | null = null;

    if (looksLikeEthTx(trimmed)) chain = "ethereum";
    else if (looksLikeBtcTxid(trimmed)) chain = "bitcoin";
    else if (looksLikeSolSignature(trimmed)) chain = "solana";

    return {
      kind: "tx",
      chain,
      chainLabel: chain ? CHAIN_LABELS[chain] : null,
      suggestedToolId: "tx",
    };
  }

  const walletChain = detectCryptoChain(trimmed);

  if (walletChain) {
    return {
      kind: "wallet",
      chain: walletChain,
      chainLabel: CHAIN_LABELS[walletChain],
      suggestedToolId: "full",
    };
  }

  return {
    kind: "unknown",
    chain: null,
    chainLabel: null,
    suggestedToolId: "full",
  };
}

export function cryptoChainDisplayLabel(chain: CryptoChain | null): string | null {
  return chain ? CHAIN_LABELS[chain] : null;
}
