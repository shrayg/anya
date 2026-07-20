"use client";

import type { FormattedField, FormattedRecord } from "@/lib/search-utils";

import clsx from "clsx";
import { ChevronDown } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { BlurredValue } from "@/components/dashboard/blurred-value";
import { ResultCopyButton } from "@/components/dashboard/result-copy-button";
import { SearchEmptyState } from "@/components/dashboard/search-empty-state";
import { ResultsBlurNotice } from "@/components/results-blur-notice";
import { formatRecordAsText, formatRecordsAsText } from "@/lib/export-intel";

const PAGE_SIZE = 8;
const VALUE_PREVIEW_LENGTH = 72;

function truncateValue(value: string, max = VALUE_PREVIEW_LENGTH) {
  if (value.length <= max) return value;

  return `${value.slice(0, max)}…`;
}

function indexesOf(records: FormattedRecord[]): Set<number> {
  return new Set(records.map((record) => record.index));
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
  const isBlock = Boolean(field.block);
  const displayValue =
    expanded || isBlock ? field.value : truncateValue(field.value);

  return (
    <div
      className={clsx(
        "anya-result-field",
        field.sensitive && "anya-result-field--sensitive",
        isBlock && "anya-result-field--block",
      )}
      title={
        !isBlock && field.value.length > VALUE_PREVIEW_LENGTH
          ? field.value
          : undefined
      }
    >
      <p className="anya-result-label">{field.label}</p>
      <div className="anya-result-field-row">
        <p
          className={clsx(
            "anya-result-value",
            isBlock && "anya-result-value--block",
            !expanded && !isBlock && "anya-result-value--clamp",
            field.highlight && !isBlock && "text-anya-accent",
          )}
        >
          <BlurredValue forceBlur={blurResults} text={displayValue} />
        </p>
        {expanded && field.value.trim() ? (
          <ResultCopyButton compact text={field.value} />
        ) : null}
      </div>
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
  emptyDetail = "No results were found.",
}: {
  records: FormattedRecord[];
  blurResults?: boolean;
  totalCount?: number;
  selectedExportIndex?: number | null;
  onSelectExportIndex?: (index: number) => void;
  initialVisible?: number;
  emptyDetail?: string;
}) {
  const [expanded, setExpanded] = useState<Set<number>>(() =>
    indexesOf(records),
  );
  const [visibleCount, setVisibleCount] = useState(initialVisible);

  const resultsKey = useMemo(
    () => records.map((record) => `${record.index}:${record.title}`).join("|"),
    [records],
  );

  const sortedRecords = useMemo(() => {
    return [...records].sort((a, b) => {
      const titleCmp = a.title.localeCompare(b.title, undefined, {
        sensitivity: "base",
      });

      if (titleCmp !== 0) return titleCmp;

      return a.index - b.index;
    });
  }, [records]);

  useEffect(() => {
    setExpanded(indexesOf(records));
    setVisibleCount(initialVisible);
    // resultsKey captures record identity; avoid re-expanding on referential churn.
  }, [resultsKey, initialVisible]);

  const selectable = Boolean(onSelectExportIndex);
  const shown = sortedRecords.length;
  const total = totalCount ?? shown;
  const visibleRecords = useMemo(
    () => sortedRecords.slice(0, visibleCount),
    [sortedRecords, visibleCount],
  );
  const hiddenCount = Math.max(0, sortedRecords.length - visibleCount);
  const expandedVisible = visibleRecords.filter((record) =>
    expanded.has(record.index),
  ).length;
  const allVisibleExpanded =
    visibleRecords.length > 0 && expandedVisible === visibleRecords.length;

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
    return <SearchEmptyState detail={emptyDetail} />;
  }

  return (
    <div className="anya-result-stack">
      <div className="anya-result-stack-toolbar">
        <p className="anya-result-stack-meta">
          {shown.toLocaleString()} record{shown === 1 ? "" : "s"}
          {total > shown ? ` · ${total.toLocaleString()} total` : ""}
          {" · Sorted A–Z"}
          {expandedVisible > 0
            ? ` · ${expandedVisible} expanded`
            : " · collapsed"}
        </p>
        <div className="anya-result-stack-actions">
          <ResultCopyButton
            label="Copy all"
            text={formatRecordsAsText(visibleRecords)}
          />
          {allVisibleExpanded ? (
            <button
              className="anya-result-stack-action"
              type="button"
              onClick={() => setExpanded(new Set())}
            >
              Collapse all
            </button>
          ) : (
            <button
              className="anya-result-stack-action"
              type="button"
              onClick={() => setExpanded(indexesOf(visibleRecords))}
            >
              Expand all
            </button>
          )}
        </div>
      </div>

      <div className="anya-result-list anya-result-list--grid">
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
              role={selectable ? "button" : undefined}
              tabIndex={selectable ? 0 : undefined}
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
            >
              <header className="anya-result-card-header">
                <div className="min-w-0 flex-1">
                  <p className="anya-result-card-title">{record.title}</p>
                  {record.subtitle ? (
                    <p className="anya-result-card-subtitle truncate">
                      {record.subtitle}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {record.badge && record.badge !== record.title ? (
                    <span className="anya-result-badge">{record.badge}</span>
                  ) : null}
                  <span className="anya-result-index">#{record.index}</span>
                  <ResultCopyButton compact text={formatRecordAsText(record)} />
                  <button
                    aria-expanded={isExpanded}
                    aria-label={
                      isExpanded ? "Collapse record" : "Expand record"
                    }
                    className={clsx(
                      "anya-result-expand",
                      isExpanded && "anya-result-expand--open",
                    )}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleExpanded(record.index);
                    }}
                  >
                    <ChevronDown className="size-3.5" />
                  </button>
                </div>
              </header>

              {!isExpanded ? null : (
                <div className="anya-result-card-body">
                  {record.fields.map((field) => (
                    <ResultField
                      key={`${record.index}-${field.key}`}
                      blurResults={blurResults}
                      expanded={isExpanded}
                      field={field}
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
          type="button"
          onClick={() =>
            setVisibleCount((count) =>
              Math.min(sortedRecords.length, count + PAGE_SIZE),
            )
          }
        >
          Show {Math.min(PAGE_SIZE, hiddenCount)} more record
          {Math.min(PAGE_SIZE, hiddenCount) === 1 ? "" : "s"}
        </button>
      ) : null}

      {blurResults ? <ResultsBlurNotice /> : null}
    </div>
  );
}
