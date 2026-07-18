type SearchEmptyStateProps = {
  title?: string;
  detail?: string;
  className?: string;
};

/** Friendly zero-hit state for shared search flows. */
export function SearchEmptyState({
  title = "Nothing found",
  detail = "No results were found.",
  className,
}: SearchEmptyStateProps) {
  return (
    <div
      className={["anya-search-empty", className].filter(Boolean).join(" ")}
      role="status"
    >
      <p className="anya-search-empty-title">{title}</p>
      <p className="anya-search-empty-detail">{detail}</p>
    </div>
  );
}
