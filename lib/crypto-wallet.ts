export type CryptoChain = "bitcoin" | "ethereum" | "solana";

export type CryptoTransaction = {
  hash: string;
  timestamp?: string;
  direction?: "in" | "out" | "self";
  amount?: string;
  amountUsd?: string;
  from?: string;
  to?: string;
};

export type CryptoTokenBalance = {
  symbol: string;
  name?: string;
  balance: string;
  balanceUsd?: string;
  contractAddress?: string;
};

export type CryptoWalletResult = {
  chain: CryptoChain;
  address: string;
  balance: string;
  balanceNative: string;
  balanceUsd?: string;
  txCount: number;
  ensName?: string;
  exchangeRateUsd?: number;
  isContract?: boolean;
  tokenCount?: number;
  tokens: CryptoTokenBalance[];
  recentTransactions: CryptoTransaction[];
  stats: Record<string, string>;
};

const SOLANA_ADDRESS_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function detectCryptoChain(query: string): CryptoChain | null {
  const trimmed = query.trim();

  if (/^0x[a-fA-F0-9]{40}$/.test(trimmed)) return "ethereum";
  if (/^(1|3|bc1)[a-zA-HJ-NP-Z0-9]{25,62}$/.test(trimmed)) return "bitcoin";
  if (SOLANA_ADDRESS_RE.test(trimmed)) return "solana";

  return null;
}

function satsToBtc(sats: number): string {
  return (sats / 100_000_000).toLocaleString(undefined, {
    maximumFractionDigits: 8,
  });
}

function weiToEth(wei: string): number {
  return Number(wei) / 1e18;
}

function lamportsToSol(lamports: number): string {
  return (lamports / 1_000_000_000).toLocaleString(undefined, {
    maximumFractionDigits: 9,
  });
}

