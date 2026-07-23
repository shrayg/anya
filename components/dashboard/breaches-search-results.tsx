"use client";

import type { CombSearchResult } from "@/lib/proxynova-comb";

import { useEffect, useMemo, useState } from "react";

import {
  ResultCard,
  ResultCardList,
  ResultStatStrip,
  type ResultCardFieldDef,
} from "@/components/dashboard/result-card";
import { IpIntelPanel } from "@/components/dashboard/ip-intel-panel";
import { formatBreachCredentialAsText } from "@/lib/export-intel";
import {
  extractIpsFromTexts,
  isIpAddress,
  isIpFieldKey,
} from "@/lib/ip-detect";

/** Progressive paint — never drops remaining rows; "Show all" reveals everything. */
const BREACH_RENDER_BATCH = 80;

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
  const [visibleCount, setVisibleCount] = useState(BREACH_RENDER_BATCH);

  const resultsKey = useMemo(
    () =>
      `${result.query}:${result.returned}:${result.credentials.length}:${result.start}`,
    [result.query, result.returned, result.credentials.length, result.start],
  );

  useEffect(() => {
    setVisibleCount(BREACH_RENDER_BATCH);
  }, [resultsKey]);

  const visibleRows = result.credentials.slice(0, visibleCount);
  const hiddenCount = Math.max(0, result.credentials.length - visibleCount);

  return (
    <div className="anya-result-stack anya-result-stack--breaches">
      <div className="anya-result-stack--breaches-stats grid gap-2 sm:grid-cols-2">
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

      <ResultCardList className="anya-result-list--dense-left">
        {visibleRows.map((row, index) => {
          const cardIndex = index + 1;
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

          const ips = extractIpsFromTexts([
            isIpAddress(row.identifier) ? row.identifier : null,
            ...connected
              .filter((field) => isIpFieldKey(field.key) || isIpAddress(field.value))
              .map((field) => field.value),
          ]);

          return (
            <ResultCard
              key={`${row.raw}-${index}`}
              badge={null}
              blurResults={blurResults}
              className="anya-result-card--dense"
              copyText={formatBreachCredentialAsText(row, cardIndex)}
              fields={fields}
              footer={
                ips[0] ? (
                  <IpIntelPanel blurResults={blurResults} ip={ips[0]!} />
                ) : null
              }
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

      {hiddenCount > 0 ? (
        <div className="anya-result-stack-actions anya-result-stack-actions--left">
          <button
            className="anya-result-load-more"
            type="button"
            onClick={() =>
              setVisibleCount((count) =>
                Math.min(
                  result.credentials.length,
                  count + BREACH_RENDER_BATCH,
                ),
              )
            }
          >
            Show {Math.min(BREACH_RENDER_BATCH, hiddenCount).toLocaleString()}{" "}
            more
          </button>
          <button
            className="anya-result-stack-action"
            type="button"
            onClick={() => setVisibleCount(result.credentials.length)}
          >
            Show all {result.credentials.length.toLocaleString()}
          </button>
        </div>
      ) : null}

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
