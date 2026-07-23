"use client";

import { Loader2, MailSearch } from "lucide-react";
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

type AnalyzerState =
  | { status: "skipped" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: Record<string, unknown> };

/**
 * Right-side Email Analyzer box for Breaches.
 * Runs `/api/osint/email-analyze` when the query looks like an email.
 */
export function EmailAnalyzerPanel({
  query,
  blurResults = false,
}: {
  query: string;
  blurResults?: boolean;
}) {
  const email = useMemo(() => normalizeEmail(query), [query]);
  const [state, setState] = useState<AnalyzerState>(() =>
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
          `/api/osint/email-analyze?query=${encodeURIComponent(email)}&moduleSlug=breaches`,
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
          setState({
            status: "error",
            message:
              (typeof json?.error === "string" && json.error) ||
              (typeof json?.message === "string" && json.message) ||
              "Email Analyzer returned no findings.",
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
          message: "Email Analyzer lookup failed.",
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

    // Index hits belong in the middle breach column — keep the brief only.
    const { indexHits: _indexHits, ...brief } = state.data;
    const records = formatStructuredSearchData(brief);

    if (records.length > 0) return records;

    // Fallback: surface a few scalar top-level keys.
    const fields = Object.entries(brief)
      .filter(([, value]) => {
        if (value == null) return false;
        if (typeof value === "string") return value.trim().length > 0;
        if (typeof value === "number" || typeof value === "boolean") return true;

        return false;
      })
      .slice(0, 24)
      .map(([key, value]) => ({
        key,
        label: key.replace(/[_-]+/g, " "),
        value: String(value),
      }));

    if (fields.length === 0) return [];

    return [
      {
        index: 1,
        title: "Email brief",
        subtitle: email ?? undefined,
        fields,
      },
    ];
  }, [state, email]);

  return (
    <aside className="anya-breaches-side-panel anya-breaches-side-panel--analyzer">
      <div className="anya-breaches-side-panel-head">
        <p className="anya-breaches-side-panel-title">
          <MailSearch className="size-3.5" />
          Email Analyzer
        </p>
        {email ? (
          <span className="anya-breaches-side-panel-meta">
            {blurResults ? "••••••••" : email}
          </span>
        ) : null}
      </div>

      {state.status === "skipped" ? (
        <p className="anya-breaches-side-panel-empty">
          Enter an email address to run Email Analyzer alongside breaches.
        </p>
      ) : null}

      {state.status === "loading" ? (
        <p className="anya-breaches-side-panel-status">
          <Loader2 className="size-3.5 animate-spin" />
          Analyzing email…
        </p>
      ) : null}

      {state.status === "error" ? (
        <p className="anya-breaches-side-panel-empty">{state.message}</p>
      ) : null}

      {state.status === "ready" && cards.length === 0 ? (
        <p className="anya-breaches-side-panel-empty">
          No analyzer findings for this email.
        </p>
      ) : null}

      {state.status === "ready" && cards.length > 0 ? (
        <ResultCardList className="anya-result-list--analyzer">
          {cards.map((record, index) => (
            <ResultCard
              key={`${record.index}-${record.title}`}
              badge={record.badge ?? null}
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
              listIndex={index}
              subtitle={record.subtitle}
              title={record.title}
            />
          ))}
        </ResultCardList>
      ) : null}
    </aside>
  );
}
