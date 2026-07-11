"use client";

import clsx from "clsx";
import { ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";

import { BlurredValue } from "@/components/dashboard/blurred-value";
import { ResultsBlurNotice } from "@/components/results-blur-notice";
import type { FormattedField, FormattedRecord } from "@/lib/search-utils";

const PAGE_SIZE = 8;
const VALUE_PREVIEW_LENGTH = 72;

function truncateValue(value: string, max = VALUE_PREVIEW_LENGTH) {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}…`;
}

function ResultField({
  field,
  blurResults,
  expanded,
}: {
  field: FormattedField;
  blurResults: boolean;
  expanded: boolean;
}) {
  const displayValue = expanded ? field.value : truncateValue(field.value);

  return (
    <div
      className={clsx(
        "anya-result-field",
        field.sensitive && "anya-result-field--sensitive",
      )}
      title={field.value.length > VALUE_PREVIEW_LENGTH ? field.value : undefined}
    >
      <p className="anya-result-label">{field.label}</p>
      <p
        className={clsx(
          "anya-result-value",
          !expanded && "anya-result-value--clamp",
          field.highlight && "text-anya-accent",
        )}
      >
        <BlurredValue forceBlur={blurResults} text={displayValue} />
      </p>
    </div>
  );
}

export function SearchResultCards({
  records,
  blurResults = false,
  totalCount,
  selectedExportIndex = null,
  onSelectExportIndex,
  initialVisible = PAGE_SIZE,
}: {
  records: FormattedRecord[];
  blurResults?: boolean;
  totalCount?: number;
  selectedExportIndex?: number | null;
  onSelectExportIndex?: (index: number) => void;
  initialVisible?: number;
}) {
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set());
  const [visibleCount, setVisibleCount] = useState(initialVisible);

  const selectable = Boolean(onSelectExportIndex);
  const shown = records.length;
  const total = totalCount ?? shown;
  const visibleRecords = useMemo(
    () => records.slice(0, visibleCount),
    [records, visibleCount],
  );
  const hiddenCount = Math.max(0, records.length - visibleCount);

  const toggleExpanded = (index: number) => {
    setExpanded((current) => {
      const next = new Set(current);

      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }

      return next;
    });
  };

  if (records.length === 0) {
    return (
      <p className="border-l-2 border-zinc-500/40 bg-white/4 px-4 py-3 text-sm text-zinc-400">
        No readable fields returned for this query.
      </p>
    );
  }

  return (
    <div className="anya-result-stack">
      <div className="anya-result-stack-toolbar">
        <p className="text-xs text-zinc-500">
          {shown.toLocaleString()} record{shown === 1 ? "" : "s"}
          {total > shown ? ` · ${total.toLocaleString()} total` : ""}
          {expanded.size > 0 ? ` · ${expanded.size} expanded` : " · tap ▼ to expand"}
        </p>
        {expanded.size > 0 ? (
          <button
            className="anya-result-stack-action"
            onClick={() => setExpanded(new Set())}
            type="button"
          >
            Collapse all
          </button>
        ) : null}
      </div>

      <div className="anya-result-list">
        {visibleRecords.map((record) => {
          const isExpanded = expanded.has(record.index);
          const selected = selectedExportIndex === record.index;

          return (
            <article
              key={`${record.index}-${record.title}`}
              className={clsx(
                "anya-result-card",
                isExpanded && "anya-result-card--expanded",
                selectable && "anya-result-card--selectable",
                selected && "anya-result-card--selected",
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
                <div className="min-w-0 flex-1">
                  <p className="anya-result-card-title">{record.title}</p>
                  {record.subtitle ? (
                    <p className="anya-result-card-subtitle truncate">{record.subtitle}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {record.badge && record.badge !== record.title ? (
                    <span className="anya-result-badge">{record.badge}</span>
                  ) : null}
                  <span className="anya-result-index">#{record.index}</span>
                  <button
                    aria-expanded={isExpanded}
                    aria-label={isExpanded ? "Collapse record" : "Expand record"}
                    className={clsx(
                      "anya-result-expand",
                      isExpanded && "anya-result-expand--open",
                    )}
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleExpanded(record.index);
                    }}
                    type="button"
                  >
                    <ChevronDown className="size-3.5" />
                  </button>
                </div>
              </header>

              {!isExpanded ? null : (
                <div className="anya-result-card-body">
                  {record.fields.map((field) => (
                    <ResultField
                      blurResults={blurResults}
                      expanded={isExpanded}
                      field={field}
                      key={`${record.index}-${field.key}`}
                    />
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </div>

      {hiddenCount > 0 ? (
        <button
          className="anya-result-load-more"
          onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
          type="button"
        >
          Show {Math.min(PAGE_SIZE, hiddenCount)} more record
          {Math.min(PAGE_SIZE, hiddenCount) === 1 ? "" : "s"}
        </button>
      ) : null}

      {blurResults ? <ResultsBlurNotice /> : null}
    </div>
  );
}
