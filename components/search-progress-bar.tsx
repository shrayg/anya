"use client";

import { useId } from "react";
import clsx from "clsx";

const SEARCHING_COPY = "Searching…";
const STILL_SEARCHING_COPY =
  "Still searching while you check your results…";

export type SearchProgressBarProps = {
  active: boolean;
  /** Live status from a stream/job; ignored when `hasResults` is true. */
  status?: string | null;
  /**
   * When partial/final results are already on screen, prefer calm copy
   * instead of provider names or rotating stage lines.
   */
  hasResults?: boolean;
  /**
   * 0–1 when tied to stream partials (`done/total`).
   * Omit / null for an indeterminate pulse — never invent precise %.
   */
  progress?: number | null;
  className?: string;
};

function clampRatio(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/**
 * Slim ice-blue search progress under the composer.
 * Determinate when stream partials expose done/total; otherwise indeterminate.
 */
export function SearchProgressBar({
  active,
  status = null,
  hasResults = false,
  progress = null,
  className = "",
}: SearchProgressBarProps) {
  const labelId = useId();

  const hasRatio =
    typeof progress === "number" && Number.isFinite(progress) && progress >= 0;
  const ratio = hasRatio ? clampRatio(progress) : null;
  const liveStatus = typeof status === "string" ? status.trim() : "";
  const displayStatus = hasResults
    ? STILL_SEARCHING_COPY
    : liveStatus || SEARCHING_COPY;

  if (!active) return null;

  return (
    <div
      aria-busy="true"
      aria-labelledby={labelId}
      className={clsx("search-progress", className)}
      role="status"
    >
      <div
        aria-hidden
        className={clsx(
          "search-progress__track",
          ratio == null && "search-progress__track--indeterminate",
        )}
      >
        <div
          className={clsx(
            "search-progress__fill",
            ratio == null && "search-progress__fill--pulse",
          )}
          style={
            ratio != null
              ? { width: `${Math.max(6, Math.round(ratio * 100))}%` }
              : undefined
          }
        />
      </div>
      <p className="search-progress__status" id={labelId}>
        {displayStatus}
      </p>
    </div>
  );
}
