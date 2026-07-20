import { createHash } from "crypto";

export type CryptoChain = "bitcoin" | "ethereum" | "solana" | "litecoin";

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

export const CRYPTO_WALLET_INPUT_HINT =
  "Bitcoin (1/3/bc1), Litecoin (L/M/ltc1), Ethereum (0x…), or Solana address";

export const CRYPTO_WALLET_INVALID_MESSAGE =
  "Enter a valid Bitcoin (1/3/bc1), Litecoin (L/M/ltc1), Ethereum (0x), or Solana wallet address — not free text, emails, or arbitrary strings.";

const BASE58_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

const BECH32_CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";

/** Litecoin mainnet P2PKH (0x30 → L…) and P2SH (0x32 → M…). */
const LTC_VERSION_P2PKH = 0x30;
const LTC_VERSION_P2SH = 0x32;

const SOLANA_RPC_URLS = [
  "https://api.mainnet-beta.solana.com",
  "https://solana.publicnode.com",
  "https://solana-rpc.publicnode.com",
];

function decodeBase58(value: string): Uint8Array | null {
  if (!value) return null;

  const bytes: number[] = [];

  for (const char of value) {
    const digit = BASE58_ALPHABET.indexOf(char);

    if (digit < 0) return null;

    let carry = digit;

    for (let i = 0; i < bytes.length; i += 1) {
      carry += bytes[i]! * 58;
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }

    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }

  let leadingZeros = 0;

  for (const char of value) {
    if (char !== "1") break;
    leadingZeros += 1;
  }

  const decoded = new Uint8Array(leadingZeros + bytes.length);

  for (let i = 0; i < bytes.length; i += 1) {
    decoded[decoded.length - 1 - i] = bytes[i]!;
  }

  return decoded;
}

function isValidBase58Check(
  address: string,
  allowedVersions?: readonly number[],
): boolean {
  const decoded = decodeBase58(address);

  if (!decoded || decoded.length !== 25) return false;

  if (allowedVersions && !allowedVersions.includes(decoded[0]!)) return false;

  const payload = decoded.subarray(0, 21);
  const checksum = decoded.subarray(21);
  const first = createHash("sha256").update(payload).digest();
  const hash = createHash("sha256").update(new Uint8Array(first)).digest();

  return (
    checksum[0] === hash[0] &&
    checksum[1] === hash[1] &&
    checksum[2] === hash[2] &&
    checksum[3] === hash[3]
  );
}

function isValidBech32Address(address: string, hrp: string): boolean {
  const lower = address.toLowerCase();
  const prefix = `${hrp}1`;

  if (!lower.startsWith(prefix)) return false;
  if (address.length < hrp.length + 1 + 11 || address.length > 90) return false;
  if (!new RegExp(`^${hrp}1[a-z0-9]+$`, "i").test(address)) return false;
  const body = lower.slice(prefix.length);

  return (
    body.length >= 11 && [...body].every((c) => BECH32_CHARSET.includes(c))
  );
}

function isValidEthereumAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

function isValidBitcoinAddress(address: string): boolean {
  if (address.toLowerCase().startsWith("bc1")) {
    return isValidBech32Address(address, "bc");
  }

  // Legacy P2PKH (1…) / P2SH (3…) — Base58Check payload is 25 bytes.
  if (!/^[13][a-km-zA-HJ-NP-Z1-9]{25,33}$/.test(address)) return false;
  const decoded = decodeBase58(address);

  return decoded !== null && decoded.length === 25;
}

function isValidLitecoinAddress(address: string): boolean {
  if (address.toLowerCase().startsWith("ltc1")) {
    return isValidBech32Address(address, "ltc");
  }

  // Mainnet legacy P2PKH (L…) / P2SH (M…) with Base58Check + version bytes.
  if (!/^[LM][a-km-zA-HJ-NP-Z1-9]{25,33}$/.test(address)) return false;

  return isValidBase58Check(address, [LTC_VERSION_P2PKH, LTC_VERSION_P2SH]);
}

