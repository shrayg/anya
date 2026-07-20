"use client";

import { BlurredValue } from "@/components/dashboard/blurred-value";
import { CryptoWalletResults } from "@/components/dashboard/crypto-wallet-results";
import type {
  CryptoAddressIntelResult,
  CryptoFundFlowResult,
  CryptoIntelRiskLevel,
  CryptoRiskCheckResult,
  CryptoTxDeepDiveResult,
} from "@/lib/crypto-intel/types";

function riskTone(level: CryptoIntelRiskLevel): string {
  if (level === "critical") return "text-red-300";
  if (level === "high") return "text-orange-300";
  if (level === "elevated") return "text-amber-200";

  return "text-emerald-300";
}

function SectionTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div>
      <h3 className="font-[family-name:var(--font-bruno-ace-sc)] text-sm tracking-wide text-white">
        {title}
      </h3>
      {subtitle ? <p className="text-xs text-zinc-500">{subtitle}</p> : null}
    </div>
  );
}

function Disclaimer({ text }: { text: string }) {
  return (
    <p className="rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2 text-xs leading-relaxed text-zinc-500">
      {text}
    </p>
  );
}

function ExplorerLinks({
  links,
}: {
  links: Array<{ name: string; url: string }>;
}) {
  if (!links.length) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {links.map((link) => (
        <a
          key={link.url}
          className="rounded-md border border-anya-accent/25 bg-anya-accent/10 px-2.5 py-1 text-xs text-anya-accent transition hover:bg-anya-accent/20"
          href={link.url}
          rel="noopener noreferrer"
          target="_blank"
        >
          {link.name} ↗
        </a>
      ))}
    </div>
  );
}

