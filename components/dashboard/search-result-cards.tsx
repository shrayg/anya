"use client";

import type { FormattedField, FormattedRecord } from "@/lib/search-utils";

import clsx from "clsx";
import { ChevronDown } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  ResultCard,
  ResultCardField,
  ResultCardList,
} from "@/components/dashboard/result-card";
import { IpIntelPanel } from "@/components/dashboard/ip-intel-panel";
import { ResultCopyButton } from "@/components/dashboard/result-copy-button";
import { SearchEmptyState } from "@/components/dashboard/search-empty-state";
import { ResultsBlurNotice } from "@/components/results-blur-notice";
import { formatRecordAsText, formatRecordsAsText } from "@/lib/export-intel";
import {
  extractIpsFromTexts,
  isIpAddress,
  isIpFieldKey,
} from "@/lib/ip-detect";
import {
  groupRecordFields,
  recordPreviewFacts,
} from "@/lib/search-utils";

/** Progressive paint only — never silently drop remaining records. */
const PAGE_SIZE = 48;
const VALUE_PREVIEW_LENGTH = 96;

function truncateValue(value: string, max = VALUE_PREVIEW_LENGTH) {
  if (value.length <= max) return value;

  return `${value.slice(0, max)}…`;
}

function indexesOf(records: FormattedRecord[]): Set<number> {
  return new Set(records.map((record) => record.index));
}

/** Stable card identity so streamed enrichments don't remount / re-pop every row. */
function cardStableKey(record: FormattedRecord): string {
  const core = record.fields
    .filter((field) =>
      /^(email|password|ip|ip_address|username|user_id|discord_id|url|site|phone)$/i.test(
        field.key,
      ),
    )
    .map((field) => `${field.key.toLowerCase()}:${field.value.toLowerCase()}`)
    .sort()
    .join("|");

  if (core) return core;

  const fromFields = record.fields.find((f) =>
    /^(import_?id|id|hash)$/i.test(f.key),
  );

  if (fromFields?.value) {
    return `${record.badge ?? ""}:${fromFields.value.slice(0, 24)}`;
  }

  return `${record.badge ?? ""}:${record.title}:${record.index}`;
}

function CompactField({
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
    <ResultCardField
      blurResults={blurResults}
      field={{
        key: field.key,
        label: field.label,
        value: displayValue,
        sensitive: field.sensitive,
        highlight: field.highlight,
        block: isBlock,
      }}
      showCopy={expanded && Boolean(field.value.trim())}
    />
  );
}

