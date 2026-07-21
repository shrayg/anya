"use client";

import { useState } from "react";

import {
  CryptoAddressIntelResults,
  CryptoFundFlowResults,
  CryptoRiskCheckResults,
  CryptoTxDeepDiveResults,
} from "@/components/dashboard/crypto-intel-results";
import { CryptoWalletResults } from "@/components/dashboard/crypto-wallet-results";
import type { CryptoFullSuiteResult } from "@/lib/crypto-intel/types";

const TABS = [
  { id: "wallet", label: "Wallet" },
  { id: "address", label: "Address" },
  { id: "risk", label: "Risk" },
  { id: "flow", label: "Flow" },
  { id: "tx", label: "Transaction" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function availableTabs(result: CryptoFullSuiteResult): TabId[] {
  const tabs: TabId[] = [];

  if (result.wallet) tabs.push("wallet");
  if (result.address) tabs.push("address");
  if (result.risk) tabs.push("risk");
  if (result.flow) tabs.push("flow");
  if (result.tx) tabs.push("tx");

  return tabs;
}

export function CryptoFullSuiteResults({
  result,
  blurResults = false,
}: {
  result: CryptoFullSuiteResult;
  blurResults?: boolean;
}) {
  const tabs = availableTabs(result);
  const [active, setActive] = useState<TabId>(tabs[0] ?? "wallet");
  const current = tabs.includes(active) ? active : tabs[0];

  return (
    <div className="space-y-4">
      <div className="anya-result-strip">
        <p className="anya-result-label">Crypto Intel · Full suite</p>
        <p className="anya-result-value text-base">
          {result.chainLabel
            ? `${result.chainLabel} · ${result.inputKind}`
            : result.inputKind === "tx"
              ? "Transaction"
              : "Wallet"}
        </p>
        {result.sources.length > 0 ? (
          <p className="mt-1 text-xs text-zinc-500">
            Sources: {result.sources.join(" · ")}
          </p>
        ) : null}
      </div>

      {tabs.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {tabs.map((id) => {
            const label = TABS.find((t) => t.id === id)?.label ?? id;
            const selected = current === id;

            return (
              <button
                key={id}
                className={
                  selected
                    ? "rounded-full border border-[var(--anya-blush)]/50 bg-[var(--anya-blush)]/15 px-3 py-1 text-xs font-medium text-[var(--anya-blush)]"
                    : "rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-zinc-300 hover:border-white/25"
                }
                type="button"
                onClick={() => setActive(id)}
              >
                {label}
              </button>
            );
          })}
        </div>
      ) : null}

      {current === "wallet" && result.wallet ? (
        <CryptoWalletResults blurResults={blurResults} result={result.wallet} />
      ) : null}
      {current === "address" && result.address ? (
        <CryptoAddressIntelResults
          blurResults={blurResults}
          result={result.address}
        />
      ) : null}
      {current === "risk" && result.risk ? (
        <CryptoRiskCheckResults
          blurResults={blurResults}
          result={result.risk}
        />
      ) : null}
      {current === "flow" && result.flow ? (
        <CryptoFundFlowResults blurResults={blurResults} result={result.flow} />
      ) : null}
      {current === "tx" && result.tx ? (
        <CryptoTxDeepDiveResults blurResults={blurResults} result={result.tx} />
      ) : null}

      <p className="text-[11px] leading-relaxed text-zinc-600">
        {result.disclaimer}
      </p>
    </div>
  );
}
