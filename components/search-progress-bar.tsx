"use client";

import { useId } from "react";
import clsx from "clsx";

const SEARCHING_COPY = "Searching�";
const FIRST_HIT_COPY = "First results ready";
const ENRICHING_COPY = "Loading more sources�";

export type SearchProgressBarProps = {
  active: boolean;
  status?: string | null;
  hasResults?: boolean;
  /**
   * 0�1 when tied to stream partials.
   * Stage 1 snaps to 1 on first results; stage 2 uses remaining module progress.
   */
  progress?: number | null;
  className?: string;
};

function clampRatio(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/**
 * Bright search progress under the composer (not inside the glass card).
 * Stage 1 fills to 100% on first useful result; stage 2 continues for more sources.
 */
export function SearchProgressBar({
  active,
  status = null,
  hasResults = false,
  progress = null,
  className = "",
}: SearchProgressBarProps) {
  const labelId = useId();

  if (!active) return null;

  const hasRatio =
    typeof progress === "number" && Number.isFinite(progress) && progress >= 0;
  const ratio = hasRatio ? clampRatio(progress) : null;
  const liveStatus = typeof status === "string" ? status.trim() : "";
  const phase = hasResults ? "enriching" : "searching";
  const displayStatus = hasResults
    ? liveStatus || ENRICHING_COPY
    : liveStatus || SEARCHING_COPY;
  const fillRatio = hasResults
    ? ratio == null
      ? null
      : Math.max(0.12, ratio)
    : ratio == null
      ? null
      : Math.max(0.08, Math.min(ratio, 0.92));

  return (
    <div
      aria-busy="true"
      aria-labelledby={labelId}
      className={clsx(
        "search-progress",
        `search-progress--${phase}`,
        className,
      )}
      data-phase={phase}
      role="status"
    >
      <div className="search-progress__stages" aria-hidden>
        <span
          className={clsx(
            "search-progress__stage",
            !hasResults && "search-progress__stage--active",
            hasResults && "search-progress__stage--done",
          )}
        >
          1 � Find
        </span>
        <span
          className={clsx(
            "search-progress__stage",
            hasResults && "search-progress__stage--active",
          )}
        >
          2 � Enrich
        </span>
      </div>

      <div
        className={clsx(
          "search-progress__track",
          fillRatio == null
            ? "search-progress__track--indeterminate"
            : "search-progress__track--determinate",
        )}
      >
        <div
          className={clsx(
            "search-progress__fill",
            fillRatio == null && "search-progress__fill--indeterminate",
            hasResults && "search-progress__fill--enriching",
          )}
          style={
            fillRatio != null
              ? { width: `${Math.round(fillRatio * 100)}%` }
              : undefined
          }
        />
        <span className="search-progress__glint" />
      </div>

      <p className="search-progress__status" id={labelId}>
        {hasResults && fillRatio != null && fillRatio >= 0.99
          ? FIRST_HIT_COPY
          : displayStatus}
      </p>
    </div>
  );
}
