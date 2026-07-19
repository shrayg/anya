"use client";

import clsx from "clsx";
import {
  AlertTriangle,
  CheckCircle2,
  Headphones,
  Loader2,
  RefreshCw,
  XCircle,
} from "lucide-react";
import NextLink from "next/link";

export type BillingStatusKind = "success" | "cancelled" | "pending" | "error";

type BillingStatusBannerProps = {
  kind: BillingStatusKind;
  className?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
};

const COPY: Record<
  BillingStatusKind,
  { title: string; body: string; showSupport: boolean; showRefresh: boolean }
> = {
  success: {
    title: "Payment confirmed",
    body: "Your plan or credits are active. You can open the workspace whenever you’re ready.",
    showSupport: false,
    showRefresh: false,
  },
  cancelled: {
    title: "Checkout cancelled",
    body: "No charge was made. Pick a plan below whenever you want to continue.",
    showSupport: false,
    showRefresh: false,
  },
  pending: {
    title: "Confirming crypto payment",
    body: "We’re watching the chain for confirmation. Access unlocks automatically once the payment settles — usually within a few minutes.",
    showSupport: true,
    showRefresh: true,
  },
  error: {
    title: "Payment confirmation failed",
    body: "Something went wrong while verifying checkout. If you were charged, contact support with your username and payment time.",
    showSupport: true,
    showRefresh: false,
  },
};

function StatusIcon({ kind }: { kind: BillingStatusKind }) {
  const className = "size-5";
  switch (kind) {
    case "pending":
      return <Loader2 className={clsx(className, "animate-spin text-emerald-300")} />;
    case "success":
      return <CheckCircle2 className={clsx(className, "text-emerald-300")} />;
    case "cancelled":
      return <XCircle className={clsx(className, "text-zinc-400")} />;
    case "error":
      return <AlertTriangle className={clsx(className, "text-rose-300")} />;
  }
}

export function BillingStatusBanner({
  kind,
  className,
  onRefresh,
  refreshing = false,
}: BillingStatusBannerProps) {
  const copy = COPY[kind];

  const shell =
    kind === "error"
      ? "border-rose-400/25 from-rose-500/15 via-rose-500/[0.06] to-transparent shadow-rose-500/10"
      : kind === "cancelled"
        ? "border-white/10 from-white/[0.07] via-white/[0.03] to-transparent shadow-black/20"
        : "border-emerald-400/25 from-emerald-500/15 via-emerald-500/[0.06] to-transparent shadow-emerald-500/15";

  const glow =
    kind === "error"
      ? "bg-rose-400/20"
      : kind === "cancelled"
        ? "bg-white/10"
        : "bg-emerald-400/25";

  return (
    <div
      className={clsx(
        "relative mt-6 overflow-hidden rounded-2xl border bg-gradient-to-br p-px shadow-lg",
        shell,
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="relative rounded-[15px] bg-zinc-950/80 px-5 py-4 backdrop-blur-xl sm:px-6 sm:py-5">
        <div
          aria-hidden
          className={clsx(
            "pointer-events-none absolute -right-10 -top-10 size-36 rounded-full blur-3xl",
            glow,
          )}
        />
        {kind === "pending" ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/70 to-transparent"
          />
        ) : null}

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3.5">
            <div
              className={clsx(
                "mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl border",
                kind === "error"
                  ? "border-rose-400/30 bg-rose-500/10"
                  : kind === "cancelled"
                    ? "border-white/10 bg-white/5"
                    : "border-emerald-400/30 bg-emerald-500/10",
              )}
            >
              <StatusIcon kind={kind} />
            </div>
            <div className="min-w-0 space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Payment status
              </p>
              <h3 className="text-base font-semibold tracking-tight text-white sm:text-lg">
                {copy.title}
              </h3>
              <p className="max-w-xl text-sm leading-6 text-zinc-400">{copy.body}</p>
            </div>
          </div>

          {(copy.showRefresh || copy.showSupport) && (
            <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
              {copy.showRefresh ? (
                <button
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/12 bg-white/[0.06] px-3.5 text-sm font-medium text-zinc-200 transition hover:border-white/20 hover:bg-white/[0.1] hover:text-white disabled:opacity-60"
                  disabled={refreshing}
                  onClick={() => {
                    if (onRefresh) onRefresh();
                    else window.location.reload();
                  }}
                  type="button"
                >
                  <RefreshCw
                    className={clsx("size-3.5", refreshing && "animate-spin")}
                  />
                  {refreshing ? "Checking…" : "Refresh"}
                </button>
              ) : null}
              {copy.showSupport ? (
                <NextLink
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-indigo-300/35 bg-indigo-500 px-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:bg-indigo-400"
                  href="/support"
                >
                  <Headphones className="size-3.5" />
                  Contact support
                </NextLink>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function billingStatusFromQuery(
  status: string | null,
): BillingStatusKind | null {
  switch (status) {
    case "success":
    case "cancelled":
    case "pending":
    case "error":
      return status;
    default:
      return null;
  }
}
