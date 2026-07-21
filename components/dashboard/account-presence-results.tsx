"use client";

import { ExternalLink } from "lucide-react";

import { BlurredValue } from "@/components/dashboard/blurred-value";
import type { AccountPresenceSearchResult } from "@/lib/account-presence";
import type { EmailPresenceSearchResult } from "@/lib/email-presence";

function SourcePill({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] uppercase tracking-wide text-zinc-400">
      {label}
    </span>
  );
}

function HitList({
  hits,
  blurResults,
}: {
  hits: Array<{
    siteName: string;
    url?: string | null;
    domain?: string;
    profileUrl?: string | null;
    emailrecovery?: string | null;
    phoneNumber?: string | null;
    others?: Record<string, string> | null;
  }>;
  blurResults?: boolean;
}) {
  if (hits.length === 0) {
    return <p className="text-sm text-zinc-500">No hits from this source.</p>;
  }

  return (
    <ul className="divide-y divide-white/5 rounded-xl border border-white/10 bg-black/30">
      {hits.map((hit) => {
        const href = hit.url || hit.profileUrl || null;
        const key = `${hit.siteName}-${href || hit.domain || ""}`;
        const meta = [
          hit.emailrecovery,
          hit.phoneNumber,
          hit.others
            ? Object.entries(hit.others)
                .map(([k, v]) => `${k}: ${v}`)
                .join(" · ")
            : null,
        ]
          .filter(Boolean)
          .join(" · ");

        return (
          <li
            key={key}
            className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">
                {hit.siteName}
                {hit.domain ? (
                  <span className="ml-2 font-mono text-[11px] text-zinc-500">
                    {hit.domain}
                  </span>
                ) : null}
              </p>
              {href ? (
                <p className="truncate font-mono text-[11px] text-zinc-500">
                  <BlurredValue forceBlur={blurResults} text={href} />
                </p>
              ) : null}
              {meta ? (
                <p className="mt-1 text-[11px] text-zinc-400">{meta}</p>
              ) : null}
            </div>
            {href && !blurResults ? (
              <a
                className="inline-flex items-center gap-1 text-xs text-sky-300 hover:text-sky-200"
                href={href}
                rel="noopener noreferrer"
                target="_blank"
              >
                Open
                <ExternalLink className="size-3" />
              </a>
            ) : blurResults && href ? (
              <span className="text-xs text-zinc-500">Locked</span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export function AccountPresenceResults({
  data,
  blurResults = false,
}: {
  data: AccountPresenceSearchResult;
  blurResults?: boolean;
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-2 sm:grid-cols-4">
        <div className="anya-result-strip">
          <p className="anya-result-label">Username</p>
          <p className="anya-result-value">
            <BlurredValue forceBlur={blurResults} text={data.username} />
          </p>
        </div>
        <div className="anya-result-strip">
          <p className="anya-result-label">Profiles found</p>
          <p className="anya-result-value">{data.count}</p>
        </div>
        <div className="anya-result-strip">
          <p className="anya-result-label">Platforms checked</p>
          <p className="anya-result-value">{data.checked}</p>
        </div>
        <div className="anya-result-strip">
          <p className="anya-result-label">Duration</p>
          <p className="anya-result-value">
            {(data.durationMs / 1000).toFixed(1)}s
          </p>
        </div>
      </div>

      {data.warning ? (
        <p className="rounded-xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-xs text-amber-100/90">
          {data.warning}
        </p>
      ) : null}

      <div className="space-y-6">
        {data.sources.map((source) => (
          <section key={source.id} className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
                Source
              </h3>
              <SourcePill label={source.label} />
              <span className="font-mono text-[11px] text-zinc-500">
                {source.count}/{source.checked} ·{" "}
                {(source.durationMs / 1000).toFixed(1)}s
              </span>
            </div>
            {source.warning ? (
              <p className="text-xs text-zinc-500">{source.warning}</p>
            ) : null}
            <HitList blurResults={blurResults} hits={source.found} />
          </section>
        ))}
      </div>
    </div>
  );
}

export function EmailPresenceResults({
  data,
  blurResults = false,
}: {
  data: EmailPresenceSearchResult;
  blurResults?: boolean;
}) {
  const kind = data.kind ?? "email";
  const profileHits = data.found.filter((f) => f.profileUrl);
  const presenceOnly = data.found.filter((f) => !f.profileUrl);
  const subjectLabel = kind === "phone" ? "Phone" : "Email";
  const subjectValue =
    kind === "phone" ? (data.phone ?? data.query) : (data.email ?? data.query);
  const profileSectionTitle =
    kind === "phone" ? "Phone → Profile" : "Email → Profile";

  return (
    <div className="space-y-5">
      <div className="grid gap-2 sm:grid-cols-5">
        <div className="anya-result-strip">
          <p className="anya-result-label">{subjectLabel}</p>
          <p className="anya-result-value">
            <BlurredValue forceBlur={blurResults} text={subjectValue} />
          </p>
        </div>
        <div className="anya-result-strip">
          <p className="anya-result-label">Profiles</p>
          <p className="anya-result-value">
            {data.profileCount ?? profileHits.length}
          </p>
        </div>
        <div className="anya-result-strip">
          <p className="anya-result-label">Presence</p>
          <p className="anya-result-value">
            {data.presenceCount ?? presenceOnly.length}
          </p>
        </div>
        <div className="anya-result-strip">
          <p className="anya-result-label">Platforms checked</p>
          <p className="anya-result-value">{data.checked}</p>
        </div>
        <div className="anya-result-strip">
          <p className="anya-result-label">Duration</p>
          <p className="anya-result-value">
            {(data.durationMs / 1000).toFixed(1)}s
          </p>
        </div>
      </div>

      {data.warning ? (
        <p className="rounded-xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-xs text-amber-100/90">
          {data.warning}
        </p>
      ) : null}

      {profileHits.length > 0 ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
              {profileSectionTitle}
            </h3>
            <SourcePill label="URL / username leaked" />
          </div>
          <HitList blurResults={blurResults} hits={profileHits} />
        </section>
      ) : null}

      {presenceOnly.length > 0 ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
              Registered (no public profile URL)
            </h3>
            <SourcePill label="Presence only" />
          </div>
          <HitList blurResults={blurResults} hits={presenceOnly} />
        </section>
      ) : null}

      {data.found.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No account presence or profile URLs returned for this query.
        </p>
      ) : null}
    </div>
  );
}
