"use client";

import { ExternalLink } from "lucide-react";

import { BlurredValue } from "@/components/dashboard/blurred-value";
import {
  ResultCard,
  ResultCardList,
  ResultStatStrip,
  type ResultCardFieldDef,
} from "@/components/dashboard/result-card";
import type { AccountPresenceSearchResult } from "@/lib/account-presence";
import type { EmailPresenceSearchResult } from "@/lib/email-presence";

function SourcePill({ label }: { label: string }) {
  return (
    <span className="anya-result-badge">{label}</span>
  );
}

function HitList({
  hits,
  blurResults,
  startIndex = 0,
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
  startIndex?: number;
}) {
  if (hits.length === 0) {
    return <p className="text-sm text-zinc-500">No hits from this source.</p>;
  }

  return (
    <ResultCardList>
      {hits.map((hit, i) => {
        const href = hit.url || hit.profileUrl || null;
        const key = `${hit.siteName}-${href || hit.domain || ""}`;
        const fields: ResultCardFieldDef[] = [];

        if (href) {
          fields.push({
            key: "url",
            label: "URL",
            value: href,
            highlight: true,
            block: true,
          });
        }
        if (hit.domain) {
          fields.push({ key: "domain", label: "Domain", value: hit.domain });
        }
        if (hit.emailrecovery) {
          fields.push({
            key: "emailrecovery",
            label: "Email recovery",
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
        if (hit.others) {
          for (const [label, value] of Object.entries(hit.others)) {
            fields.push({ key: label, label, value });
          }
        }

        return (
          <ResultCard
            key={key}
            blurResults={blurResults}
            copyText={href ?? hit.siteName}
            fields={fields}
            listIndex={startIndex + i}
            subtitle={hit.domain || href || undefined}
            title={hit.siteName}
            footer={
              href ? (
                blurResults ? (
                  <p className="px-3 pb-3 text-xs text-zinc-500">Locked</p>
                ) : (
                  <div className="px-3 pb-3">
                    <a
                      className="inline-flex items-center gap-1 text-xs text-anya-accent hover:underline"
                      href={href}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      Open
                      <ExternalLink className="size-3" />
                    </a>
                  </div>
                )
              ) : null
            }
          />
        );
      })}
    </ResultCardList>
  );
}

export function AccountPresenceResults({
  data,
  blurResults = false,
}: {
  data: AccountPresenceSearchResult;
  blurResults?: boolean;
}) {
  const sourceOffsets = data.sources.reduce<number[]>((acc, source, i) => {
    const prev = i === 0 ? 0 : acc[i - 1]! + data.sources[i - 1]!.found.length;

    acc.push(prev);

    return acc;
  }, []);

  return (
    <div className="anya-result-stack">
      <div className="grid gap-2 sm:grid-cols-4">
        <ResultStatStrip
          label="Username"
          value={<BlurredValue forceBlur={blurResults} text={data.username} />}
        />
        <ResultStatStrip label="Profiles found" value={data.count} />
        <ResultStatStrip label="Platforms checked" value={data.checked} />
        <ResultStatStrip
          label="Duration"
          value={`${(data.durationMs / 1000).toFixed(1)}s`}
        />
      </div>

      {data.warning ? (
        <p className="rounded-xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-xs text-amber-100/90">
          {data.warning}
        </p>
      ) : null}

      <div className="space-y-6">
        {data.sources.map((source, sourceIndex) => (
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
            <HitList
              blurResults={blurResults}
              hits={source.found}
              startIndex={sourceOffsets[sourceIndex] ?? 0}
            />
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
    <div className="anya-result-stack">
      <div className="grid gap-2 sm:grid-cols-5">
        <ResultStatStrip
          label={subjectLabel}
          value={<BlurredValue forceBlur={blurResults} text={subjectValue} />}
        />
        <ResultStatStrip
          label="Profiles"
          value={data.profileCount ?? profileHits.length}
        />
        <ResultStatStrip
          label="Presence"
          value={data.presenceCount ?? presenceOnly.length}
        />
        <ResultStatStrip label="Platforms checked" value={data.checked} />
        <ResultStatStrip
          label="Duration"
          value={`${(data.durationMs / 1000).toFixed(1)}s`}
        />
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
          <HitList blurResults={blurResults} hits={profileHits} startIndex={0} />
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
          <HitList
            blurResults={blurResults}
            hits={presenceOnly}
            startIndex={profileHits.length}
          />
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