function formatUsd(value: number): string {
  return value.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function formatTimestamp(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleString();
}

function shortenHash(hash: string): string {
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
}

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

type MempoolAddress = {
  chain_stats?: {
    tx_count?: number;
    funded_txo_sum?: number;
    spent_txo_sum?: number;
    funded_txo_count?: number;
    spent_txo_count?: number;
  };
  mempool_stats?: {
    tx_count?: number;
    funded_txo_sum?: number;
  };
};

type MempoolTx = {
  txid: string;
  status?: { confirmed?: boolean; block_time?: number };
  fee?: number;
  vout?: Array<{ value: number; scriptpubkey_address?: string }>;
  vin?: Array<{ prevout?: { scriptpubkey_address?: string; value?: number } }>;
};

function parseBitcoinTransactions(
  address: string,
  txs: MempoolTx[],
): CryptoTransaction[] {
  return txs.slice(0, 8).map((tx) => {
    const receivedSats = (tx.vout ?? [])
      .filter((output) => output.scriptpubkey_address === address)
      .reduce((sum, output) => sum + (output.value ?? 0), 0);

    const sentSats = (tx.vin ?? [])
      .filter((input) => input.prevout?.scriptpubkey_address === address)
      .reduce((sum, input) => sum + (input.prevout?.value ?? 0), 0);

    let direction: CryptoTransaction["direction"] = "self";
    let amountSats = 0;

    if (receivedSats > sentSats) {
      direction = "in";
      amountSats = receivedSats - sentSats;
    } else if (sentSats > receivedSats) {
      direction = "out";
      amountSats = sentSats - receivedSats;
    }

    return {
      hash: tx.txid,
      timestamp: tx.status?.block_time
        ? formatTimestamp(tx.status.block_time)
        : undefined,
      direction,
      amount: `${satsToBtc(amountSats)} BTC`,
      from: direction === "in" ? "External" : shortenHash(address),
      to: direction === "out" ? "External" : shortenHash(address),
    };
  });
}

export async function lookupBitcoinWallet(
  address: string,
): Promise<CryptoWalletResult> {
  const [addressData, txData] = await Promise.all([
    fetchJson<MempoolAddress>(`https://mempool.space/api/address/${encodeURIComponent(address)}`),
    fetchJson<MempoolTx[]>(`https://mempool.space/api/address/${encodeURIComponent(address)}/txs`),
  ]);

  let stats = addressData?.chain_stats;

  if (!stats) {
    const fallback = await fetchJson<MempoolAddress>(
      `https://blockstream.info/api/address/${encodeURIComponent(address)}`,
    );
    stats = fallback?.chain_stats;
  }

  if (!stats) {
    throw new Error("Bitcoin wallet lookup failed");
  }

  const balanceSats = Math.max(
    0,
    (stats.funded_txo_sum ?? 0) - (stats.spent_txo_sum ?? 0),
  );
  const mempoolPending = addressData?.mempool_stats?.tx_count ?? 0;

  return {
    chain: "bitcoin",
    address,
    balance: `${satsToBtc(balanceSats)} BTC`,
    balanceNative: satsToBtc(balanceSats),
    txCount: stats.tx_count ?? 0,
    tokens: [],
    recentTransactions: parseBitcoinTransactions(address, txData ?? []),
    stats: {
      "Total received": `${satsToBtc(stats.funded_txo_sum ?? 0)} BTC`,
      "Total sent": `${satsToBtc(stats.spent_txo_sum ?? 0)} BTC`,
      "Funded outputs": String(stats.funded_txo_count ?? 0),
      "Spent outputs": String(stats.spent_txo_count ?? 0),
      "Pending mempool txs": String(mempoolPending),
    },
  };
}

type BlockscoutAddress = {
  coin_balance?: string;
  ens_domain_name?: string | null;
  exchange_rate?: string | number | null;
  is_contract?: boolean;
  has_tokens?: boolean;
  has_token_transfers?: boolean;
};

type BlockscoutTokenItem = {
  value?: string;
  token?: {
    symbol?: string;
    name?: string;
    decimals?: string;
    exchange_rate?: string | number | null;
    address_hash?: string;
  };
};

type EthplorerAddressInfo = {
  ETH?: {
    balance?: number;
    rawBalance?: string;
    price?: { rate?: number };
  };
  tokens?: Array<{
    tokenInfo?: {
      symbol?: string;
      name?: string;
      address?: string;
      decimals?: string;
      price?: { rate?: number };
    };
    balance?: number;
    rawBalance?: string;
  }>;
};

type EthplorerTx = {
  hash?: string;
  timestamp?: number;
  from?: string;
  to?: string;
  value?: number;
  usdPrice?: number;
  rawValue?: string;
};

function parseBlockscoutTokens(items: BlockscoutTokenItem[]): CryptoTokenBalance[] {
  return items.slice(0, 10).map((item) => {
    const decimals = Number(item.token?.decimals ?? 18);
    const raw = Number(item.value ?? 0) / 10 ** decimals;
    const rate = item.token?.exchange_rate ? Number(item.token.exchange_rate) : undefined;

    return {
      symbol: item.token?.symbol ?? "TOKEN",
      name: item.token?.name,
      balance: raw.toLocaleString(undefined, { maximumFractionDigits: 6 }),
      balanceUsd: rate ? formatUsd(raw * rate) : undefined,
      contractAddress: item.token?.address_hash,
    };
  });
}

function parseEthplorerTokens(tokens: EthplorerAddressInfo["tokens"]): CryptoTokenBalance[] {
  return (tokens ?? []).slice(0, 10).map((item) => {
    const rate = item.tokenInfo?.price?.rate;
    const balance = item.balance ?? 0;

    return {
      symbol: item.tokenInfo?.symbol ?? "TOKEN",
      name: item.tokenInfo?.name,
      balance: balance.toLocaleString(undefined, { maximumFractionDigits: 6 }),
      balanceUsd: rate ? formatUsd(balance * rate) : undefined,
      contractAddress: item.tokenInfo?.address,
    };
  });
}

export async function lookupEthereumWallet(
  address: string,
): Promise<CryptoWalletResult> {
  const normalized = address.toLowerCase();

  const [blockscoutAddress, blockscoutTokens, blockscoutTxs, ethplorerInfo, ethplorerTxs] =
    await Promise.all([
      fetchJson<BlockscoutAddress>(
        `https://eth.blockscout.com/api/v2/addresses/${encodeURIComponent(address)}`,
      ),
      fetchJson<{ items?: BlockscoutTokenItem[] }>(
        `https://eth.blockscout.com/api/v2/addresses/${encodeURIComponent(address)}/tokens?type=ERC-20`,
      ),
      fetchJson<{ items?: unknown[]; next_page_params?: unknown }>(
        `https://eth.blockscout.com/api/v2/addresses/${encodeURIComponent(address)}/transactions`,
      ),
      fetchJson<EthplorerAddressInfo>(
        `https://api.ethplorer.io/getAddressInfo/${encodeURIComponent(address)}?apiKey=freekey`,
      ),
      fetchJson<EthplorerTx[]>(
        `https://api.ethplorer.io/getAddressTransactions/${encodeURIComponent(address)}?apiKey=freekey&limit=8`,
      ),
    ]);

  const wei =
    blockscoutAddress?.coin_balance ??
    ethplorerInfo?.ETH?.rawBalance ??
    "0";
  const eth = weiToEth(wei);
  const rate =
    Number(blockscoutAddress?.exchange_rate ?? ethplorerInfo?.ETH?.price?.rate ?? 0) ||
    undefined;
  const usd = rate ? eth * rate : undefined;

  const blockscoutTokenList = parseBlockscoutTokens(blockscoutTokens?.items ?? []);
  const ethplorerTokenList = parseEthplorerTokens(ethplorerInfo?.tokens);
  const tokens = blockscoutTokenList.length > 0 ? blockscoutTokenList : ethplorerTokenList;

  const recentTransactions = (ethplorerTxs ?? []).map((tx) => ({
    hash: tx.hash ?? "",
    timestamp: tx.timestamp ? formatTimestamp(tx.timestamp) : undefined,
    direction:
      tx.to?.toLowerCase() === normalized
        ? ("in" as const)
        : tx.from?.toLowerCase() === normalized
          ? ("out" as const)
          : undefined,
    amount: tx.value !== undefined ? `${tx.value} ETH` : undefined,
    amountUsd:
      tx.usdPrice && tx.value !== undefined
        ? formatUsd(tx.value * tx.usdPrice)
        : undefined,
    from: tx.from ? shortenHash(tx.from) : undefined,
    to: tx.to ? shortenHash(tx.to) : undefined,
  }));

  if (!blockscoutAddress && !ethplorerInfo) {
    throw new Error("Ethereum wallet lookup failed");
  }

  return {
    chain: "ethereum",
    address,
    balance: `${eth.toLocaleString(undefined, { maximumFractionDigits: 6 })} ETH`,
    balanceNative: eth.toLocaleString(undefined, { maximumFractionDigits: 6 }),
    balanceUsd: usd ? formatUsd(usd) : undefined,
    txCount: blockscoutTxs?.next_page_params
      ? 50
      : (blockscoutTxs?.items?.length ?? recentTransactions.length),
    ensName: blockscoutAddress?.ens_domain_name || undefined,
    exchangeRateUsd: rate,
    isContract: blockscoutAddress?.is_contract,
    tokenCount: ethplorerInfo?.tokens?.length ?? tokens.length,
    tokens,
    recentTransactions,
    stats: {
      "ERC-20 tokens": String(ethplorerInfo?.tokens?.length ?? tokens.length),
      "Transaction history": blockscoutTxs?.next_page_params
        ? "50+ indexed transactions"
        : `${blockscoutTxs?.items?.length ?? recentTransactions.length} indexed transactions`,
      "Has token transfers": blockscoutAddress?.has_token_transfers ? "Yes" : "No",
      "Contract wallet": blockscoutAddress?.is_contract ? "Yes" : "No",
    },
  };
}

async function solanaRpc<T>(method: string, params: unknown[]): Promise<T | null> {
  const data = await fetchJson<{ result?: T }>("https://api.mainnet-beta.solana.com", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params,
    }),
  });

  return data?.result ?? null;
}

