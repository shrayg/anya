import type { CryptoWalletResult } from "@/lib/crypto-wallet";

import { BlurredValue } from "@/components/dashboard/blurred-value";

function chainLabel(chain: CryptoWalletResult["chain"]) {
  if (chain === "bitcoin") return "Bitcoin";
  if (chain === "ethereum") return "Ethereum";
  if (chain === "litecoin") return "Litecoin";

  return "Solana";
}

export function CryptoWalletResults({
  result,
  blurResults = false,
}: {
  result: CryptoWalletResult;
  blurResults?: boolean;
}) {
  const summaryRows = [
    { label: "Chain", value: chainLabel(result.chain) },
    { label: "Address", value: result.address },
    { label: "Balance", value: result.balance },
    ...(result.balanceUsd
      ? [{ label: "Balance (USD)", value: result.balanceUsd }]
      : []),
    ...(result.ensName ? [{ label: "ENS", value: result.ensName }] : []),
    { label: "Transactions", value: String(result.txCount) },
    ...(result.tokenCount !== undefined
      ? [{ label: "Token holdings", value: String(result.tokenCount) }]
      : []),
    ...(result.isContract !== undefined
      ? [{ label: "Contract", value: result.isContract ? "Yes" : "No" }]
      : []),
    ...(result.exchangeRateUsd
      ? [
          {
            label: "Native/USD rate",
            value: `$${result.exchangeRateUsd.toLocaleString()}`,
          },
        ]
      : []),
    ...Object.entries(result.stats).map(([label, value]) => ({ label, value })),
  ];

  return (
    <div className="space-y-8">
      <div className="grid gap-2 md:grid-cols-2">
        {summaryRows.map((row) => (
          <div key={row.label} className="anya-result-strip">
            <p className="anya-result-label">{row.label}</p>
            <p className="anya-result-value break-all font-mono text-sm">
              <BlurredValue forceBlur={blurResults} text={row.value} />
            </p>
          </div>
        ))}
      </div>

      {result.tokens.length > 0 && (
        <section className="space-y-4 border-t border-white/6 pt-8">
          <div>
            <h3 className="font-[family-name:var(--font-bruno-ace-sc)] text-sm tracking-wide text-white">
              Token balances
            </h3>
            <p className="text-xs text-zinc-500">
              Top ERC-20 holdings on this wallet
            </p>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {result.tokens.map((token) => (
              <div
                key={`${token.symbol}-${token.contractAddress ?? token.name}`}
                className="anya-result-strip"
              >
                <p className="anya-result-label">{token.symbol}</p>
                <p className="anya-result-value">
                  <BlurredValue
                    forceBlur={blurResults}
                    text={`${token.balance}${token.name ? ` · ${token.name}` : ""}`}
                  />
                </p>
                {token.balanceUsd && (
                  <p className="mt-1 text-xs text-zinc-400">
                    <BlurredValue
                      forceBlur={blurResults}
                      text={token.balanceUsd}
                    />
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {result.recentTransactions.length > 0 && (
        <section className="space-y-4 border-t border-white/6 pt-8">
          <div>
            <h3 className="font-[family-name:var(--font-bruno-ace-sc)] text-sm tracking-wide text-white">
              Recent activity
            </h3>
            <p className="text-xs text-zinc-500">
              Latest on-chain transactions
            </p>
          </div>
          <div className="grid gap-2">
            {result.recentTransactions.map((tx) => (
              <div key={tx.hash} className="anya-result-strip">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="anya-result-label">
                    {tx.direction ? tx.direction.toUpperCase() : "TX"}
                    {tx.timestamp ? ` · ${tx.timestamp}` : ""}
                  </p>
                  {tx.amount && (
                    <p className="text-sm text-anya-accent">
                      <BlurredValue forceBlur={blurResults} text={tx.amount} />
                    </p>
                  )}
                </div>
                <p className="anya-result-value break-all font-mono text-xs">
                  <BlurredValue forceBlur={blurResults} text={tx.hash} />
                </p>
                {(tx.from || tx.to) && (
                  <p className="mt-1 text-xs text-zinc-400">
                    <BlurredValue
                      forceBlur={blurResults}
                      text={`${tx.from ? `From ${tx.from}` : ""}${tx.from && tx.to ? " → " : ""}${tx.to ? `To ${tx.to}` : ""}`}
                    />
                  </p>
                )}
                {tx.amountUsd && (
                  <p className="mt-1 text-xs text-zinc-500">
                    <BlurredValue forceBlur={blurResults} text={tx.amountUsd} />
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
