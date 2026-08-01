"use client";

import { Loader2, UserRoundSearch } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  ResultCard,
  ResultCardList,
} from "@/components/dashboard/result-card";
import {
  normalizeContactInput,
  type NormalizedContact,
} from "@/lib/email-presence/normalize";
import type { EmailPresenceHit } from "@/lib/email-presence/types";

type PanelState =
  | { status: "skipped" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      found: EmailPresenceHit[];
      checked: number;
      count: number;
    };

/**
 * Breaches companion — Contact Profiles for email or phone queries.
 * Gated as `email-presence` (do not pass moduleSlug=breaches).
 */
export function ContactProfilesPanel({
  query,
  blurResults = false,
}: {
  query: string;
  blurResults?: boolean;
}) {
  const contact = useMemo(
    (): NormalizedContact | null => normalizeContactInput(query),
    [query],
  );
  const [state, setState] = useState<PanelState>(() =>
    contact ? { status: "loading" } : { status: "skipped" },
  );

  useEffect(() => {
    if (!contact) {
      setState({ status: "skipped" });

      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const lookup =
      contact.kind === "email" ? contact.email : contact.display;

    setState({ status: "loading" });

    void (async () => {
      try {
        const res = await fetch(
          `/api/osint/email-presence?query=${encodeURIComponent(lookup)}`,
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
              ? "Sign in with Professional or higher to run Contact Profiles."
              : res.status === 403
                ? raw ||
                  "Contact Profiles requires Professional or higher."
                : raw || "Contact Profiles returned no findings.";

          setState({
            status: "error",
            message,
          });

          return;
        }

        const found = Array.isArray(json.found)
          ? (json.found as EmailPresenceHit[])
          : [];

        setState({
          status: "ready",
          found,
          checked: typeof json.checked === "number" ? json.checked : 0,
          count: typeof json.count === "number" ? json.count : found.length,
        });
      } catch (err) {
        if (
          cancelled ||
          (err instanceof DOMException && err.name === "AbortError")
        ) {
          return;
        }

        setState({
          status: "error",
          message: "Contact Profiles lookup failed.",
        });
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [contact]);

  if (state.status === "skipped") return null;

  const subject =
    contact?.kind === "email"
      ? contact.email
      : contact?.kind === "phone"
        ? contact.display
        : query;

  return (
    <aside className="anya-breaches-side-panel anya-breaches-side-panel--companion">
      <div className="anya-breaches-side-panel-head">
        <p className="anya-breaches-side-panel-title">
          <UserRoundSearch className="size-3.5" />
          Contact Profiles
        </p>
        {subject ? (
          <span className="anya-breaches-side-panel-meta">
            {blurResults ? "••••••••" : subject}
          </span>
        ) : null}
      </div>

      {state.status === "loading" ? (
        <p className="anya-breaches-side-panel-status">
          <Loader2 className="size-3.5 animate-spin" />
          Checking account presence…
        </p>
      ) : null}

      {state.status === "error" ? (
        <p className="anya-breaches-side-panel-empty">{state.message}</p>
      ) : null}

      {state.status === "ready" && state.found.length === 0 ? (
        <p className="anya-breaches-side-panel-empty">
          No registered accounts detected
          {state.checked > 0 ? ` across ${state.checked} platforms` : ""}.
        </p>
      ) : null}

      {state.status === "ready" && state.found.length > 0 ? (
        <ResultCardList className="anya-result-list--analyzer">
          {state.found.slice(0, 40).map((hit, cardIndex) => {
            const fields = [];

            if (hit.domain) {
              fields.push({
                key: "domain",
                label: "Domain",
                value: hit.domain,
              });
            }
            if (hit.profileUrl) {
              fields.push({
                key: "profile",
                label: "Profile",
                value: hit.profileUrl,
                highlight: true,
              });
            }
            if (hit.emailrecovery) {
              fields.push({
                key: "recovery",
                label: "Recovery email",
                value: hit.emailrecovery,
              });
            }
            if (hit.phoneNumber) {
              fields.push({
                key: "phone",
                label: "Phone",
                value: hit.phoneNumber,
              });
            }

            return (
              <ResultCard
                key={`${hit.siteName}-${hit.domain}-${cardIndex}`}
                badge="Presence"
                blurResults={blurResults}
                className="anya-result-card--dense"
                fields={fields}
                indexLabel={cardIndex + 1}
                listIndex={cardIndex}
                subtitle={hit.domain || undefined}
                title={hit.siteName || hit.domain || "Account presence"}
              />
            );
          })}
        </ResultCardList>
      ) : null}
    </aside>
  );
}