function RecordFieldsBody({
  record,
  blurResults,
  isExpanded,
}: {
  record: FormattedRecord;
  blurResults: boolean;
  isExpanded: boolean;
}) {
  const sections = useMemo(
    () => groupRecordFields(record.fields),
    [record.fields],
  );
  const previewFacts = useMemo(
    () => recordPreviewFacts(record),
    [record],
  );
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    setShowAdvanced(false);
  }, [record.index]);

  if (!isExpanded) {
    if (previewFacts.length === 0) return null;

    return (
      <div className="anya-result-preview">
        {previewFacts.map((fact) => (
          <span key={fact} className="anya-result-preview-chip">
            {fact}
          </span>
        ))}
      </div>
    );
  }

  const mainSections = sections.filter((section) => !section.advanced);
  const advancedSection = sections.find((section) => section.advanced);

  return (
    <div className="anya-result-sections">
      {mainSections.map((section) => (
        <section
          key={section.id}
          className="anya-result-section"
          aria-label={section.label}
        >
          <p className="anya-breach-group-label">{section.label}</p>
          <div className="anya-result-section-fields">
            {section.fields.map((field) => (
              <CompactField
                key={`${record.index}-${section.id}-${field.key}`}
                blurResults={blurResults}
                expanded={isExpanded}
                field={field}
              />
            ))}
          </div>
        </section>
      ))}

      {advancedSection && advancedSection.fields.length > 0 ? (
        <div className="anya-result-more">
          <button
            aria-expanded={showAdvanced}
            className={clsx(
              "anya-result-more-toggle",
              showAdvanced && "anya-result-more-toggle--open",
            )}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setShowAdvanced((open) => !open);
            }}
          >
            <span>
              {showAdvanced ? "Hide details" : "More details"}
              <span className="anya-result-more-count">
                {advancedSection.fields.length}
              </span>
            </span>
            <ChevronDown className="size-3.5" />
          </button>
          {showAdvanced ? (
            <div className="anya-result-section-fields anya-result-section-fields--advanced">
              {advancedSection.fields.map((field) => (
                <CompactField
                  key={`${record.index}-more-${field.key}`}
                  blurResults={blurResults}
                  expanded={isExpanded}
                  field={field}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
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
  /** Kept for callers; all variants render the Breaches card layout. */
  variant: _variant = "compact",
  moduleSlug = "discord-id",
  defaultExpanded = "all",
  dense = false,
}: {
  records: FormattedRecord[];
  blurResults?: boolean;
  totalCount?: number;
  selectedExportIndex?: number | null;
  onSelectExportIndex?: (index: number) => void;
  initialVisible?: number;
  emptyDetail?: string;
  /** @deprecated Always renders Breaches-style cards. */
  variant?: "auto" | "premium" | "compact";
  /** Parent module for nested IP intel auth. */
  moduleSlug?: string;
  /** How many cards start open. */
  defaultExpanded?: "all" | "first" | "none";
  /** Tighter packing for home / Discord results. */
  dense?: boolean;
}) {
  const [expanded, setExpanded] = useState<Set<number>>(() =>
    defaultExpanded === "all"
      ? indexesOf(records)
      : defaultExpanded === "first" && records[0]
        ? new Set([records[0].index])
        : new Set(),
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
    setExpanded(
      defaultExpanded === "all"
        ? indexesOf(records)
        : defaultExpanded === "first" && records[0]
          ? new Set([records[0].index])
          : new Set(),
    );
    setVisibleCount(initialVisible);
  }, [resultsKey, initialVisible, records, defaultExpanded]);

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
    <div
      className={clsx(
        "anya-result-stack",
        dense && "anya-result-stack--dense",
      )}
    >
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

      <ResultCardList
        className={dense ? "anya-result-list--dense-home" : undefined}
      >
        {visibleRecords.map((record, index) => {
          const isExpanded = expanded.has(record.index);
          const selected = selectedExportIndex === record.index;
          const stableKey = cardStableKey(record);
          const ips = extractIpsFromTexts(
            record.fields
              .filter(
                (field) =>
                  isIpFieldKey(field.key) || isIpAddress(field.value),
              )
              .map((field) => field.value),
          );

          return (
            <ResultCard
              key={stableKey}
              badge={
                record.badge && record.badge !== record.title
                  ? record.badge
                  : null
              }
              blurResults={blurResults}
              className={clsx(
                isExpanded && "anya-result-card--expanded",
                dense && "anya-result-card--dense",
                "anya-result-card--readable",
              )}
              copyText={formatRecordAsText(record)}
              footer={
                isExpanded && ips[0] ? (
                  <IpIntelPanel
                    blurResults={blurResults}
                    ip={ips[0]!}
                    moduleSlug={moduleSlug}
                  />
                ) : null
              }
              headerExtra={
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
              }
              indexLabel={record.index}
              listIndex={index}
              selectable={selectable}
              selected={selected}
              subtitle={record.subtitle}
              title={record.title}
              onSelect={
                selectable
                  ? () => onSelectExportIndex?.(selected ? -1 : record.index)
                  : undefined
              }
            >
              <RecordFieldsBody
                blurResults={blurResults}
                isExpanded={isExpanded}
                record={record}
              />
            </ResultCard>
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
                Math.min(sortedRecords.length, count + PAGE_SIZE),
              )
            }
          >
            Show {Math.min(PAGE_SIZE, hiddenCount)} more record
            {Math.min(PAGE_SIZE, hiddenCount) === 1 ? "" : "s"}
          </button>
          <button
            className="anya-result-stack-action"
            type="button"
            onClick={() => setVisibleCount(sortedRecords.length)}
          >
            Show all {sortedRecords.length.toLocaleString()}
          </button>
        </div>
      ) : null}

      {blurResults ? <ResultsBlurNotice /> : null}
    </div>
  );
}
