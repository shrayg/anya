import Link from "next/link";

import { SearchUnlockPanel } from "@/components/search-unlock-panel";

export function ResultsBlurNotice({
  isGuest = false,
  vaultId,
  claimToken,
  unlock,
  balance = 0,
  onUnlocked,
  returnTo = "/#search",
}: {
  isGuest?: boolean;
  vaultId?: string | null;
  claimToken?: string | null;
  unlock?: {
    reasons?: string[];
    creditCost?: number;
    planRequired?: string | null;
    allowCreditUnlock?: boolean;
    resultCount?: number;
  } | null;
  balance?: number;
  onUnlocked?: (payload: unknown) => void;
  returnTo?: string;
}) {
  if (vaultId && claimToken) {
    return (
      <SearchUnlockPanel
        balance={balance}
        claimToken={claimToken}
        isGuest={isGuest}
        unlock={unlock}
        vaultId={vaultId}
        onUnlocked={onUnlocked}
        returnTo={returnTo}
      />
    );
  }

  if (isGuest) {
    return (
      <p className="results-blur-notice">
        <span className="results-blur-notice-text">
          Results are blurred.{" "}
          <Link
            className="results-blur-notice-link"
            href={`/auth?action=register&next=${encodeURIComponent(returnTo)}`}
          >
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
        or unlock with credits to reveal full values.
      </span>
    </p>
  );
}
