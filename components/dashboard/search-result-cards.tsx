"use client";

import type { FormattedField, FormattedRecord } from "@/lib/search-utils";

import clsx from "clsx";
import { ChevronDown, Database, Shield } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { BlurredValue } from "@/components/dashboard/blurred-value";
import { ResultCopyButton } from "@/components/dashboard/result-copy-button";
import { SearchEmptyState } from "@/components/dashboard/search-empty-state";
import { ResultsBlurNotice } from "@/components/results-blur-notice";
import { formatRecordAsText, formatRecordsAsText } from "@/lib/export-intel";

const PAGE_SIZE = 12;
const VALUE_PREVIEW_LENGTH = 72;
const META_FIELD_KEYS = new Set([
  "import_id",
  "importid",
  "indexed_at",
  "indexedat",
  "added_at",
  "date",
  "breach_date",
]);

function truncateValue(value: string, max = VALUE_PREVIEW_LENGTH) {
  if (value.length <= max) return value;

  return `${value.slice(0, max)}…`;
}

function indexesOf(records: FormattedRecord[]): Set<number> {
  return new Set(records.map((record) => record.index));
}

function recordId(record: FormattedRecord): string {
  const fromFields = record.fields.find((f) =>
    /^(import_?id|id|hash)$/i.test(f.key),
  );

  if (fromFields?.value) return fromFields.value.slice(0, 24);

  const seed = `${record.title}:${record.subtitle ?? ""}:${record.index}`;
  let hash = 0;

  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }

  return hash.toString(16).padStart(10, "0").slice(0, 20);
}

function ResultField({
  field,
  blurResults,
  expanded,
  premium,
}: {
  field: FormattedField;
  blurResults: boolean;
  expanded: boolean;
  premium?: boolean;
}) {
  const isBlock = Boolean(field.block);
  const isMeta = META_FIELD_KEYS.has(field.key.toLowerCase());
  const displayValue =
    expanded || isBlock ? field.value : truncateValue(field.value);

  if (premium) {
    return (
      <div
        className={clsx(
          "anya-breach-field",
          field.sensitive && "anya-breach-field--sensitive",
          isMeta && "anya-breach-field--meta",
          isBlock && "col-span-full",
        )}
        title={
          !isBlock && field.value.length > VALUE_PREVIEW_LENGTH
            ? field.value
            : undefined
        }
      >
        <span className="anya-breach-field-label">{field.label}</span>
        <div className="anya-breach-value-box">
          <BlurredValue forceBlur={blurResults} text={displayValue} />
        </div>
      </div>
    );
  }

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
  variant = "auto",
}: {
  records: FormattedRecord[];
  blurResults?: boolean;
  totalCount?: number;
  selectedExportIndex?: number | null;
  onSelectExportIndex?: (index: number) => void;
  initialVisible?: number;
  emptyDetail?: string;
  /** auto = premium breach layout when fields look like leak rows */
  variant?: "auto" | "premium" | "compact";
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

  const usePremium =
    variant === "premium" ||
    (variant === "auto" &&
      records.some((r) =>
        r.fields.some((f) =>
          /^(email|password|dbname|database|username)$/i.test(f.key),
        ),
      ));

  useEffect(() => {
    setExpanded(indexesOf(records));
    setVisibleCount(initialVisible);
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
          const id = recordId(record);
          const sourceName = record.badge ?? record.title;

          if (usePremium) {
            return (
              <article
                key={`${record.index}-${record.title}`}
                className={clsx(
                  "anya-breach-card",
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
                <header className="anya-breach-card-head">
                  <div className="anya-breach-card-head-main">
                    <span className="anya-breach-badge">
                      <Shield className="size-3" />
                      Breach
                    </span>
                    <span className="anya-breach-id">{id}</span>
                    <ResultCopyButton compact text={id} />
                  </div>
                  <div className="anya-breach-source">
                    <span className="anya-breach-source-icon">
                      <Database className="size-3.5" />
                    </span>
                    <span className="anya-breach-source-name" title={sourceName}>
                      {sourceName}
                    </span>
                  </div>
                </header>
                <div className="anya-breach-fields">
                  {record.fields.map((field) => (
                    <ResultField
                      key={`${record.index}-${field.key}`}
                      blurResults={blurResults}
                      expanded
                      field={field}
                      premium
                    />
                  ))}
                </div>
              </article>
            );
          }

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
