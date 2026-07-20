import {
  detectCryptoChain,
  type CryptoChain,
} from "@/lib/crypto-wallet";
import { lookupEntityLabel } from "@/lib/crypto-intel/labels";
import {
  CRYPTO_INTEL_DISCLAIMER,
  type CryptoTxDeepDiveResult,
  type CryptoTxParty,
} from "@/lib/crypto-intel/types";

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

function party(address?: string | null): CryptoTxParty | undefined {
  if (!address) return undefined;
  const entity = lookupEntityLabel(address);

  return {
    address,
    label: entity?.label ?? null,
    tags: entity?.tags,
  };
}

function detectTxChain(hash: string): CryptoChain | "unknown" {
  const trimmed = hash.trim();

  if (/^0x[a-fA-F0-9]{64}$/.test(trimmed)) return "ethereum";
  if (/^[a-fA-F0-9]{64}$/.test(trimmed)) return "bitcoin";
  // Solana signatures are base58, typically 87-88 chars
  if (/^[1-9A-HJ-NP-Za-km-z]{80,90}$/.test(trimmed)) return "solana";

  return "unknown";
}

function explorerForTx(
  chain: CryptoChain | "unknown",
  hash: string,
): Array<{ name: string; url: string }> {
  const encoded = encodeURIComponent(hash);

  if (chain === "ethereum") {
    return [
      { name: "Etherscan", url: `https://etherscan.io/tx/${encoded}` },
      { name: "Blockscout", url: `https://eth.blockscout.com/tx/${encoded}` },
    ];
  }

  if (chain === "bitcoin") {
    return [
      { name: "Mempool.space", url: `https://mempool.space/tx/${encoded}` },
      { name: "Blockstream", url: `https://blockstream.info/tx/${encoded}` },
    ];
  }

  if (chain === "solana") {
    return [
      { name: "Solscan", url: `https://solscan.io/tx/${encoded}` },
      {
        name: "Solana Explorer",
        url: `https://explorer.solana.com/tx/${encoded}`,
      },
    ];
  }

  return [];
}

type BlockscoutTx = {
  hash?: string;
  status?: string;
  result?: string;
  timestamp?: string;
  block_number?: number;
  fee?: { type?: string; value?: string };
  value?: string;
  method?: string;
  from?: { hash?: string };
  to?: { hash?: string };
  gas_used?: string;
};

type MempoolTx = {
  txid?: string;
  fee?: number;
  status?: { confirmed?: boolean; block_height?: number; block_time?: number };
  vin?: Array<{ prevout?: { scriptpubkey_address?: string; value?: number } }>;
  vout?: Array<{ scriptpubkey_address?: string; value?: number }>;
};

const SOLANA_RPC_URLS = [
  "https://api.mainnet-beta.solana.com",
  "https://solana.publicnode.com",
];

async function lookupEthTx(hash: string): Promise<CryptoTxDeepDiveResult> {
  const data = await fetchJson<BlockscoutTx>(
    `https://eth.blockscout.com/api/v2/transactions/${encodeURIComponent(hash)}`,
  );

  if (!data?.hash) {
    throw new Error(
      "Ethereum transaction not found (explorer unavailable or invalid hash).",
    );
  }

  const valueEth = data.value ? Number(data.value) / 1e18 : undefined;
  const feeEth = data.fee?.value ? Number(data.fee.value) / 1e18 : undefined;
  const fromAddr = data.from?.hash;
  const toAddr = data.to?.hash;
  const from = party(fromAddr);
  const to = party(toAddr);

  const summaryParts = [
    data.status === "ok" || data.result === "success"
      ? "Confirmed"
      : data.status || data.result || "Unknown status",
    valueEth !== undefined
      ? `${valueEth.toLocaleString(undefined, { maximumFractionDigits: 6 })} ETH transferred`
      : null,
    data.method ? `method ${data.method}` : null,
    from?.label ? `from ${from.label}` : null,
    to?.label ? `to ${to.label}` : null,
  ].filter(Boolean);

  return {
    kind: "crypto-tx",
    chain: "ethereum",
    hash: data.hash,
    status: data.result ?? data.status,
    timestamp: data.timestamp
      ? new Date(data.timestamp).toLocaleString()
      : undefined,
    blockNumber:
      data.block_number !== undefined ? String(data.block_number) : undefined,
    fee:
      feeEth !== undefined
        ? `${feeEth.toLocaleString(undefined, { maximumFractionDigits: 8 })} ETH`
        : undefined,
    value:
      valueEth !== undefined
        ? `${valueEth.toLocaleString(undefined, { maximumFractionDigits: 6 })} ETH`
        : undefined,
    method: data.method,
    from,
    to,
    summary: summaryParts.join(" · "),
    stats: {
      Gas: data.gas_used ?? "—",
      Method: data.method ?? "transfer / unknown",
    },
    explorers: explorerForTx("ethereum", data.hash),
    disclaimer: CRYPTO_INTEL_DISCLAIMER,
    sources: ["eth.blockscout.com"],
  };
}

