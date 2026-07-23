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

type PresenceHit = {
  siteName?: string;
  domain?: string;
  profileUrl?: string | null;
  emailrecovery?: string | null;
  phoneNumber?: string | null;
  exists?: boolean;
};

type SweepHit = {
  platformLabel?: string;
  site?: string;
  title?: string;
  url?: string;
  snippet?: string | null;
  confidence?: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function pushScalarFields(
  target: Array<{ key: string; label: string; value: string }>,
  record: Record<string, unknown>,
  prefix = "",
  depth = 0,
) {
  if (depth > 1) return;

  for (const [key, value] of Object.entries(record)) {
    if (
      key === "raw" ||
      key === "results" ||
      key === "sources" ||
      key === "found" ||
      key === "hits" ||
      key === "dorks" ||
      key === "locations" ||
      key === "linkedInResolve"
    ) {
      continue;
    }

    if (value == null) continue;

    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      const text = String(value).trim();

      if (!text) continue;
      target.push({
        key: `${prefix}${key}`,
        label: key.replace(/[_-]+/g, " "),
        value: text,
      });
      continue;
    }

    if (depth === 0 && typeof value === "object" && !Array.isArray(value)) {
      pushScalarFields(
        target,
        value as Record<string, unknown>,
        `${key}.`,
        depth + 1,
      );
    }
  }
}

function cardsFromAnalyzerPayload(
  data: Record<string, unknown>,
  email: string,
): FormattedRecord[] {
  const cards: FormattedRecord[] = [];
  let index = 1;
  const sources = asRecord(data.sources) ?? data;

  const brief = asRecord(sources.brief);

  if (brief) {
    const rest = { ...brief };
    delete rest.indexHits;
    delete rest.sources;
    delete rest.contactProfiles;
    delete rest.indexSweep;
    delete rest.seekriaEmailOsint;
    delete rest.seeknowEmailCheck;

    const fromFormat = formatStructuredSearchData(rest).slice(0, 6);

    if (fromFormat.length > 0) {
      for (const record of fromFormat) {
        cards.push({
          ...record,
          index: index++,
          title: record.title || "AI brief",
          badge: record.badge ?? "CSINT",
        });
      }
    } else {
      const fields: FormattedRecord["fields"] = [];
      pushScalarFields(fields, rest);

      if (fields.length > 0) {
        cards.push({
          index: index++,
          title: "AI brief",
          subtitle: email,
          badge: "CSINT",
          fields: fields.slice(0, 24),
        });
      }
    }
  }

  const presence = asRecord(sources.contactProfiles ?? data.contactProfiles);

  if (presence) {
    const found = Array.isArray(presence.found)
      ? (presence.found as PresenceHit[])
      : [];

    if (found.length === 0) {
      cards.push({
        index: index++,
        title: "Contact Profiles",
        subtitle: email,
        badge: "Presence",
        fields: [
          {
            key: "checked",
            label: "Checked",
            value: String(presence.checked ?? 0),
          },
          {
            key: "status",
            label: "Status",
            value: "No registered accounts detected",
          },
        ],
      });
    } else {
      for (const hit of found.slice(0, 40)) {
        const fields: FormattedRecord["fields"] = [];

        if (hit.domain) {
          fields.push({ key: "domain", label: "Domain", value: hit.domain });
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

        cards.push({
          index: index++,
          title: hit.siteName || hit.domain || "Account presence",
          subtitle: email,
          badge: "Presence",
          fields,
        });
      }
    }
  }

  const sweep = asRecord(sources.indexSweep ?? data.indexSweep);

  if (sweep) {
    const hits = Array.isArray(sweep.hits) ? (sweep.hits as SweepHit[]) : [];
    const locations = Array.isArray(sweep.locations) ? sweep.locations : [];

    if (hits.length === 0 && locations.length === 0) {
      const dorkCount = Array.isArray(sweep.dorks) ? sweep.dorks.length : 0;
      cards.push({
        index: index++,
        title: "Index Sweep",
        subtitle: email,
        badge: "Sweep",
        fields: [
          {
            key: "dorks",
            label: "Search templates",
            value: String(dorkCount),
          },
          {
            key: "note",
            label: "Note",
            value:
              typeof sweep.warning === "string" && sweep.warning
                ? sweep.warning
                : "No live hits — dork templates available",
          },
        ],
      });
    }

    for (const hit of hits.slice(0, 24)) {
      const fields: FormattedRecord["fields"] = [];

      if (hit.site) {
        fields.push({ key: "site", label: "Site", value: hit.site });
      }
      if (hit.url) {
        fields.push({
          key: "url",
          label: "URL",
          value: hit.url,
          highlight: true,
        });
      }
      if (hit.snippet) {
        fields.push({
          key: "snippet",
          label: "Snippet",
          value: hit.snippet,
          block: true,
        });
      }
      if (hit.confidence) {
        fields.push({
          key: "confidence",
          label: "Confidence",
          value: hit.confidence,
        });
      }

      cards.push({
        index: index++,
        title: hit.platformLabel || hit.title || "Index hit",
        subtitle: hit.title || email,
        badge: "Sweep",
        fields,
      });
    }

    for (const loc of locations.slice(0, 12)) {
      const row = asRecord(loc);
      if (!row) continue;
      const fields: FormattedRecord["fields"] = [];
      const addresses = Array.isArray(row.addresses)
        ? row.addresses.map(String).filter(Boolean)
        : [];
      const phones = Array.isArray(row.phones)
        ? row.phones.map(String).filter(Boolean)
        : [];

      if (typeof row.domain === "string") {
        fields.push({ key: "domain", label: "Domain", value: row.domain });
      }
      if (typeof row.url === "string") {
        fields.push({
          key: "url",
          label: "URL",
          value: row.url,
          highlight: true,
        });
      }
      if (addresses.length) {
        fields.push({
          key: "addresses",
          label: "Addresses",
          value: addresses.join(" · "),
          block: true,
        });
      }
      if (phones.length) {
        fields.push({
          key: "phones",
          label: "Phones",
          value: phones.join(" · "),
        });
      }

      cards.push({
        index: index++,
        title: "Location lead",
        subtitle: typeof row.title === "string" ? row.title : email,
        badge: "Sweep",
        fields,
      });
    }
  }

  for (const [key, label, badge] of [
    ["seekriaEmailOsint", "Seekria email OSINT", "Seekria"],
    ["seeknowEmailCheck", "SeekNow email check", "SeekNow"],
  ] as const) {
    const block = asRecord(sources[key] ?? data[key]);

    if (!block) continue;

    const results = Array.isArray(block.results) ? block.results : [];

    if (results.length > 0) {
      const formatted = formatStructuredSearchData(results).slice(0, 20);

      for (const record of formatted) {
        cards.push({
          ...record,
          index: index++,
          title: record.title || label,
          badge: record.badge ?? badge,
        });
      }
      continue;
    }

    const fields: FormattedRecord["fields"] = [];
    pushScalarFields(fields, block);

    if (fields.length > 0) {
      cards.push({
        index: index++,
        title: label,
        subtitle: email,
        badge,
        fields: fields.slice(0, 24),
      });
    }
  }

  return cards;
}

/**
 * Right-side Email Analyzer box for Breaches.
 * Fans out every Email Analyzer endpoint (brief, presence, sweep, Seekria, SeekNow).
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

    return cardsFromAnalyzerPayload(state.data, email ?? query);
  }, [state, email, query]);

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
          Analyzing email across all analyzer endpoints…
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
          {cards.map((record, cardIndex) => (
            <ResultCard
              key={`${record.index}-${record.title}-${cardIndex}`}
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
