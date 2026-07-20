import {
  detectCryptoChain,
  type CryptoChain,
} from "@/lib/crypto-wallet";
import { lookupEntityLabel } from "@/lib/crypto-intel/labels";
import {
  CRYPTO_INTEL_DISCLAIMER,
  type CryptoFundFlowResult,
  type FundFlowHop,
} from "@/lib/crypto-intel/types";

const MAX_HOPS = 8;

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, {
      cache: "no-store",
      ...init,
      headers: {
        Accept: "application/json",
        ...(init?.headers ?? {}),
      },
    });

    if (!res.ok) return null;

    return (await res.json()) as T;
  } catch {
    return null;
  }
}

type EthplorerTx = {
  hash?: string;
  timestamp?: number;
  from?: string;
  to?: string;
  value?: number;
};

type MempoolTx = {
  txid: string;
  status?: { block_time?: number };
  vout?: Array<{ value: number; scriptpubkey_address?: string }>;
  vin?: Array<{ prevout?: { scriptpubkey_address?: string; value?: number } }>;
};

type SolanaSig = {
  signature?: string;
  blockTime?: number | null;
  err?: unknown;
};

const SOLANA_RPC_URLS = [
  "https://api.mainnet-beta.solana.com",
  "https://solana.publicnode.com",
];

async function ethHops(address: string): Promise<FundFlowHop[]> {
  const txs = await fetchJson<EthplorerTx[]>(
    `https://api.ethplorer.io/getAddressTransactions/${encodeURIComponent(address)}?apiKey=freekey&limit=${MAX_HOPS}`,
  );

  const normalized = address.toLowerCase();

  return (txs ?? []).slice(0, MAX_HOPS).map((tx, index) => {
    const from = tx.from ?? "unknown";
    const to = tx.to ?? "unknown";
    const direction: FundFlowHop["direction"] =
      to.toLowerCase() === normalized
        ? "in"
        : from.toLowerCase() === normalized
          ? "out"
          : "self";

    return {
      hop: index + 1,
      from,
      to,
      fromLabel: lookupEntityLabel(from)?.label ?? null,
      toLabel: lookupEntityLabel(to)?.label ?? null,
      txHash: tx.hash,
      amount: tx.value !== undefined ? `${tx.value} ETH` : undefined,
      timestamp: tx.timestamp
        ? new Date(tx.timestamp * 1000).toLocaleString()
        : undefined,
      direction,
    };
  });
}

async function btcHops(address: string): Promise<FundFlowHop[]> {
  let txs = await fetchJson<MempoolTx[]>(
    `https://mempool.space/api/address/${encodeURIComponent(address)}/txs`,
  );

  if (!txs) {
    txs = await fetchJson<MempoolTx[]>(
      `https://blockstream.info/api/address/${encodeURIComponent(address)}/txs`,
    );
  }

  return (txs ?? []).slice(0, MAX_HOPS).map((tx, index) => {
    const received = (tx.vout ?? []).filter(
      (o) => o.scriptpubkey_address === address,
    );
    const sent = (tx.vin ?? []).filter(
      (i) => i.prevout?.scriptpubkey_address === address,
    );
    const receivedSats = received.reduce((s, o) => s + (o.value ?? 0), 0);
    const sentSats = sent.reduce((s, i) => s + (i.prevout?.value ?? 0), 0);

    let direction: FundFlowHop["direction"] = "self";
    let from = address;
    let to = address;
    let amountSats = 0;

    if (receivedSats > sentSats) {
      direction = "in";
      amountSats = receivedSats - sentSats;
      from =
        (tx.vin ?? []).find(
          (i) => i.prevout?.scriptpubkey_address !== address,
        )?.prevout?.scriptpubkey_address ?? "external";
      to = address;
    } else if (sentSats > receivedSats) {
      direction = "out";
      amountSats = sentSats - receivedSats;
      from = address;
      to =
        (tx.vout ?? []).find((o) => o.scriptpubkey_address !== address)
          ?.scriptpubkey_address ?? "external";
    }

    return {
      hop: index + 1,
      from,
      to,
      fromLabel: lookupEntityLabel(from)?.label ?? null,
      toLabel: lookupEntityLabel(to)?.label ?? null,
      txHash: tx.txid,
      amount: `${(amountSats / 1e8).toLocaleString(undefined, { maximumFractionDigits: 8 })} BTC`,
      timestamp: tx.status?.block_time
        ? new Date(tx.status.block_time * 1000).toLocaleString()
        : undefined,
      direction,
    };
  });
}

