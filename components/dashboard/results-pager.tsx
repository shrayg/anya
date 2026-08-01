"use client";

type ResultsPagerProps = {
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  className?: string;
};

/** Shared Prev / Next controls for ~10-per-page result lists. */
export function ResultsPager({
  page,
  pageCount,
  pageSize,
  total,
  onPrev,
  onNext,
  className,
}: ResultsPagerProps) {
  if (pageCount <= 1) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div
      className={
        className ? `anya-results-pager ${className}` : "anya-results-pager"
      }
    >
      <p className="anya-results-pager-meta">
        {start.toLocaleString()}–{end.toLocaleString()} of{" "}
        {total.toLocaleString()} · Page {page} of {pageCount}
      </p>
      <div className="anya-results-pager-actions">
        <button
          className="anya-results-pager-btn"
          disabled={page <= 1}
          type="button"
          onClick={onPrev}
        >
          Previous
        </button>
        <button
          className="anya-results-pager-btn"
          disabled={page >= pageCount}
          type="button"
          onClick={onNext}
        >
          Next
        </button>
      </div>
    </div>
  );
}

export const RESULTS_PAGE_SIZE = 10;
