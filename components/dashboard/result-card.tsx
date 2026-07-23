"use client";

import clsx from "clsx";
import {
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { BlurredValue } from "@/components/dashboard/blurred-value";
import { ResultCopyButton } from "@/components/dashboard/result-copy-button";

/** First-row pop count (matches 3-col desktop grid). */
export const RESULT_POP_COUNT = 3;

export function resultPopClass(listIndex: number): string | false {
  return listIndex < RESULT_POP_COUNT && "anya-pop-in";
}

export function resultPopStyle(listIndex: number): CSSProperties | undefined {
  if (listIndex >= RESULT_POP_COUNT) return undefined;

  return { "--pop-i": listIndex } as CSSProperties;
}

export type ResultCardFieldDef = {
  key: string;
  label: string;
  value: string;
  sensitive?: boolean;
  highlight?: boolean;
  block?: boolean;
};

export function ResultCardField({
  field,
  blurResults = false,
  showCopy = true,
}: {
  field: ResultCardFieldDef;
  blurResults?: boolean;
  showCopy?: boolean;
}) {
  return (
    <div
      className={clsx(
        "anya-result-field",
        field.sensitive && "anya-result-field--sensitive",
        field.block && "anya-result-field--block",
      )}
    >
      <p className="anya-result-label">{field.label}</p>
      <div className="anya-result-field-row">
        <p
          className={clsx(
            "anya-result-value",
            field.block && "anya-result-value--block",
            field.highlight && "text-anya-accent",
          )}
        >
          <BlurredValue forceBlur={blurResults} text={field.value} />
        </p>
        {showCopy && field.value.trim() ? (
          <ResultCopyButton compact text={field.value} />
        ) : null}
      </div>
    </div>
  );
}

export function ResultCard({
  title,
  subtitle,
  indexLabel,
  badge,
  fields,
  blurResults = false,
  selectable = false,
  selected = false,
  onSelect,
  copyText,
  listIndex = 0,
  headerExtra,
  children,
  className,
  footer,
}: {
  title: string;
  subtitle?: string | null;
  indexLabel?: string | number;
  badge?: string | null;
  fields?: ResultCardFieldDef[];
  blurResults?: boolean;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: () => void;
  copyText?: string;
  /** 0-based position in the visible list — drives first-row pop. */
  listIndex?: number;
  headerExtra?: ReactNode;
  children?: ReactNode;
  className?: string;
  footer?: ReactNode;
}) {
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!selectable || !onSelect) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect();
    }
  };

  return (
    <article
      className={clsx(
        "anya-result-card",
        resultPopClass(listIndex),
        selectable && "anya-result-card--selectable",
        selected && "anya-result-card--selected",
        className,
      )}
      style={resultPopStyle(listIndex)}
      role={selectable ? "button" : undefined}
      tabIndex={selectable ? 0 : undefined}
      onClick={selectable ? onSelect : undefined}
      onKeyDown={selectable ? handleKeyDown : undefined}
    >
      <header className="anya-result-card-header">
        <div className="min-w-0 flex-1">
          <p className="anya-result-card-title">{title}</p>
          {subtitle ? (
            <p className="anya-result-card-subtitle truncate">{subtitle}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {badge ? <span className="anya-result-badge">{badge}</span> : null}
          {indexLabel != null ? (
            <span className="anya-result-index">#{indexLabel}</span>
          ) : null}
          {copyText ? <ResultCopyButton compact text={copyText} /> : null}
          {headerExtra}
        </div>
      </header>
      {children ? (
        <div className="anya-result-card-body">{children}</div>
      ) : fields && fields.length > 0 ? (
        <div className="anya-result-card-body">
          {fields.map((field) => (
            <ResultCardField
              key={`${field.key}-${field.value}`}
              blurResults={blurResults}
              field={field}
            />
          ))}
        </div>
      ) : null}
      {footer}
    </article>
  );
}

export function ResultCardList({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx("anya-result-list anya-result-list--grid", className)}>
      {children}
    </div>
  );
}

export function ResultStatStrip({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="anya-result-strip">
      <p className="anya-result-label">{label}</p>
      <p className="anya-result-value">{value}</p>
    </div>
  );
}