async function solHops(address: string): Promise<FundFlowHop[]> {
  for (const rpcUrl of SOLANA_RPC_URLS) {
    const payload = await fetchJson<{
      result?: SolanaSig[];
    }>(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getSignaturesForAddress",
        params: [address, { limit: MAX_HOPS }],
      }),
    });

    if (!payload?.result) continue;

    return payload.result.slice(0, MAX_HOPS).map((sig, index) => ({
      hop: index + 1,
      from: address,
      to: "see tx",
      fromLabel: lookupEntityLabel(address)?.label ?? null,
      toLabel: null,
      txHash: sig.signature,
      timestamp: sig.blockTime
        ? new Date(sig.blockTime * 1000).toLocaleString()
        : undefined,
      direction: "self" as const,
    }));
  }

  return [];
}

/**
 * Basic 1-hop fund flow from recent transactions on the root address.
 * Intentionally limited — not a full chain-analytics tracer.
 */
export async function runFundFlow(
  query: string,
): Promise<CryptoFundFlowResult> {
  const trimmed = query.trim();
  const chain = detectCryptoChain(trimmed) as CryptoChain | null;

  if (!chain) {
    throw new Error(
      "Enter a valid Bitcoin, Litecoin, Ethereum, or Solana address for fund-flow hops.",
    );
  }

  let hops: FundFlowHop[] = [];

  if (chain === "ethereum") hops = await ethHops(trimmed);
  else if (chain === "bitcoin" || chain === "litecoin") {
    if (chain === "litecoin") {
      const txs = await fetchJson<MempoolTx[]>(
        `https://litecoinspace.org/api/address/${encodeURIComponent(trimmed)}/txs`,
      );

      hops = (txs ?? []).slice(0, MAX_HOPS).map((tx, index) => {
        const out = (tx.vout ?? []).find(
          (o) => o.scriptpubkey_address !== trimmed,
        );
        const inn = (tx.vin ?? []).find(
          (i) => i.prevout?.scriptpubkey_address !== trimmed,
        );
        const received = (tx.vout ?? [])
          .filter((o) => o.scriptpubkey_address === trimmed)
          .reduce((s, o) => s + (o.value ?? 0), 0);
        const sent = (tx.vin ?? [])
          .filter((i) => i.prevout?.scriptpubkey_address === trimmed)
          .reduce((s, i) => s + (i.prevout?.value ?? 0), 0);
        const direction: FundFlowHop["direction"] =
          received > sent ? "in" : sent > received ? "out" : "self";
        const from =
          direction === "in"
            ? (inn?.prevout?.scriptpubkey_address ?? "external")
            : trimmed;
        const to =
          direction === "out"
            ? (out?.scriptpubkey_address ?? "external")
            : trimmed;

        return {
          hop: index + 1,
          from,
          to,
          fromLabel: lookupEntityLabel(from)?.label ?? null,
          toLabel: lookupEntityLabel(to)?.label ?? null,
          txHash: tx.txid,
          amount: `${(Math.abs(received - sent) / 1e8).toLocaleString(undefined, { maximumFractionDigits: 8 })} LTC`,
          timestamp: tx.status?.block_time
            ? new Date(tx.status.block_time * 1000).toLocaleString()
            : undefined,
          direction,
        };
      });
    } else {
      hops = await btcHops(trimmed);
    }
  } else if (chain === "solana") {
    hops = await solHops(trimmed);
  }

  if (hops.length === 0) {
    throw new Error(
      "No recent transactions available for fund-flow hops (explorer soft-fail or empty history).",
    );
  }

  const counterpartyMap = new Map<
    string,
    {
      address: string;
      label?: string | null;
      tags?: string[];
      direction: "in" | "out" | "both";
      txCount: number;
    }
  >();

  for (const hop of hops) {
    const cp =
      hop.direction === "in"
        ? hop.from
        : hop.direction === "out"
          ? hop.to
          : null;

    if (!cp || cp === "external" || cp === "see tx" || cp === "unknown") {
      continue;
    }

    if (cp.toLowerCase() === trimmed.toLowerCase()) continue;

    const key = cp.toLowerCase();
    const entity = lookupEntityLabel(cp);
    const existing = counterpartyMap.get(key);
    const dir = hop.direction === "self" ? "both" : (hop.direction ?? "both");

    if (!existing) {
      counterpartyMap.set(key, {
        address: cp,
        label: entity?.label ?? null,
        tags: entity?.tags,
        direction: dir,
        txCount: 1,
      });
    } else {
      existing.txCount += 1;
      if (
        (existing.direction === "in" && dir === "out") ||
        (existing.direction === "out" && dir === "in")
      ) {
        existing.direction = "both";
      }
    }
  }

  return {
    kind: "crypto-flow",
    rootAddress: trimmed,
    chain,
    hops,
    counterparties: [...counterpartyMap.values()].sort(
      (a, b) => b.txCount - a.txCount,
    ),
    disclaimer: CRYPTO_INTEL_DISCLAIMER,
    sources: [
      chain === "ethereum"
        ? "Ethplorer"
        : chain === "solana"
          ? "Solana public RPC"
          : "Mempool / explorer APIs",
      "Static entity label seed",
    ],
  };
}
