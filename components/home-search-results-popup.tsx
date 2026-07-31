"use client";

import { X } from "lucide-react";
import { useEffect, useId, type ReactNode } from "react";
import { createPortal } from "react-dom";

type HomeSearchResultsPopupProps = {
  open: boolean;
  title?: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
};

/**
 * Full-viewport results overlay for homepage search — pops results into view
 * instead of dumping them below the fold.
 */
export function HomeSearchResultsPopup({
  open,
  title = "Search results",
  subtitle,
  onClose,
  children,
}: HomeSearchResultsPopupProps) {
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      aria-labelledby={titleId}
      aria-describedby={subtitle ? descId : undefined}
      aria-modal="true"
      className="home-search-results-popup"
      data-tour="home-search-results-popup"
      role="dialog"
    >
      <button
        aria-label="Close search results"
        className="home-search-results-popup__backdrop"
        type="button"
        onClick={onClose}
      />
      <div className="home-search-results-popup__panel">
        <header className="home-search-results-popup__head">
          <div className="home-search-results-popup__titles">
            <h2 className="home-search-results-popup__title" id={titleId}>
              {title}
            </h2>
            {subtitle ? (
              <p className="home-search-results-popup__subtitle" id={descId}>
                {subtitle}
              </p>
            ) : null}
          </div>
          <button
            aria-label="Close"
            className="home-search-results-popup__close"
            type="button"
            onClick={onClose}
          >
            <X aria-hidden className="size-4" strokeWidth={2} />
          </button>
        </header>
        <div className="home-search-results-popup__body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
