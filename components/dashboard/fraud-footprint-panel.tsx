"use client";

import { Loader2, ShieldAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  ResultCard,
  ResultCardList,
} from "@/components/dashboard/result-card";
import { normalizeEmail } from "@/lib/proxynova-comb";
import {
  formatStructuredSearchData,
  type FormattedRecord,
} from "@/lib/search-utils";

type PanelState =
  | { status: "skipped" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: Record<string, unknown> };

/**
 * Breaches companion — Fraud Footprint (SEON email) for email queries only.
 * Gated as `fraud-footprint` via seon-email (do not pass moduleSlug=breaches).
 */
export function FraudFootprintPanel({
  query,
  blurResults = false,
}: {
  query: string;
  blurResults?: boolean;
}) {
  const email = useMemo(() => normalizeEmail(query), [query]);
  const [state, setState] = useState<PanelState>(() =>
    email ? { status: "loading" } : { status: "skipped" },
  );

  useEffect(() => {
    if (!email) {
      setState({ status: "skipped" });

      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    setState({ status: "loading" });

    void (async () => {
      try {
        const res = await fetch(
          `/api/osint/seon-email?query=${encodeURIComponent(email)}`,
          {
            signal: controller.signal,
            credentials: "include",
            cache: "no-store",
          },
        );
        const json = (await res.json().catch(() => null)) as
          | Record<string, unknown>
          | null;

        if (cancelled) return;

        if (!res.ok || !json || typeof json !== "object") {
          const raw =
            (typeof json?.error === "string" && json.error) ||
            (typeof json?.message === "string" && json.message) ||
            "";
          const message =
            res.status === 401
              ? "Sign in with Professional or higher to run Fraud Footprint."
              : res.status === 403
                ? raw ||
                  "Fraud Footprint requires Professional or higher."
                : raw || "Fraud Footprint returned no findings.";

          setState({
            status: "error",
            message,
          });

          return;
        }

        setState({ status: "ready", data: json });
      } catch (err) {
        if (
          cancelled ||
          (err instanceof DOMException && err.name === "AbortError")
        ) {
          return;
        }

        setState({
          status: "error",
          message: "Fraud Footprint lookup failed.",
        });
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [email]);

  const cards = useMemo((): FormattedRecord[] => {
    if (state.status !== "ready") return [];

    const payload = state.data;
    const results = Array.isArray(payload.results) ? payload.results : null;

    if (results && results.length > 0) {
      return formatStructuredSearchData(results).slice(0, 24);
    }

    return formatStructuredSearchData(payload).slice(0, 24);
  }, [state]);

  if (state.status === "skipped") return null;

  return (
    <aside className="anya-breaches-side-panel anya-breaches-side-panel--companion">
      <div className="anya-breaches-side-panel-head">
        <p className="anya-breaches-side-panel-title">
          <ShieldAlert className="size-3.5" />
          Fraud Footprint
        </p>
        {email ? (
          <span className="anya-breaches-side-panel-meta">
            {blurResults ? "••••••••" : email}
          </span>
        ) : null}
      </div>

      {state.status === "loading" ? (
        <p className="anya-breaches-side-panel-status">
          <Loader2 className="size-3.5 animate-spin" />
          Checking email fraud signals…
        </p>
      ) : null}

      {state.status === "error" ? (
        <p className="anya-breaches-side-panel-empty">{state.message}</p>
      ) : null}

      {state.status === "ready" && cards.length === 0 ? (
        <p className="anya-breaches-side-panel-empty">
          No fraud footprint findings for this email.
        </p>
      ) : null}

      {state.status === "ready" && cards.length > 0 ? (
        <ResultCardList className="anya-result-list--analyzer">
          {cards.map((record, cardIndex) => (
            <ResultCard
              key={`${record.index}-${record.title}-${cardIndex}`}
              badge={record.badge ?? "SEON"}
              blurResults={blurResults}
              className="anya-result-card--dense"
              fields={record.fields.map((field) => ({
                key: field.key,
                label: field.label,
                value: field.value,
                sensitive: field.sensitive,
                highlight: field.highlight,
                block: field.block,
              }))}
              indexLabel={record.index}
              listIndex={cardIndex}
              subtitle={record.subtitle}
              title={record.title}
            />
          ))}
        </ResultCardList>
      ) : null}
    </aside>
  );
}
