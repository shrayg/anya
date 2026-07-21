"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";

import { BlurredValue } from "@/components/dashboard/blurred-value";
import type { IndexSweepSearchResult } from "@/lib/index-sweep";

function SourcePill({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] uppercase tracking-wide text-zinc-400">
      {label}
    </span>
  );
}

function confidenceClass(level: string): string {
  if (level === "high") return "text-emerald-300/90";
  if (level === "medium") return "text-amber-200/90";

  return "text-zinc-500";
}

function MatchBadge({ mode }: { mode: "exact" | "loose" }) {
  if (mode === "exact") {
    return (
      <span className="rounded border border-emerald-400/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-emerald-200/90">
        Exact
      </span>
    );
  }

  return (
    <span className="rounded border border-amber-400/25 bg-amber-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-amber-100/80">
      Loose lead
    </span>
  );
}

export function IndexSweepResults({
  data,
  blurResults = false,
}: {
  data: IndexSweepSearchResult;
  blurResults?: boolean;
}) {
  const exactDorks = data.dorks.filter((d) => d.matchMode === "exact");
  const looseDorks = data.dorks.filter((d) => d.matchMode === "loose");

  const linkedIn = data.dorks.filter((d) => d.platformId.startsWith("linkedin"));
  const github = data.dorks.filter((d) => d.platformId.startsWith("github"));
  const other = data.dorks.filter(
    (d) =>
      !d.platformId.startsWith("linkedin") &&
      !d.platformId.startsWith("github") &&
      d.platformId !== "open-web" &&
      d.platformId !== "open-web-loose",
  );
  const openWeb = data.dorks.filter(
    (d) => d.platformId === "open-web" || d.platformId === "open-web-loose",
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-2 sm:grid-cols-4">
        <div className="anya-result-strip">
          <p className="anya-result-label">
            {data.kind === "email" ? "Email" : "Phone"}
          </p>
          <p className="anya-result-value">
            <BlurredValue forceBlur={blurResults} text={data.normalized} />
          </p>
        </div>
        <div className="anya-result-strip">
          <p className="anya-result-label">Strict operators</p>
          <p className="anya-result-value">{exactDorks.length}</p>
        </div>
        <div className="anya-result-strip">
          <p className="anya-result-label">Loose leads</p>
          <p className="anya-result-value">{looseDorks.length}</p>
        </div>
        <div className="anya-result-strip">
          <p className="anya-result-label">
            {data.kind === "phone" ? "Format variants" : "Live hits"}
          </p>
          <p className="anya-result-value">
            {data.kind === "phone" ? data.variants.length : data.hits.length}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SourcePill label="Index Sweep" />
        <span className="text-xs text-zinc-500">
          Strict quoted operators · loose leads capped at low unless corroborated
        </span>
      </div>

      {data.kind === "phone" && data.variants.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
            Phone format variants (strict search each)
          </h3>
          <div className="flex flex-wrap gap-1.5 rounded-xl border border-white/10 bg-black/30 px-3 py-3">
            {data.variants.map((variant) => (
              <code
                key={variant}
                className="rounded border border-white/10 bg-black/40 px-2 py-0.5 font-mono text-[11px] text-zinc-300"
              >
                <BlurredValue forceBlur={blurResults} text={variant} />
              </code>
            ))}
          </div>
        </section>
      ) : null}

      {data.warning ? (
        <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-zinc-400">
          {data.warning}
        </p>
      ) : null}

      {data.locations && data.locations.length > 0 ? (
        <section className="space-y-3">
          <h3 className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
            Location signals from indexed pages
          </h3>
          <ul className="space-y-2">
            {data.locations.map((loc) => (
              <li
                key={loc.url}
                className="rounded-xl border border-emerald-400/20 bg-emerald-500/5 px-4 py-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-white">
                    {loc.title || loc.domain}
                  </p>
                  <span
                    className={`text-[11px] uppercase tracking-wide ${confidenceClass(loc.confidence)}`}
                  >
                    {loc.confidence} · {loc.proximity}
                  </span>
                </div>
                <p className="mt-1 font-mono text-[11px] text-zinc-500">
                  {loc.domain}
                </p>
                {loc.addresses.length > 0 ? (
                  <ul className="mt-2 space-y-1">
                    {loc.addresses.map((addr) => (
                      <li key={addr} className="text-sm text-zinc-200">
                        <BlurredValue forceBlur={blurResults} text={addr} />
                      </li>
                    ))}
                  </ul>
                ) : null}
                {loc.phones.length > 0 ? (
                  <p className="mt-2 text-xs text-zinc-400">
                    Phone:{" "}
                    <BlurredValue
                      forceBlur={blurResults}
                      text={loc.phones.join(" · ")}
                    />
                  </p>
                ) : null}
                {loc.snippet ? (
                  <p className="mt-2 text-xs text-zinc-500">{loc.snippet}</p>
                ) : null}
                {!blurResults ? (
                  <a
                    className="mt-2 inline-flex items-center gap-1 text-xs text-sky-300 hover:text-sky-200"
                    href={loc.url}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    Open page
                    <ExternalLink className="size-3" />
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.linkedInResolve &&
      (data.linkedInResolve.pivots.length > 0 ||
        data.linkedInResolve.hits.length > 0) ? (
        <section className="space-y-3">
          <h3 className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
            LinkedIn resolve
          </h3>
          {data.linkedInResolve.pivots.length > 0 ? (
            <ul className="space-y-2">
              {data.linkedInResolve.pivots.map((pivot) => (
                <li
                  key={pivot.url}
                  className="rounded-xl border border-emerald-400/20 bg-emerald-500/5 px-4 py-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-white">
                      {pivot.platform}: {pivot.label}
                    </p>
                    <span
                      className={`text-[11px] uppercase tracking-wide ${confidenceClass(pivot.confidence)}`}
                    >
                      {pivot.confidence}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    {pivot.evidence.join(" · ")}
                  </p>
                  {!blurResults ? (
                    <a
                      className="mt-2 inline-flex items-center gap-1 text-xs text-sky-300 hover:text-sky-200"
                      href={pivot.url}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      Open pivot
                      <ExternalLink className="size-3" />
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
          {data.linkedInResolve.hits.length > 0 ? (
            <ul className="space-y-2">
              {data.linkedInResolve.hits.map((hit) => (
                <li
                  key={`${hit.profileUrl}-${hit.method}`}
                  className="rounded-xl border border-white/10 bg-black/30 px-4 py-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-white">
                      {hit.title || hit.publicIdentifier}
                    </p>
                    <span
                      className={`text-[11px] uppercase tracking-wide ${confidenceClass(hit.confidence)}`}
                    >
                      {hit.confidence} · {hit.method}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    {hit.evidence.join(" · ")}
                  </p>
                  {!blurResults ? (
                    <a
                      className="mt-2 inline-flex items-center gap-1 text-xs text-sky-300 hover:text-sky-200"
                      href={hit.profileUrl}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      {hit.profileUrl}
                      <ExternalLink className="size-3" />
                    </a>
                  ) : (
                    <p className="mt-2 font-mono text-[11px] text-zinc-500">
                      <BlurredValue forceBlur text={hit.profileUrl} />
                    </p>
                  )}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {data.hits.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
            Live LinkedIn snippets
          </h3>
          <ul className="divide-y divide-white/5 rounded-xl border border-white/10 bg-black/30">
            {data.hits.map((hit) => (
              <li
                key={`${hit.url}-${hit.title}`}
                className="space-y-1 px-4 py-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-white">{hit.title}</p>
                  <MatchBadge mode={hit.matchMode} />
                  <span
                    className={`text-[11px] uppercase tracking-wide ${confidenceClass(hit.confidence)}`}
                  >
                    {hit.confidence}
                    {hit.corroborated ? " · corroborated" : ""}
                  </span>
                </div>
                {hit.snippet ? (
                  <p className="text-xs text-zinc-400">{hit.snippet}</p>
                ) : null}
                {blurResults ? (
                  <p className="font-mono text-[11px] text-zinc-500">
                    <BlurredValue forceBlur text={hit.url} />
                  </p>
                ) : (
                  <a
                    className="inline-flex items-center gap-1 text-xs text-sky-300 hover:text-sky-200"
                    href={hit.url}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    Open result
                    <ExternalLink className="size-3" />
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <DorkSection
        blurResults={blurResults}
        dorks={linkedIn}
        title="LinkedIn"
      />
      <DorkSection blurResults={blurResults} dorks={github} title="GitHub" />
      <DorkSection
        blurResults={blurResults}
        dorks={other}
        title="Other public platforms"
      />
      <DorkSection
        blurResults={blurResults}
        dorks={openWeb}
        title="Open web"
      />

      <p className="text-[11px] leading-relaxed text-zinc-600">
        Loose (unquoted) operators are shown as leads and stay low confidence
        unless an exact-match live hit corroborates the same site — then medium,
        never high. Snapchat, Hinge, Tinder, Bumble, and TikTok stay app-walled
        for this method.
      </p>
    </div>
  );
}

function DorkSection({
  title,
  dorks,
  blurResults,
}: {
  title: string;
  dorks: IndexSweepSearchResult["dorks"];
  blurResults?: boolean;
}) {
  if (dorks.length === 0) return null;

  const byPlatform = new Map<string, typeof dorks>();

  for (const dork of dorks) {
    const list = byPlatform.get(dork.platformId) ?? [];

    list.push(dork);
    byPlatform.set(dork.platformId, list);
  }

  return (
    <section className="space-y-3">
      <h3 className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
        {title}
      </h3>
      <ul className="space-y-3">
        {[...byPlatform.entries()].map(([platformId, rows]) => (
          <PlatformDorkCard
            key={platformId}
            blurResults={blurResults}
            rows={rows}
          />
        ))}
      </ul>
    </section>
  );
}

function PlatformDorkCard({
  rows,
  blurResults,
}: {
  rows: IndexSweepSearchResult["dorks"];
  blurResults?: boolean;
}) {
  const head = rows[0]!;
  const isPhoneHeavy = rows.length > 4;
  const [expanded, setExpanded] = useState(!isPhoneHeavy);
  const visible = expanded ? rows : rows.slice(0, 3);

  return (
    <li className="rounded-xl border border-white/10 bg-black/30 px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-white">{head.platformLabel}</p>
          <MatchBadge mode={head.matchMode} />
        </div>
        <span
          className={`text-[11px] uppercase tracking-wide ${confidenceClass(head.confidence)}`}
        >
          {head.confidence} confidence
          {head.corroborated ? " · corroborated" : ""}
        </span>
      </div>
      <p className="mt-1 text-xs text-zinc-500">{head.note}</p>
      <div className="mt-3 space-y-2">
        {visible.map((row) => (
          <div
            key={`${row.query}-${row.identifier}`}
            className="rounded-lg border border-white/5 bg-black/40 px-3 py-2"
          >
            {row.identifier !== head.identifier || rows.length > 1 ? (
              <p className="mb-1 text-[10px] uppercase tracking-wide text-zinc-600">
                Variant ·{" "}
                <span className="font-mono normal-case text-zinc-400">
                  <BlurredValue forceBlur={blurResults} text={row.identifier} />
                </span>
              </p>
            ) : null}
            <p className="font-mono text-[11px] text-zinc-400">
              <BlurredValue forceBlur={blurResults} text={row.query} />
            </p>
            {!blurResults ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {row.engines.map((engine) => (
                  <a
                    key={engine.engine}
                    className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[11px] text-sky-300 hover:border-sky-400/40 hover:text-sky-200"
                    href={engine.url}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {engine.label}
                    <ExternalLink className="size-3" />
                  </a>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-[11px] text-zinc-500">Search links locked</p>
            )}
          </div>
        ))}
      </div>
      {isPhoneHeavy ? (
        <button
          className="mt-3 text-[11px] text-sky-300 hover:text-sky-200"
          onClick={() => setExpanded((v) => !v)}
          type="button"
        >
          {expanded
            ? "Show fewer formats"
            : `Show all ${rows.length} format variants`}
        </button>
      ) : null}
    </li>
  );
}