type SolanaSignature = {
  signature: string;
  blockTime?: number;
  err?: unknown;
  confirmationStatus?: string;
};

export async function lookupSolanaWallet(
  address: string,
): Promise<CryptoWalletResult> {
  const [balanceResult, signatures] = await Promise.all([
    solanaRpc<{ value: number }>("getBalance", [address]),
    solanaRpc<SolanaSignature[]>("getSignaturesForAddress", [address, { limit: 8 }]),
  ]);

  if (balanceResult === null && signatures === null) {
    throw new Error("Solana wallet lookup failed");
  }

  const lamports = balanceResult?.value ?? 0;

  return {
    chain: "solana",
    address,
    balance: `${lamportsToSol(lamports)} SOL`,
    balanceNative: lamportsToSol(lamports),
    txCount: signatures?.length ?? 0,
    tokens: [],
    recentTransactions: (signatures ?? []).map((entry) => ({
      hash: entry.signature,
      timestamp: entry.blockTime ? formatTimestamp(entry.blockTime) : undefined,
      direction: entry.err ? undefined : "self",
      amount: entry.confirmationStatus,
    })),
    stats: {
      Lamports: String(lamports),
      "Recent signatures": String(signatures?.length ?? 0),
    },
  };
}

export async function lookupCryptoWallet(query: string): Promise<CryptoWalletResult> {
  const chain = detectCryptoChain(query);
  const address = query.trim();

  if (!chain) {
    throw new Error(
      "Enter a valid Bitcoin (1/3/bc1), Ethereum (0x), or Solana wallet address.",
    );
  }

  if (chain === "bitcoin") return lookupBitcoinWallet(address);
  if (chain === "ethereum") return lookupEthereumWallet(address);

  return lookupSolanaWallet(address);
}
