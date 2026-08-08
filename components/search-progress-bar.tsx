"use client";

import { useEffect, useId, useState } from "react";
import clsx from "clsx";

const DEFAULT_STAGES = [
  "Querying indexes…",
  "Merging hits…",
  "Resolving sources…",
  "Correlating signals…",
  "Waiting on providers…",
] as const;

const STAGE_ROTATE_MS = 2600;

export type SearchProgressBarProps = {
  active: boolean;
  /** Live status from a stream/job; when empty, stages rotate. */
  status?: string | null;
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
  progress = null,
  className = "",
}: SearchProgressBarProps) {
  const labelId = useId();
  const [stageIndex, setStageIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  const hasRatio =
    typeof progress === "number" && Number.isFinite(progress) && progress >= 0;
  const ratio = hasRatio ? clampRatio(progress) : null;
  const liveStatus = typeof status === "string" ? status.trim() : "";
  const displayStatus = liveStatus || DEFAULT_STAGES[stageIndex];

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReducedMotion(mq.matches);

    apply();
    mq.addEventListener("change", apply);

    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (!active) {
      setStageIndex(0);

      return;
    }

    if (liveStatus || reducedMotion) return;

    const id = window.setInterval(() => {
      setStageIndex((i) => (i + 1) % DEFAULT_STAGES.length);
    }, STAGE_ROTATE_MS);

    return () => window.clearInterval(id);
  }, [active, liveStatus, reducedMotion]);

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
