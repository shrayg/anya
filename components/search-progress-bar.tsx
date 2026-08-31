"use client";

import { useEffect, useId, useState } from "react";
import clsx from "clsx";

const SEARCHING_COPY = "Searching sources...";
const ENRICHING_COPY = "Loading more sources...";
const FIRST_HIT_COPY = "First results ready";

export type SearchProgressBarProps = {
  active: boolean;
  status?: string | null;
  hasResults?: boolean;
  /**
   * 0-1 when tied to stream partials.
   * Stage 1 climbs toward first paint; stage 2 tracks remaining modules.
   */
  progress?: number | null;
  className?: string;
};

function clampRatio(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function resolveStageProgress(
  hasResults: boolean,
  ratio: number | null,
): { find: number; enrich: number; percent: number } {
  if (!hasResults) {
    const find = ratio == null ? 0.22 : clampRatio(Math.min(ratio, 0.96));
    return {
      find,
      enrich: 0,
      percent: Math.round(find * 100),
    };
  }

  const enrich = ratio == null ? 0.18 : clampRatio(ratio);
  return {
    find: 1,
    enrich,
    percent: Math.round(enrich * 100),
  };
}

/** Two-stage search progress shown below the search composer. */
export function SearchProgressBar({
  active,
  status = null,
  hasResults = false,
  progress = null,
  className = "",
}: SearchProgressBarProps) {
  const labelId = useId();
  const [pulse, setPulse] = useState(0.18);

  useEffect(() => {
    if (!active || progress != null) return;

    const id = window.setInterval(() => {
      setPulse((current) => (current >= 0.34 ? 0.14 : current + 0.04));
    }, 420);

    return () => window.clearInterval(id);
  }, [active, progress]);

  if (!active) return null;

  const hasRatio =
    typeof progress === "number" && Number.isFinite(progress) && progress >= 0;
  const ratio = hasRatio ? clampRatio(progress) : null;
  const liveStatus = typeof status === "string" ? status.trim() : "";
  const phase = hasResults ? "enriching" : "searching";

  const stage = resolveStageProgress(hasResults, ratio ?? (progress == null ? pulse : null));
  const barFill = hasResults ? stage.enrich : stage.find;

  const displayStatus = hasResults
    ? liveStatus || ENRICHING_COPY
    : liveStatus || SEARCHING_COPY;

  const statusLine =
    hasResults && stage.enrich >= 0.99 && !liveStatus
      ? FIRST_HIT_COPY
      : displayStatus;

  return (
    <div
      aria-busy="true"
      aria-labelledby={labelId}
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={stage.percent}
      className={clsx(
        "search-progress",
        `search-progress--${phase}`,
        className,
      )}
      data-phase={phase}
      role="progressbar"
    >
      <div aria-hidden className="search-progress__rail">
        <div
          className={clsx(
            "search-progress__step",
            !hasResults && "search-progress__step--active",
            hasResults && "search-progress__step--done",
          )}
        >
          <span className="search-progress__step-meta">
            {hasResults ? "01 / done" : "01 / active"}
          </span>
          <strong>Find</strong>
        </div>
        <div
          className={clsx(
            "search-progress__step",
            hasResults && "search-progress__step--active",
            !hasResults && "search-progress__step--idle",
          )}
        >
          <span className="search-progress__step-meta">
            {hasResults ? "02 / active" : "02 / queued"}
          </span>
          <strong>Enrich</strong>
        </div>
      </div>

      <div aria-hidden className="search-progress__track">
        <div
          className={clsx(
            "search-progress__fill",
            ratio == null && !hasResults && "search-progress__fill--pulse",
          )}
          style={{ width: `${Math.max(6, Math.round(barFill * 100))}%` }}
        />
      </div>

      <div className="search-progress__footer">
        <p className="search-progress__status" id={labelId}>
          <span aria-hidden className="search-progress__status-mark" />
          {statusLine}
        </p>
        <p aria-hidden className="search-progress__percent">
          {stage.percent}
          <span>%</span>
        </p>
      </div>
    </div>
  );
}
