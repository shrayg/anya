import Link from "next/link";

export function ResultsBlurNotice() {
  return (
    <p className="results-blur-notice">
      <span className="results-blur-notice-text">
        Free plan results are blurred.{" "}
        <Link className="results-blur-notice-link" href="/pricing">
          Upgrade
        </Link>{" "}
        to reveal full values.
      </span>
    </p>
  );
}
