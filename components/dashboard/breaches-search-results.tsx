"use client";

import clsx from "clsx";

import { BlurredValue } from "@/components/dashboard/blurred-value";
import type { CombSearchResult } from "@/lib/proxynova-comb";

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

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="anya-result-strip">
          <p className="anya-result-label">Total matches</p>
          <p className="anya-result-value">{result.totalMatches.toLocaleString()}</p>
        </div>
        <div className="anya-result-strip">
          <p className="anya-result-label">Shown</p>
          <p className="anya-result-value">
            {result.returned.toLocaleString()}
            {result.totalMatches > result.returned ? ` (offset ${result.start})` : ""}
          </p>
        </div>
      </div>


      <div className="grid gap-3 lg:grid-cols-2">
        {result.credentials.map((row, index) => {
          const cardIndex = index + 1;
          const selected = selectedExportIndex === cardIndex;

          return (
            <article
              key={`${row.raw}-${index}`}
              className={clsx(
                "anya-result-card overflow-hidden transition",
                selectable && "cursor-pointer hover:border-white/15",
                selected && "border-anya-accent-soft",
              )}
              onClick={
                selectable
                  ? () => onSelectExportIndex?.(selected ? -1 : cardIndex)
                  : undefined
              }
              onKeyDown={
                selectable
                  ? (event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelectExportIndex?.(selected ? -1 : cardIndex);
                      }
                    }
                  : undefined
              }
              role={selectable ? "button" : undefined}
              tabIndex={selectable ? 0 : undefined}
            >
              <header className="anya-result-card-header">
                <div className="min-w-0">
                  <p className="anya-result-card-title">
                    {row.secret ? "Leaked credential" : "Match"}
                  </p>
                  <p className="anya-result-card-subtitle truncate">{row.identifier}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="anya-result-index">#{cardIndex}</span>
                </div>
              </header>
              <div className="anya-result-card-body">
                <div className="anya-result-field">
                  <p className="anya-result-label">Email / login</p>
                  <p className="anya-result-value text-anya-accent">
                    <BlurredValue forceBlur={blurResults} text={row.identifier} />
                  </p>
                </div>
                {row.secret && (
                  <div className="anya-result-field anya-result-field--sensitive">
                    <p className="anya-result-label">Password</p>
                    <p className="anya-result-value">
                      <BlurredValue forceBlur={blurResults} text={row.secret} />
                    </p>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {blurResults && (
        <p className="text-xs text-zinc-500">
          Free plan results are partially blurred. Upgrade to see full credentials.
        </p>
      )}
      {result.totalMatches > result.returned && (
        <p className="text-xs text-zinc-500">
          Up to 100 rows returned per request. Narrow the query for more precise hits.
        </p>
      )}
    </div>
  );
}
