"use client";

import clsx from "clsx";

import { BlurredValue } from "@/components/dashboard/blurred-value";
import type { FormattedRecord } from "@/lib/search-utils";

export function SearchResultCards({
  records,
  blurResults = false,
  totalCount,
  selectedExportIndex = null,
  onSelectExportIndex,
}: {
  records: FormattedRecord[];
  blurResults?: boolean;
  totalCount?: number;
  selectedExportIndex?: number | null;
  onSelectExportIndex?: (index: number) => void;
}) {
  if (records.length === 0) {
    return (
      <p className="border-l-2 border-zinc-500/40 bg-white/4 px-4 py-3 text-sm text-zinc-400">
        No readable fields returned for this query.
      </p>
    );
  }

  const shown = records.length;
  const total = totalCount ?? shown;
  const selectable = Boolean(onSelectExportIndex);

  return (
    <div className="space-y-3">
      <p className="text-xs text-zinc-500">
        {shown.toLocaleString()} record{shown === 1 ? "" : "s"}
        {total > shown ? ` · ${total.toLocaleString()} total` : ""}
      </p>

      <div className="grid gap-3 lg:grid-cols-2">
        {records.map((record) => {
          const selected = selectedExportIndex === record.index;

          return (
            <article
              key={`${record.index}-${record.title}`}
              className={clsx(
                "anya-result-card overflow-hidden transition",
                selectable && "cursor-pointer hover:border-white/15",
                selected && "border-anya-accent-soft",
              )}
              onClick={
                selectable
                  ? () => onSelectExportIndex?.(selected ? -1 : record.index)
                  : undefined
              }
              onKeyDown={
                selectable
                  ? (event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelectExportIndex?.(selected ? -1 : record.index);
                      }
                    }
                  : undefined
              }
              role={selectable ? "button" : undefined}
              tabIndex={selectable ? 0 : undefined}
            >
              <header className="anya-result-card-header">
                <div className="min-w-0">
                  <p className="anya-result-card-title">{record.title}</p>
                  {record.subtitle && (
                    <p className="anya-result-card-subtitle truncate">{record.subtitle}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {record.badge && record.badge !== record.title && (
                    <span className="anya-result-badge">{record.badge}</span>
                  )}
                  <span className="anya-result-index">#{record.index}</span>
                </div>
              </header>

              <div className="anya-result-card-body">
                {record.fields.map((field) => (
                  <div
                    key={`${record.index}-${field.key}`}
                    className={clsx(
                      "anya-result-field",
                      field.sensitive && "anya-result-field--sensitive",
                    )}
                  >
                    <p className="anya-result-label">{field.label}</p>
                    <p
                      className={clsx(
                        "anya-result-value",
                        field.highlight && "text-anya-accent",
                      )}
                    >
                      <BlurredValue forceBlur={blurResults} text={field.value} />
                    </p>
                  </div>
                ))}
              </div>
            </article>
          );
        })}
      </div>

      {blurResults && (
        <p className="text-xs text-zinc-500">
          Results are blurred on the Free plan. Upgrade to reveal full values.
        </p>
      )}
    </div>
  );
}