export function CryptoAddressIntelResults({
  result,
  blurResults = false,
}: {
  result: CryptoAddressIntelResult;
  blurResults?: boolean;
}) {
  return (
    <div className="space-y-8">
      <Disclaimer text={result.disclaimer} />

      <div className="grid gap-2 md:grid-cols-2">
        <div className="anya-result-strip">
          <p className="anya-result-label">Risk level</p>
          <p className={`anya-result-value capitalize ${riskTone(result.riskLevel)}`}>
            {result.riskLevel}
          </p>
        </div>
        <div className="anya-result-strip">
          <p className="anya-result-label">Entity label</p>
          <p className="anya-result-value">
            <BlurredValue
              forceBlur={blurResults}
              text={result.entity?.label ?? "No seed label"}
            />
          </p>
          {result.entity?.tags?.length ? (
            <p className="mt-1 text-xs text-zinc-500">
              {result.entity.tags.join(" · ")}
            </p>
          ) : null}
        </div>
      </div>

      {result.riskFlags.length > 0 ? (
        <section className="space-y-3 border-t border-white/6 pt-8">
          <SectionTitle title="Risk flags" subtitle="From seed labels + wallet heuristics" />
          <ul className="space-y-2">
            {result.riskFlags.map((flag) => (
              <li key={flag} className="anya-result-strip text-sm text-zinc-300">
                <BlurredValue forceBlur={blurResults} text={flag} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <ExplorerLinks links={result.explorers} />

      <section className="space-y-4 border-t border-white/6 pt-8">
        <SectionTitle title="On-chain wallet" subtitle="Live balance, tokens, recent txs" />
        <CryptoWalletResults blurResults={blurResults} result={result.wallet} />
      </section>
    </div>
  );
}

export function CryptoTxDeepDiveResults({
  result,
  blurResults = false,
}: {
  result: CryptoTxDeepDiveResult;
  blurResults?: boolean;
}) {
  const rows = [
    { label: "Chain", value: result.chain },
    { label: "Hash", value: result.hash },
    ...(result.status ? [{ label: "Status", value: result.status }] : []),
    ...(result.timestamp ? [{ label: "Time", value: result.timestamp }] : []),
    ...(result.blockNumber
      ? [{ label: "Block", value: result.blockNumber }]
      : []),
    ...(result.value ? [{ label: "Value", value: result.value }] : []),
    ...(result.fee ? [{ label: "Fee", value: result.fee }] : []),
    ...(result.method ? [{ label: "Method", value: result.method }] : []),
    ...(result.from?.address
      ? [
          {
            label: "From",
            value: result.from.label
              ? `${result.from.address} (${result.from.label})`
              : result.from.address,
          },
        ]
      : []),
    ...(result.to?.address
      ? [
          {
            label: "To",
            value: result.to.label
              ? `${result.to.address} (${result.to.label})`
              : result.to.address,
          },
        ]
      : []),
    ...Object.entries(result.stats).map(([label, value]) => ({ label, value })),
  ];

  return (
    <div className="space-y-8">
      <Disclaimer text={result.disclaimer} />
      <p className="text-sm text-zinc-300">{result.summary}</p>
      <div className="grid gap-2 md:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label} className="anya-result-strip">
            <p className="anya-result-label">{row.label}</p>
            <p className="anya-result-value break-all font-mono text-sm">
              <BlurredValue forceBlur={blurResults} text={row.value} />
            </p>
          </div>
        ))}
      </div>
      <ExplorerLinks links={result.explorers} />
    </div>
  );
}

export function CryptoRiskCheckResults({
  result,
  blurResults = false,
}: {
  result: CryptoRiskCheckResult;
  blurResults?: boolean;
}) {
  return (
    <div className="space-y-8">
      <Disclaimer text={result.disclaimer} />

      <div className="grid gap-2 md:grid-cols-2">
        <div className="anya-result-strip">
          <p className="anya-result-label">Overall risk</p>
          <p className={`anya-result-value capitalize ${riskTone(result.riskLevel)}`}>
            {result.riskLevel}
          </p>
        </div>
        <div className="anya-result-strip">
          <p className="anya-result-label">Query</p>
          <p className="anya-result-value break-all font-mono text-sm">
            <BlurredValue forceBlur={blurResults} text={result.query} />
          </p>
        </div>
        {result.entity ? (
          <div className="anya-result-strip md:col-span-2">
            <p className="anya-result-label">Seed entity</p>
            <p className="anya-result-value">
              <BlurredValue forceBlur={blurResults} text={result.entity.label} />
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {result.entity.tags.join(" · ")} · {result.entity.source}
            </p>
          </div>
        ) : null}
      </div>

      {result.honeypot ? (
        <section className="space-y-3 border-t border-white/6 pt-8">
          <SectionTitle
            title="Honeypot / token scan"
            subtitle={
              result.honeypot.checked
                ? "GoPlus free token security"
                : "Limited — provider unavailable or not a token"
            }
          />
          <div className="grid gap-2 md:grid-cols-3">
            <div className="anya-result-strip">
              <p className="anya-result-label">Honeypot</p>
              <p className="anya-result-value">
                {result.honeypot.checked
                  ? result.honeypot.isHoneypot
                    ? "Flagged"
                    : "Not flagged"
                  : "Not checked"}
              </p>
            </div>
            {result.honeypot.buyTax ? (
              <div className="anya-result-strip">
                <p className="anya-result-label">Buy tax</p>
                <p className="anya-result-value">{result.honeypot.buyTax}%</p>
              </div>
            ) : null}
            {result.honeypot.sellTax ? (
              <div className="anya-result-strip">
                <p className="anya-result-label">Sell tax</p>
                <p className="anya-result-value">{result.honeypot.sellTax}%</p>
              </div>
            ) : null}
          </div>
          {result.honeypot.detail ? (
            <p className="text-xs text-zinc-500">{result.honeypot.detail}</p>
          ) : null}
        </section>
      ) : null}

      <section className="space-y-3 border-t border-white/6 pt-8">
        <SectionTitle title="Findings" />
        <div className="space-y-2">
          {result.findings.map((finding) => (
            <div key={finding.id} className="anya-result-strip">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="anya-result-label">{finding.title}</p>
                <p className={`text-xs capitalize ${riskTone(finding.severity)}`}>
                  {finding.severity}
                </p>
              </div>
              <p className="anya-result-value text-sm text-zinc-300">
                <BlurredValue forceBlur={blurResults} text={finding.detail} />
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function CryptoFundFlowResults({
  result,
  blurResults = false,
}: {
  result: CryptoFundFlowResult;
  blurResults?: boolean;
}) {
  return (
    <div className="space-y-8">
      <Disclaimer text={result.disclaimer} />

      <div className="grid gap-2 md:grid-cols-2">
        <div className="anya-result-strip">
          <p className="anya-result-label">Root</p>
          <p className="anya-result-value break-all font-mono text-sm">
            <BlurredValue forceBlur={blurResults} text={result.rootAddress} />
          </p>
        </div>
        <div className="anya-result-strip">
          <p className="anya-result-label">Chain</p>
          <p className="anya-result-value capitalize">{result.chain}</p>
        </div>
      </div>

      <section className="space-y-3 border-t border-white/6 pt-8">
        <SectionTitle
          title="Recent hops"
          subtitle="Basic 1-hop view from recent txs — not multi-hop chain analytics"
        />
        <div className="space-y-2">
          {result.hops.map((hop) => (
            <div key={`${hop.hop}-${hop.txHash}`} className="anya-result-strip">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="anya-result-label">
                  Hop {hop.hop}
                  {hop.direction ? ` · ${hop.direction.toUpperCase()}` : ""}
                  {hop.timestamp ? ` · ${hop.timestamp}` : ""}
                </p>
                {hop.amount ? (
                  <p className="text-sm text-anya-accent">
                    <BlurredValue forceBlur={blurResults} text={hop.amount} />
                  </p>
                ) : null}
              </div>
              <p className="mt-1 break-all font-mono text-xs text-zinc-400">
                <BlurredValue
                  forceBlur={blurResults}
                  text={`${hop.from}${hop.fromLabel ? ` (${hop.fromLabel})` : ""} → ${hop.to}${hop.toLabel ? ` (${hop.toLabel})` : ""}`}
                />
              </p>
              {hop.txHash ? (
                <p className="mt-1 break-all font-mono text-[11px] text-zinc-600">
                  {hop.txHash}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      {result.counterparties.length > 0 ? (
        <section className="space-y-3 border-t border-white/6 pt-8">
          <SectionTitle title="Counterparties" />
          <div className="grid gap-2 md:grid-cols-2">
            {result.counterparties.map((cp) => (
              <div key={cp.address} className="anya-result-strip">
                <p className="anya-result-label">
                  {cp.direction.toUpperCase()} · {cp.txCount} tx
                  {cp.label ? ` · ${cp.label}` : ""}
                </p>
                <p className="anya-result-value break-all font-mono text-xs">
                  <BlurredValue forceBlur={blurResults} text={cp.address} />
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
