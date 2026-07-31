"use client";

import type { CombSearchResult } from "@/lib/proxynova-comb";

import { useEffect, useMemo, useState } from "react";

import {
  ResultCard,
  ResultCardList,
  ResultStatStrip,
  type ResultCardFieldDef,
} from "@/components/dashboard/result-card";
import { EmailAnalyzerPanel } from "@/components/dashboard/email-analyzer-panel";
import { IpIntelPanel } from "@/components/dashboard/ip-intel-panel";
import {
  RESULTS_PAGE_SIZE,
  ResultsPager,
} from "@/components/dashboard/results-pager";
import { formatBreachCredentialAsText } from "@/lib/export-intel";
import {
  extractIpsFromTexts,
  isIpAddress,
  isIpFieldKey,
} from "@/lib/ip-detect";
import { normalizeEmail } from "@/lib/proxynova-comb";

function collectIpsFromResult(result: CombSearchResult): string[] {
  const values: Array<string | null | undefined> = [];

  for (const row of result.credentials) {
    if (isIpAddress(row.identifier)) values.push(row.identifier);
    for (const field of row.fields ?? []) {
      if (isIpFieldKey(field.key) || isIpAddress(field.value)) {
        values.push(field.value);
      }
    }
  }

  return extractIpsFromTexts(values);
}

