import { PUBLIC_AI_LABEL } from "@/lib/public-branding";
import type { AiIntelResult } from "@/lib/ai-intel";
import type { CryptoWalletResult } from "@/lib/crypto-wallet";

export type CryptoChatMessage = {
  id: string;
  role: "user" | "anya" | "system";
  text: string;
  meta?: string;
  tone?: "neutral" | "info" | "warn" | "success";
};

function chainLabel(chain: CryptoWalletResult["chain"]): string {
  if (chain === "bitcoin") return "Bitcoin";
  if (chain === "ethereum") return "Ethereum";
  return "Solana";
}

export function buildCryptoAiChatMessages(
  query: string,
  result: AiIntelResult,
): CryptoChatMessage[] {
  const wallet = result.raw?.wallet as CryptoWalletResult | undefined;
  const messages: CryptoChatMessage[] = [
    {
      id: "user-query",
      role: "user",
      text: `Analyse wallet ${query}`,
    },
    {
      id: "anya-start",
      role: "anya",
      text: "On it. Pulling live on-chain data and running a risk pass on this address…",
      meta: PUBLIC_AI_LABEL,
      tone: "info",
    },
  ];

  if (!wallet) {
    messages.push({
      id: "anya-error",
      role: "anya",
      text: result.aiBrief,
      meta: "analysis failed",
      tone: "warn",
    });
    return messages;
  }

  messages.push({
    id: "anya-chain",
    role: "anya",
    text: `Identified a ${chainLabel(wallet.chain)} address. Current balance is **${wallet.balance}**${wallet.balanceUsd ? ` (~${wallet.balanceUsd})` : ""}.`,
    meta: "chain resolved",
    tone: "success",
  });

  if (wallet.ensName) {
    messages.push({
      id: "anya-ens",
      role: "anya",
      text: `ENS resolves to **${wallet.ensName}** — useful for linking this wallet to public identity pivots.`,
      meta: "identity hint",
    });
  }

  if (wallet.isContract !== undefined) {
    messages.push({
      id: "anya-contract",
      role: "anya",
      text: wallet.isContract
        ? "This is a **smart contract** address, not a typical user wallet — expect automated flows and token routing."
        : "This is an **externally owned account** (standard user wallet).",
      meta: "wallet type",
    });
  }

  messages.push({
    id: "anya-activity",
    role: "anya",
    text: `Indexed **${wallet.txCount.toLocaleString()}** lifetime transaction${wallet.txCount === 1 ? "" : "s"} on-chain.`,
    meta: "activity scan",
  });

  if (Object.keys(wallet.stats).length > 0) {
    const statLines = Object.entries(wallet.stats)
      .slice(0, 4)
      .map(([key, value]) => `• ${key}: ${value}`)
      .join("\n");

    messages.push({
      id: "anya-stats",
      role: "anya",
      text: `Flow summary from the ledger:\n${statLines}`,
      meta: "on-chain stats",
    });
  }

  if (wallet.tokens.length > 0) {
    const top = wallet.tokens
      .slice(0, 5)
      .map((token) => `• **${token.symbol}** — ${token.balance}${token.balanceUsd ? ` (${token.balanceUsd})` : ""}`)
      .join("\n");

    messages.push({
      id: "anya-tokens",
      role: "anya",
      text: `Token scan found **${wallet.tokenCount ?? wallet.tokens.length}** holding(s). Top balances:\n${top}`,
      meta: "token pass",
    });
  }

  if (wallet.recentTransactions.length > 0) {
    const txLines = wallet.recentTransactions
      .slice(0, 3)
      .map((tx) => {
        const dir = tx.direction ? tx.direction.toUpperCase() : "TX";
        const amount = tx.amount ? ` ${tx.amount}` : "";
        const hash = tx.hash.length > 20 ? `${tx.hash.slice(0, 10)}…${tx.hash.slice(-8)}` : tx.hash;

        return `• ${dir}${amount} · \`${hash}\``;
      })
      .join("\n");

    messages.push({
      id: "anya-txs",
      role: "anya",
      text: `Recent movement on this wallet:\n${txLines}`,
      meta: "latest transactions",
    });
  }

  for (const signal of result.signals) {
    messages.push({
      id: `signal-${signal.title}`,
      role: "anya",
      text: `**${signal.title}** — ${signal.detail}`,
      meta: signal.level === "critical" ? "critical signal" : "risk signal",
      tone: signal.level === "info" ? "info" : "warn",
    });
  }

  if (result.insights && result.insights.length > 0) {
    messages.push({
      id: "anya-insights",
      role: "anya",
      text: result.insights.join(" "),
      meta: "ai readout",
    });
  }

  const breachHits = result.entities.find((e) => e.label.includes("Breach"));

  if (breachHits) {
    messages.push({
      id: "anya-breach",
      role: "anya",
      text: `Cross-checked breach indexes — **${breachHits.value}** correlated record(s) mention this address.`,
      meta: "breach correlation",
      tone: "warn",
    });
  }

  messages.push({
    id: "anya-verdict",
    role: "anya",
    text: `**Verdict:** ${result.riskLabel} exposure (**${result.riskScore}/100**). ${result.aiBrief}`,
    meta: `${result.elapsedMs}ms · ${result.confidence ?? 0}% confidence`,
    tone: result.riskScore >= 50 ? "warn" : "success",
  });

  if (result.recommendations.length > 0) {
    messages.push({
      id: "anya-recs",
      role: "anya",
      text: `Suggested next steps:\n${result.recommendations.map((rec) => `• ${rec}`).join("\n")}`,
      meta: "follow-up",
    });
  }

  return messages;
}
