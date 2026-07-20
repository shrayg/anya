"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";

import {
  resolveSearchTourTarget,
  type SearchTourStep,
} from "@/lib/search-tour";

type SpotlightRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

type TooltipPlacement = {
  top: number;
  left: number;
};

const PADDING = 8;
const TOOLTIP_WIDTH = 360;

function measureSpotlight(element: Element): SpotlightRect {
  const rect = element.getBoundingClientRect();

  return {
    top: Math.max(8, rect.top - PADDING),
    left: Math.max(8, rect.left - PADDING),
    width: rect.width + PADDING * 2,
    height: rect.height + PADDING * 2,
  };
}

function measureTooltip(
  spotlight: SpotlightRect | null,
  centered: boolean,
): TooltipPlacement {
  if (centered || !spotlight) {
    return {
      top: Math.max(24, window.innerHeight / 2 - 140),
      left: Math.max(16, (window.innerWidth - TOOLTIP_WIDTH) / 2),
    };
  }

  let top = spotlight.top + spotlight.height + 16;
  let left = Math.min(
    Math.max(16, spotlight.left),
    window.innerWidth - TOOLTIP_WIDTH - 16,
  );

  if (top + 220 > window.innerHeight) {
    top = Math.max(16, spotlight.top - 220);
  }

  if (left + TOOLTIP_WIDTH > window.innerWidth - 16) {
    left = window.innerWidth - TOOLTIP_WIDTH - 16;
  }

  return { top, left };
}

export function SearchBarTour({
  steps,
  storageKey,
  enabled = true,
  ariaLabel = "Search bar guide",
}: {
  steps: SearchTourStep[];
  storageKey: string;
  enabled?: boolean;
  ariaLabel?: string;
}) {
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null);
  const [tooltip, setTooltip] = useState<TooltipPlacement>({ top: 0, left: 0 });

  const step = steps[stepIndex];
  const isCentered = !step?.target;

  const finishTour = useCallback(() => {
    try {
      localStorage.setItem(storageKey, "done");
    } catch {
      // ignore
    }
    setActive(false);
  }, [storageKey]);

  const updateLayout = useCallback(() => {
    if (!active || !step) return;

    if (isCentered) {
      setSpotlight(null);
      setTooltip(measureTooltip(null, true));

      return;
    }

    const target = resolveSearchTourTarget(step);

    if (!target) {
      setSpotlight(null);
      setTooltip(measureTooltip(null, true));

      return;
    }

    target.scrollIntoView({ block: "nearest", behavior: "smooth" });
    const nextSpotlight = measureSpotlight(target);

    setSpotlight(nextSpotlight);
    setTooltip(measureTooltip(nextSpotlight, false));
  }, [active, isCentered, step]);

  useEffect(() => {
    if (!enabled) return;

    try {
      if (localStorage.getItem(storageKey) === "done") {
        return;
      }
    } catch {
      // show tour if storage unavailable
    }

    const timer = window.setTimeout(() => setActive(true), 400);

    return () => window.clearTimeout(timer);
  }, [enabled, storageKey]);

  useLayoutEffect(() => {
    updateLayout();
  }, [updateLayout, stepIndex, active]);

  useEffect(() => {
    if (!active) return;

    const onChange = () => updateLayout();

    window.addEventListener("resize", onChange);
    window.addEventListener("scroll", onChange, true);

    return () => {
      window.removeEventListener("resize", onChange);
      window.removeEventListener("scroll", onChange, true);
    };
  }, [active, updateLayout]);

  const goNext = () => {
    if (stepIndex >= steps.length - 1) {
      finishTour();

      return;
    }
    setStepIndex((current) => current + 1);
  };

  if (!active || !step || !enabled) return null;

  return (
    <div
      aria-label={ariaLabel}
      aria-modal="true"
      className="dashboard-tour search-bar-tour"
      role="dialog"
    >
      {!spotlight ? (
        <div
          aria-hidden
          className="dashboard-tour-backdrop"
          onClick={finishTour}
        />
      ) : null}

      {spotlight ? (
        <div
          className="dashboard-tour-spotlight"
          style={{
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
          }}
        />
      ) : null}

      <TourCard
        step={step}
        stepIndex={stepIndex}
        style={{ top: tooltip.top, left: tooltip.left }}
        totalSteps={steps.length}
        onFinish={finishTour}
        onNext={goNext}
      />
    </div>
  );
}

function TourCard({
  step,
  stepIndex,
  totalSteps,
  onNext,
  onFinish,
  style,
}: {
  step: SearchTourStep;
  stepIndex: number;
  totalSteps: number;
  onNext: () => void;
  onFinish: () => void;
  style: TooltipPlacement;
}) {
  const isLast = stepIndex >= totalSteps - 1;

  return (
    <div
      className="dashboard-tour-card search-bar-tour-card"
      style={{ ...style, width: `min(${TOOLTIP_WIDTH}px, calc(100vw - 2rem))` }}
    >
      <div aria-hidden className="dashboard-tour-progress">
        {Array.from({ length: totalSteps }).map((_, index) => (
          <span
            key={index}
            className={
              index === stepIndex
                ? "dashboard-tour-dot dashboard-tour-dot--active"
                : index < stepIndex
                  ? "dashboard-tour-dot dashboard-tour-dot--done"
                  : "dashboard-tour-dot"
            }
          />
        ))}
      </div>

      <p className="search-bar-tour-step-label">
        Step {stepIndex + 1} of {totalSteps}
      </p>
      <h2 className="dashboard-tour-title search-bar-tour-title">
        {step.title}
      </h2>
      <p className="dashboard-tour-body search-bar-tour-body">{step.body}</p>

      <div className="dashboard-tour-actions">
        <button
          className="dashboard-tour-skip"
          type="button"
          onClick={onFinish}
        >
          Skip
        </button>
        <button
          className="dashboard-tour-next search-bar-tour-next"
          type="button"
          onClick={onNext}
        >
          {isLast ? "Done" : "Next"}
        </button>
      </div>
    </div>
  );
}

export function resetSearchBarTour(storageKey: string) {
  try {
    localStorage.removeItem(storageKey);
  } catch {
    // ignore
  }
}
