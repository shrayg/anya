import {
  detectCryptoChain,
  lookupCryptoWallet,
  type CryptoChain,
} from "@/lib/crypto-wallet";
import {
  isMixerTagged,
  isSanctionTagged,
  lookupEntityLabel,
} from "@/lib/crypto-intel/labels";
import {
  CRYPTO_INTEL_DISCLAIMER,
  type CryptoAddressIntelResult,
  type CryptoIntelRiskLevel,
} from "@/lib/crypto-intel/types";

function explorerLinks(
  chain: CryptoChain,
  address: string,
): Array<{ name: string; url: string }> {
  const encoded = encodeURIComponent(address);

  if (chain === "ethereum") {
    return [
      { name: "Etherscan", url: `https://etherscan.io/address/${encoded}` },
      {
        name: "Blockscout",
        url: `https://eth.blockscout.com/address/${encoded}`,
      },
    ];
  }

  if (chain === "bitcoin") {
    return [
      {
        name: "Mempool.space",
        url: `https://mempool.space/address/${encoded}`,
      },
      {
        name: "Blockstream",
        url: `https://blockstream.info/address/${encoded}`,
      },
    ];
  }

  if (chain === "litecoin") {
    return [
      {
        name: "Litecoinspace",
        url: `https://litecoinspace.org/address/${encoded}`,
      },
    ];
  }

  return [
    { name: "Solscan", url: `https://solscan.io/account/${encoded}` },
    { name: "Solana Explorer", url: `https://explorer.solana.com/address/${encoded}` },
  ];
}

function scoreRisk(
  flags: string[],
  entityTags: string[],
): CryptoIntelRiskLevel {
  if (
    flags.some((f) => f.toLowerCase().includes("sanction")) ||
    entityTags.includes("ofac-sanctioned")
  ) {
    return "critical";
  }

  if (
    flags.some((f) => f.toLowerCase().includes("mixer")) ||
    entityTags.includes("mixer") ||
    entityTags.includes("high-risk")
  ) {
    return "high";
  }

  if (entityTags.includes("exchange") || entityTags.includes("cex")) {
    return "elevated";
  }

  if (flags.length > 0) return "elevated";

  return "low";
}

export async function runAddressIntel(
  query: string,
): Promise<CryptoAddressIntelResult> {
  const chain = detectCryptoChain(query);

  if (!chain) {
    throw new Error(
      "Enter a valid Bitcoin, Litecoin, Ethereum, or Solana address.",
    );
  }

  const wallet = await lookupCryptoWallet(query.trim());
  const entity = lookupEntityLabel(wallet.address);
  const riskFlags: string[] = [];

  if (isSanctionTagged(entity)) {
    riskFlags.push("Matched OFAC-style sanction tag in seed label list");
  }

  if (isMixerTagged(entity)) {
    riskFlags.push("Matched known mixer / tumbler seed label");
  }

  if (entity?.tags.includes("exchange") || entity?.tags.includes("cex")) {
    riskFlags.push(`Labeled exchange / CEX entity: ${entity.label}`);
  }

  if (wallet.isContract) {
    riskFlags.push("Address appears to be a smart contract");
  }

  const riskLevel = scoreRisk(riskFlags, entity?.tags ?? []);

  return {
    kind: "crypto-address",
    wallet,
    entity,
    riskFlags,
    riskLevel,
    explorers: explorerLinks(chain, wallet.address),
    disclaimer: CRYPTO_INTEL_DISCLAIMER,
    sources: ["On-chain explorers", "Static entity label seed"],
  };
}