function isValidSolanaAddress(address: string): boolean {
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) return false;
  const decoded = decodeBase58(address);

  return decoded !== null && decoded.length === 32;
}

export function detectCryptoChain(query: string): CryptoChain | null {
  const trimmed = query.trim();

  if (!trimmed || /\s/.test(trimmed) || trimmed.includes("@")) return null;

  if (isValidEthereumAddress(trimmed)) return "ethereum";
  if (isValidBitcoinAddress(trimmed)) return "bitcoin";
  // Litecoin before Solana — both use Base58; L/M + checksum must win.
  if (isValidLitecoinAddress(trimmed)) return "litecoin";
  if (isValidSolanaAddress(trimmed)) return "solana";

  return null;
}

function satsToBtc(sats: number): string {
  return (sats / 100_000_000).toLocaleString(undefined, {
    maximumFractionDigits: 8,
  });
}

function litoshisToLtc(litoshis: number): string {
  return (litoshis / 100_000_000).toLocaleString(undefined, {
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
  return value.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
  });
}

function formatTimestamp(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleString();
}

function shortenHash(hash: string): string {
  if (hash.length <= 16) return hash;

  return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
}

async function fetchJson<T>(
  url: string,
  init?: RequestInit,
): Promise<T | null> {
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
    fetchJson<MempoolAddress>(
      `https://mempool.space/api/address/${encodeURIComponent(address)}`,
    ),
    fetchJson<MempoolTx[]>(
      `https://mempool.space/api/address/${encodeURIComponent(address)}/txs`,
    ),
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

function parseLitecoinTransactions(
  address: string,
  txs: MempoolTx[],
): CryptoTransaction[] {
  return txs.slice(0, 8).map((tx) => {
    const received = (tx.vout ?? [])
      .filter((output) => output.scriptpubkey_address === address)
      .reduce((sum, output) => sum + (output.value ?? 0), 0);

    const sent = (tx.vin ?? [])
      .filter((input) => input.prevout?.scriptpubkey_address === address)
      .reduce((sum, input) => sum + (input.prevout?.value ?? 0), 0);

    let direction: CryptoTransaction["direction"] = "self";
    let amount = 0;

    if (received > sent) {
      direction = "in";
      amount = received - sent;
    } else if (sent > received) {
      direction = "out";
      amount = sent - received;
    }

    return {
      hash: tx.txid,
      timestamp: tx.status?.block_time
        ? formatTimestamp(tx.status.block_time)
        : undefined,
      direction,
      amount: `${litoshisToLtc(amount)} LTC`,
      from: direction === "in" ? "External" : shortenHash(address),
      to: direction === "out" ? "External" : shortenHash(address),
    };
  });
}

type BlockcypherAddress = {
  balance?: number;
  final_balance?: number;
  n_tx?: number;
  total_received?: number;
  total_sent?: number;
  unconfirmed_n_tx?: number;
  txrefs?: Array<{
    tx_hash?: string;
    confirmed?: string;
    tx_input_n?: number;
    value?: number;
  }>;
};

export async function lookupLitecoinWallet(
  address: string,
): Promise<CryptoWalletResult> {
  if (!isValidLitecoinAddress(address)) {
    throw new Error(CRYPTO_WALLET_INVALID_MESSAGE);
  }

  const [addressData, txData] = await Promise.all([
    fetchJson<MempoolAddress>(
      `https://litecoinspace.org/api/address/${encodeURIComponent(address)}`,
    ),
    fetchJson<MempoolTx[]>(
      `https://litecoinspace.org/api/address/${encodeURIComponent(address)}/txs`,
    ),
  ]);

  let stats = addressData?.chain_stats;

  if (!stats) {
    const fallback = await fetchJson<BlockcypherAddress>(
      `https://api.blockcypher.com/v1/ltc/main/addrs/${encodeURIComponent(address)}?limit=8`,
    );

    if (!fallback) {
      throw new Error("Litecoin wallet lookup failed");
    }

    const balanceLitoshis = Math.max(
      0,
      fallback.final_balance ?? fallback.balance ?? 0,
    );

    return {
      chain: "litecoin",
      address,
      balance: `${litoshisToLtc(balanceLitoshis)} LTC`,
      balanceNative: litoshisToLtc(balanceLitoshis),
      txCount: fallback.n_tx ?? 0,
      tokens: [],
      recentTransactions: (fallback.txrefs ?? []).slice(0, 8).map((tx) => ({
        hash: tx.tx_hash ?? "",
        timestamp: tx.confirmed
          ? new Date(tx.confirmed).toLocaleString()
          : undefined,
        direction:
          tx.tx_input_n !== undefined && tx.tx_input_n >= 0 ? "out" : "in",
        amount:
          tx.value !== undefined ? `${litoshisToLtc(tx.value)} LTC` : undefined,
      })),
      stats: {
        "Total received": `${litoshisToLtc(fallback.total_received ?? 0)} LTC`,
        "Total sent": `${litoshisToLtc(fallback.total_sent ?? 0)} LTC`,
        "Pending mempool txs": String(fallback.unconfirmed_n_tx ?? 0),
      },
    };
  }

  const balanceLitoshis = Math.max(
    0,
    (stats.funded_txo_sum ?? 0) - (stats.spent_txo_sum ?? 0),
  );
  const mempoolPending = addressData?.mempool_stats?.tx_count ?? 0;

  return {
    chain: "litecoin",
    address,
    balance: `${litoshisToLtc(balanceLitoshis)} LTC`,
    balanceNative: litoshisToLtc(balanceLitoshis),
    txCount: stats.tx_count ?? 0,
    tokens: [],
    recentTransactions: parseLitecoinTransactions(address, txData ?? []),
    stats: {
      "Total received": `${litoshisToLtc(stats.funded_txo_sum ?? 0)} LTC`,
      "Total sent": `${litoshisToLtc(stats.spent_txo_sum ?? 0)} LTC`,
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

function parseBlockscoutTokens(
  items: BlockscoutTokenItem[],
): CryptoTokenBalance[] {
  return items.slice(0, 10).map((item) => {
    const decimals = Number(item.token?.decimals ?? 18);
    const raw = Number(item.value ?? 0) / 10 ** decimals;
    const rate = item.token?.exchange_rate
      ? Number(item.token.exchange_rate)
      : undefined;

    return {
      symbol: item.token?.symbol ?? "TOKEN",
      name: item.token?.name,
      balance: raw.toLocaleString(undefined, { maximumFractionDigits: 6 }),
      balanceUsd: rate ? formatUsd(raw * rate) : undefined,
      contractAddress: item.token?.address_hash,
    };
  });
}

function parseEthplorerTokens(
  tokens: EthplorerAddressInfo["tokens"],
): CryptoTokenBalance[] {
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

  const [
    blockscoutAddress,
    blockscoutTokens,
    blockscoutTxs,
    ethplorerInfo,
    ethplorerTxs,
  ] = await Promise.all([
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
    blockscoutAddress?.coin_balance ?? ethplorerInfo?.ETH?.rawBalance ?? "0";
  const eth = weiToEth(wei);
  const rate =
    Number(
      blockscoutAddress?.exchange_rate ?? ethplorerInfo?.ETH?.price?.rate ?? 0,
    ) || undefined;
  const usd = rate ? eth * rate : undefined;

  const blockscoutTokenList = parseBlockscoutTokens(
    blockscoutTokens?.items ?? [],
  );
  const ethplorerTokenList = parseEthplorerTokens(ethplorerInfo?.tokens);
  const tokens =
    blockscoutTokenList.length > 0 ? blockscoutTokenList : ethplorerTokenList;

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
      "Has token transfers": blockscoutAddress?.has_token_transfers
        ? "Yes"
        : "No",
      "Contract wallet": blockscoutAddress?.is_contract ? "Yes" : "No",
    },
  };
}

type SolanaRpcResponse<T> = {
  result?: T;
  error?: { code?: number; message?: string };
};

async function solanaRpcOnce<T>(
  rpcUrl: string,
  method: string,
  params: unknown[],
): Promise<{
  result: T | null;
  invalidAddress: boolean;
  transportFailed: boolean;
}> {
  try {
    const res = await fetch(rpcUrl, {
      method: "POST",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method,
        params,
      }),
    });

    if (!res.ok) {
      return { result: null, invalidAddress: false, transportFailed: true };
    }

    const data = (await res.json()) as SolanaRpcResponse<T>;
    const message = data.error?.message?.toLowerCase() ?? "";

    if (message.includes("wrongsize") || message.includes("invalid pubkey")) {
      return { result: null, invalidAddress: true, transportFailed: false };
    }

    if (data.error) {
      return { result: null, invalidAddress: false, transportFailed: true };
    }

    return {
      result: (data.result ?? null) as T | null,
      invalidAddress: false,
      transportFailed: false,
    };
  } catch {
    return { result: null, invalidAddress: false, transportFailed: true };
  }
}

async function solanaRpc<T>(
  method: string,
  params: unknown[],
): Promise<{ result: T | null; invalidAddress: boolean }> {
  for (const rpcUrl of SOLANA_RPC_URLS) {
    const outcome = await solanaRpcOnce<T>(rpcUrl, method, params);

    if (outcome.invalidAddress) {
      return { result: null, invalidAddress: true };
    }
    if (!outcome.transportFailed) {
      return { result: outcome.result, invalidAddress: false };
    }
  }

  return { result: null, invalidAddress: false };
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
  if (!isValidSolanaAddress(address)) {
    throw new Error(CRYPTO_WALLET_INVALID_MESSAGE);
  }

  const [balanceOutcome, signaturesOutcome] = await Promise.all([
    solanaRpc<{ value: number }>("getBalance", [address]),
    solanaRpc<SolanaSignature[]>("getSignaturesForAddress", [
      address,
      { limit: 8 },
    ]),
  ]);

  if (balanceOutcome.invalidAddress || signaturesOutcome.invalidAddress) {
    throw new Error(CRYPTO_WALLET_INVALID_MESSAGE);
  }

  if (balanceOutcome.result === null && signaturesOutcome.result === null) {
    throw new Error(
      "Solana wallet lookup is temporarily unavailable. Try again shortly.",
    );
  }

  const lamports = balanceOutcome.result?.value ?? 0;
  const signatures = signaturesOutcome.result ?? [];

  return {
    chain: "solana",
    address,
    balance: `${lamportsToSol(lamports)} SOL`,
    balanceNative: lamportsToSol(lamports),
    txCount: signatures.length,
    tokens: [],
    recentTransactions: signatures.map((entry) => ({
      hash: entry.signature,
      timestamp: entry.blockTime ? formatTimestamp(entry.blockTime) : undefined,
      direction: entry.err ? undefined : "self",
      amount: entry.confirmationStatus,
    })),
    stats: {
      Lamports: String(lamports),
      "Recent signatures": String(signatures.length),
    },
  };
}

export async function lookupCryptoWallet(
  query: string,
): Promise<CryptoWalletResult> {
  const address = query.trim();
  const chain = detectCryptoChain(address);

  if (!chain) {
    throw new Error(CRYPTO_WALLET_INVALID_MESSAGE);
  }

  if (chain === "bitcoin") return lookupBitcoinWallet(address);
  if (chain === "ethereum") return lookupEthereumWallet(address);
  if (chain === "litecoin") return lookupLitecoinWallet(address);

  return lookupSolanaWallet(address);
}
