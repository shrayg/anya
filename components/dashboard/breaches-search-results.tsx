"use client";

import type { CombSearchResult } from "@/lib/proxynova-comb";

import {
  ResultCard,
  ResultCardList,
  ResultStatStrip,
  type ResultCardFieldDef,
} from "@/components/dashboard/result-card";
import { formatBreachCredentialAsText } from "@/lib/export-intel";

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
    <div className="anya-result-stack">
      <div className="grid gap-2 sm:grid-cols-2">
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

      <ResultCardList>
        {result.credentials.map((row, index) => {
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

          return (
            <ResultCard
              key={`${row.raw}-${index}`}
              badge={null}
              blurResults={blurResults}
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

      {blurResults ? (
        <p className="text-xs text-zinc-500">
          Free plan results are partially blurred. Upgrade to see full
          credentials.
        </p>
      ) : null}
      {result.totalMatches > result.returned ? (
        <p className="text-xs text-zinc-500">
          Results merge every available breach index. Narrow the query for more
          precise hits.
        </p>
      ) : null}
    </div>
  );
}