async function lookupBtcTx(hash: string): Promise<CryptoTxDeepDiveResult> {
  let data = await fetchJson<MempoolTx>(
    `https://mempool.space/api/tx/${encodeURIComponent(hash)}`,
  );

  if (!data?.txid) {
    data = await fetchJson<MempoolTx>(
      `https://blockstream.info/api/tx/${encodeURIComponent(hash)}`,
    );
  }

  if (!data?.txid) {
    throw new Error(
      "Bitcoin transaction not found (explorer unavailable or invalid txid).",
    );
  }

  const totalOut =
    (data.vout ?? []).reduce((sum, o) => sum + (o.value ?? 0), 0) / 1e8;
  const inputs = (data.vin ?? [])
    .map((v) => v.prevout?.scriptpubkey_address)
    .filter(Boolean) as string[];
  const outputs = (data.vout ?? [])
    .map((v) => v.scriptpubkey_address)
    .filter(Boolean) as string[];

  const fromAddr = inputs[0];
  const toAddr = outputs[0];
  const from = party(fromAddr);
  const to = party(toAddr);

  return {
    kind: "crypto-tx",
    chain: "bitcoin",
    hash: data.txid,
    status: data.status?.confirmed ? "confirmed" : "unconfirmed",
    timestamp: data.status?.block_time
      ? new Date(data.status.block_time * 1000).toLocaleString()
      : undefined,
    blockNumber:
      data.status?.block_height !== undefined
        ? String(data.status.block_height)
        : undefined,
    fee:
      data.fee !== undefined
        ? `${(data.fee / 1e8).toLocaleString(undefined, { maximumFractionDigits: 8 })} BTC`
        : undefined,
    value: `${totalOut.toLocaleString(undefined, { maximumFractionDigits: 8 })} BTC`,
    from,
    to,
    summary: [
      data.status?.confirmed ? "Confirmed" : "Unconfirmed",
      `${totalOut.toLocaleString(undefined, { maximumFractionDigits: 8 })} BTC output total`,
      `${inputs.length} inputs → ${outputs.length} outputs`,
    ].join(" · "),
    stats: {
      Inputs: String(inputs.length),
      Outputs: String(outputs.length),
    },
    explorers: explorerForTx("bitcoin", data.txid),
    disclaimer: CRYPTO_INTEL_DISCLAIMER,
    sources: ["mempool.space", "blockstream.info"],
  };
}

type SolanaTxResult = {
  blockTime?: number | null;
  meta?: { fee?: number; err?: unknown };
  slot?: number;
  transaction?: {
    message?: {
      accountKeys?: Array<string | { pubkey?: string }>;
    };
  };
};

async function lookupSolTx(hash: string): Promise<CryptoTxDeepDiveResult> {
  let result: SolanaTxResult | null = null;

  for (const rpcUrl of SOLANA_RPC_URLS) {
    const payload = await fetchJson<{
      result?: SolanaTxResult | null;
      error?: { message?: string };
    }>(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTransaction",
        params: [hash, { encoding: "json", maxSupportedTransactionVersion: 0 }],
      }),
    });

    if (payload?.result) {
      result = payload.result;
      break;
    }
  }

  if (!result) {
    throw new Error(
      "Solana transaction not found (RPC unavailable or invalid signature).",
    );
  }

  const keys = (result.transaction?.message?.accountKeys ?? []).map(
    (k: string | { pubkey?: string }) =>
      typeof k === "string" ? k : (k.pubkey ?? ""),
  );
  const fromAddr = keys[0];
  const toAddr = keys[1];
  const feeSol =
    result.meta?.fee !== undefined ? result.meta.fee / 1e9 : undefined;

  return {
    kind: "crypto-tx",
    chain: "solana",
    hash,
    status: result.meta?.err ? "failed" : "success",
    timestamp: result.blockTime
      ? new Date(result.blockTime * 1000).toLocaleString()
      : undefined,
    blockNumber: result.slot !== undefined ? String(result.slot) : undefined,
    fee:
      feeSol !== undefined
        ? `${feeSol.toLocaleString(undefined, { maximumFractionDigits: 9 })} SOL`
        : undefined,
    from: party(fromAddr),
    to: party(toAddr),
    summary: [
      result.meta?.err ? "Failed" : "Success",
      `${keys.length} accounts involved`,
    ].join(" · "),
    stats: {
      Accounts: String(keys.length),
      Slot: result.slot !== undefined ? String(result.slot) : "—",
    },
    explorers: explorerForTx("solana", hash),
    disclaimer: CRYPTO_INTEL_DISCLAIMER,
    sources: ["Solana public RPC"],
  };
}

export async function runTxDeepDive(
  query: string,
): Promise<CryptoTxDeepDiveResult> {
  const trimmed = query.trim();

  if (!trimmed) {
    throw new Error("Paste a transaction hash / txid / Solana signature.");
  }

  // Prefer explicit tx-hash detection over address detection.
  const chain = detectTxChain(trimmed);

  if (chain === "ethereum") return lookupEthTx(trimmed);
  if (chain === "bitcoin") {
    // Could also be a 64-hex Solana... unlikely; BTC first for hex.
    try {
      return await lookupBtcTx(trimmed);
    } catch (btcErr) {
      // Fall through if someone pasted ETH without 0x (rare)
      if (/^[a-fA-F0-9]{64}$/.test(trimmed)) {
        try {
          return await lookupEthTx(`0x${trimmed}`);
        } catch {
          throw btcErr;
        }
      }
      throw btcErr;
    }
  }
  if (chain === "solana") return lookupSolTx(trimmed);

  // Address pasted by mistake?
  if (detectCryptoChain(trimmed)) {
    throw new Error(
      "That looks like a wallet address — use Address Intel instead, or paste a tx hash.",
    );
  }

  throw new Error(
    "Unrecognized hash. Expected Ethereum 0x…64, Bitcoin 64-hex txid, or Solana signature.",
  );
}
