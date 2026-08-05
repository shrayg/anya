"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { apiFetch } from "@/lib/csrf-client";
import {
  CREDIT_PACKS,
  CUSTOM_CREDIT_MAX,
  CUSTOM_CREDIT_MIN,
  CUSTOM_CREDIT_PACK_ID,
  SEARCH_UNLOCK_CREDIT_COST,
  getCreditPackTotal,
} from "@/lib/plans";
import {
  buildAuthHref,
  buildPricingCreditsHref,
} from "@/lib/search-resume";

type UnlockMeta = {
  reasons?: string[];
  creditCost?: number;
  planRequired?: string | null;
  allowCreditUnlock?: boolean;
  resultCount?: number;
};

export function SearchUnlockPanel({
  isGuest,
  vaultId,
  claimToken,
  unlock,
  balance = 0,
  onUnlocked,
  returnTo = "/#search",
}: {
  isGuest: boolean;
  vaultId?: string | null;
  claimToken?: string | null;
  unlock?: UnlockMeta | null;
  balance?: number;
  onUnlocked?: (payload: unknown) => void;
  returnTo?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showPacks, setShowPacks] = useState(false);
  const [customCredits, setCustomCredits] = useState(10);

  const creditCost = unlock?.creditCost ?? SEARCH_UNLOCK_CREDIT_COST;
  const allowCredits = unlock?.allowCreditUnlock !== false;
  const reason =
    unlock?.reasons?.[0] ||
    (isGuest
      ? "Results are hidden until you sign in."
      : "Upgrade your plan or unlock with credits to reveal full values.");

  const canUnlockWithBalance = useMemo(
    () => allowCredits && !isGuest && balance >= creditCost,
    [allowCredits, balance, creditCost, isGuest],
  );

  const authHref = buildAuthHref({
    action: "register",
    next: returnTo,
  });
  const loginHref = buildAuthHref({
    action: "login",
    next: returnTo,
  });
  const pricingHref = buildPricingCreditsHref({
    vaultId: vaultId ?? undefined,
    returnTo,
  });
  const planHref = `/pricing${vaultId ? `?vaultId=${encodeURIComponent(vaultId)}&returnTo=${encodeURIComponent(returnTo)}` : ""}`;

  const claim = async (preferCreditUnlock: boolean) => {
    if (!vaultId || !claimToken) {
      setError("Unlock session expired. Run the search again.");

      return;
    }

    setBusy(true);
    setError("");

    try {
      const res = await apiFetch("/api/search/vault/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vaultId,
          claimToken,
          preferCreditUnlock,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (data.requiresBalance) {
          setShowPacks(true);
        }

        setError(
          typeof data.error === "string"
            ? data.error
            : "Could not unlock this search.",
        );

        return;
      }

      onUnlocked?.(data.payload);
    } catch {
      setError("Could not unlock this search.");
    } finally {
      setBusy(false);
    }
  };

  const startCreditCheckout = async (packId: string, creditsAmount?: number) => {
    setBusy(true);
    setError("");

    try {
      const res = await apiFetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "credits",
          packId,
          creditsAmount,
          provider: "square",
          returnTo,
          vaultId: vaultId ?? undefined,
          intent: "unlock_search",
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(
          typeof data.error === "string"
            ? data.error
            : "Could not start credit checkout.",
        );

        return;
      }

      if (typeof data.url === "string" && data.url) {
        window.location.assign(data.url);

        return;
      }

      setError("Checkout did not return a payment URL.");
    } catch {
      setError("Could not start credit checkout.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="results-blur-notice search-unlock-panel">
      <p className="results-blur-notice-text">{reason}</p>
      {typeof unlock?.resultCount === "number" && unlock.resultCount > 0 ? (
        <p className="mt-1 text-xs text-zinc-400">
          {unlock.resultCount.toLocaleString()} result
          {unlock.resultCount === 1 ? "" : "s"} ready to unlock.
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {isGuest ? (
          <>
            <Link className="ui-btn ui-btn--accent text-sm" href={authHref}>
              Create account
            </Link>
            <Link className="ui-btn text-sm" href={loginHref}>
              Sign in
            </Link>
            <Link className="ui-btn text-sm" href={planHref}>
              View plans
            </Link>
          </>
        ) : (
          <>
            <Link className="ui-btn text-sm" href={planHref}>
              Upgrade plan
            </Link>
            {allowCredits ? (
              canUnlockWithBalance ? (
                <button
                  className="ui-btn ui-btn--accent text-sm"
                  disabled={busy}
                  type="button"
                  onClick={() => void claim(true)}
                >
                  {busy
                    ? "Unlocking…"
                    : `Unlock · ${creditCost} credit`}
                </button>
              ) : (
                <button
                  className="ui-btn ui-btn--accent text-sm"
                  disabled={busy}
                  type="button"
                  onClick={() => setShowPacks(true)}
                >
                  Buy credits to unlock
                </button>
              )
            ) : null}
          </>
        )}
      </div>

      {error ? (
        <p className="mt-2 text-sm text-amber-200">{error}</p>
      ) : null}

      {showPacks && !isGuest ? (
        <div className="mt-4 space-y-3 rounded-md border border-white/10 bg-black/20 p-3">
          <p className="text-xs text-zinc-400">
            Balance: {balance.toFixed(2)} credits · need {creditCost} to unlock.
            After purchase you return to this search — no re-run.
          </p>
          <div className="flex flex-wrap gap-2">
            {CREDIT_PACKS.map((pack) => (
              <button
                key={pack.id}
                className="ui-btn text-sm"
                disabled={busy}
                type="button"
                onClick={() => void startCreditCheckout(pack.id)}
              >
                {pack.name} · {getCreditPackTotal(pack)} credits
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs text-zinc-400">
              Custom
              <input
                className="ui-input ml-2 w-20"
                max={CUSTOM_CREDIT_MAX}
                min={CUSTOM_CREDIT_MIN}
                type="number"
                value={customCredits}
                onChange={(event) =>
                  setCustomCredits(Number(event.target.value) || CUSTOM_CREDIT_MIN)
                }
              />
            </label>
            <button
              className="ui-btn text-sm"
              disabled={busy}
              type="button"
              onClick={() =>
                void startCreditCheckout(CUSTOM_CREDIT_PACK_ID, customCredits)
              }
            >
              Buy custom
            </button>
            <Link className="text-xs text-anya-accent underline" href={pricingHref}>
              Full pricing
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