export function BreachesSearchResults({
  result,
  blurResults = false,
  selectedExportIndex = null,
  onSelectExportIndex,
}: {
  result: CombSearchResult;
  blurResults?: boolean;
  selectedExportIndex?: number | null;
  onSelectExportIndex?: (index: number) => void;
}) {
  const selectable = Boolean(onSelectExportIndex);
  const [page, setPage] = useState(1);
  const ips = useMemo(() => collectIpsFromResult(result), [result]);
  const [activeIp, setActiveIp] = useState<string | null>(ips[0] ?? null);
  const queryEmail = useMemo(
    () => normalizeEmail(result.query),
    [result.query],
  );
  const queryLabel = queryEmail ? "Email" : "Username";
  const queryValue = queryEmail ?? result.query.trim();

  const resultsKey = useMemo(
    () =>
      `${result.query}:${result.returned}:${result.credentials.length}:${result.start}`,
    [result.query, result.returned, result.credentials.length, result.start],
  );

  const pageCount = Math.max(
    1,
    Math.ceil(result.credentials.length / RESULTS_PAGE_SIZE),
  );

  useEffect(() => {
    setPage(1);
  }, [resultsKey]);

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount));
  }, [pageCount]);

  useEffect(() => {
    setActiveIp((current) => {
      if (current && ips.includes(current)) return current;

      return ips[0] ?? null;
    });
  }, [ips]);

  const pageStart = (page - 1) * RESULTS_PAGE_SIZE;
  const visibleRows = result.credentials.slice(
    pageStart,
    pageStart + RESULTS_PAGE_SIZE,
  );

  return (
    <div className="anya-result-stack anya-result-stack--breaches">
      <div className="anya-result-stack--breaches-stats grid gap-1.5 sm:grid-cols-2">
        <ResultStatStrip
          label="Total matches"
          value={result.totalMatches.toLocaleString()}
        />
        <ResultStatStrip
          label="Shown"
          value={
            <>
              {result.returned.toLocaleString()}
              {result.totalMatches > result.returned
                ? ` (offset ${result.start})`
                : ""}
            </>
          }
        />
      </div>

      {/* Context row fills width — IP + analyzer side-by-side, no tall empty gutters */}
      <div className="anya-breaches-context">
        <div className="anya-breaches-col anya-breaches-col--context">
          {activeIp ? (
            <div className="anya-breaches-side-panel anya-breaches-side-panel--ip">
              {ips.length > 1 ? (
                <div
                  aria-label="IP addresses"
                  className="anya-breaches-ip-picker"
                  role="listbox"
                >
                  {ips.slice(0, 12).map((ip) => (
                    <button
                      key={ip}
                      aria-selected={ip === activeIp}
                      className={
                        ip === activeIp
                          ? "anya-breaches-ip-chip anya-breaches-ip-chip--active"
                          : "anya-breaches-ip-chip"
                      }
                      role="option"
                      type="button"
                      onClick={() => setActiveIp(ip)}
                    >
                      {blurResults ? "••••••••" : ip}
                    </button>
                  ))}
                </div>
              ) : null}
              <IpIntelPanel
                blurResults={blurResults}
                ip={activeIp}
                moduleSlug="breaches"
                variant="panel"
              />
            </div>
          ) : (
            <div className="anya-breaches-side-panel anya-breaches-side-panel--ip anya-breaches-side-panel--empty">
              <p className="anya-breaches-side-panel-empty">
                No IP addresses found in these breach hits.
              </p>
            </div>
          )}

          {queryValue ? (
            <div className="anya-breaches-email-label">
              <span className="anya-breaches-email-label-caption">
                {queryLabel}
              </span>
              <span className="anya-breaches-email-label-value">
                {blurResults ? "••••••••" : queryValue}
              </span>
            </div>
          ) : null}
        </div>

        <div className="anya-breaches-col anya-breaches-col--context">
          <EmailAnalyzerPanel blurResults={blurResults} query={result.query} />
        </div>
      </div>

      {/* Credential cards pack across full width in a responsive auto-fit grid */}
      <div className="anya-breaches-credentials">
        <ResultCardList className="anya-result-list--dense-fill">
          {visibleRows.map((row, index) => {
            const cardIndex = pageStart + index + 1;
            const selected = selectedExportIndex === cardIndex;
            const connected = row.fields ?? [];
            const fields: ResultCardFieldDef[] = [
              {
                key: "identifier",
                label: "Email / login",
                value: row.identifier,
                highlight: true,
              },
              ...(row.secret
                ? [
                    {
                      key: "password",
                      label: "Password",
                      value: row.secret,
                      sensitive: true,
                    },
                  ]
                : []),
              ...connected.map((field) => ({
                key: field.key,
                label: field.label,
                value: field.value,
                sensitive: field.key === "password" || field.key === "hash",
              })),
            ];

            return (
              <ResultCard
                key={`${row.raw}-${cardIndex}`}
                badge={null}
                blurResults={blurResults}
                className="anya-result-card--dense"
                copyText={formatBreachCredentialAsText(row, cardIndex)}
                fields={fields}
                indexLabel={cardIndex}
                listIndex={index}
                selectable={selectable}
                selected={selected}
                subtitle={row.identifier}
                title={row.secret ? "Leaked credential" : "Match"}
                onSelect={
                  selectable
                    ? () => onSelectExportIndex?.(selected ? -1 : cardIndex)
                    : undefined
                }
              />
            );
          })}
        </ResultCardList>

        <ResultsPager
          page={page}
          pageCount={pageCount}
          pageSize={RESULTS_PAGE_SIZE}
          total={result.credentials.length}
          onNext={() => setPage((current) => Math.min(pageCount, current + 1))}
          onPrev={() => setPage((current) => Math.max(1, current - 1))}
        />
      </div>

      {blurResults ? (
        <p className="text-xs text-zinc-500">
          Free plan results are partially blurred. Upgrade to see full
          credentials.
        </p>
      ) : null}
      {result.totalMatches > result.returned ? (
        <p className="text-xs text-zinc-500">
          Provider indexes may paginate large corpora. Shown{" "}
          {result.returned.toLocaleString()} of{" "}
          {result.totalMatches.toLocaleString()} reported matches
          {result.start > 0 ? ` (offset ${result.start})` : ""}. ProxyNova COMB
          serves 100 rows per page; we walk every page up to the memory-safety
          ceiling.
        </p>
      ) : null}
    </div>
  );
}
