import Link from "next/link";

export function ResultsBlurNotice({
  isGuest = false,
}: {
  isGuest?: boolean;
}) {
  if (isGuest) {
    return (
      <p className="results-blur-notice">
        <span className="results-blur-notice-text">
          Results are blurred.{" "}
          <Link className="results-blur-notice-link" href="/auth?action=register">
            Create an account
          </Link>{" "}
          and{" "}
          <Link className="results-blur-notice-link" href="/pricing">
            buy a plan
          </Link>{" "}
          to reveal full values.
        </span>
      </p>
    );
  }

  return (
    <p className="results-blur-notice">
      <span className="results-blur-notice-text">
        Free plan results are blurred.{" "}
        <Link className="results-blur-notice-link" href="/pricing">
          Buy a plan
        </Link>{" "}
        to reveal full values.
      </span>
    </p>
  );
}
