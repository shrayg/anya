import { ExternalLink } from "lucide-react";

import { BlurredValue } from "@/components/dashboard/blurred-value";
import type {
  CourtCaseHit,
  PersonHit,
  UsCourtSearchResult,
  UsIdentitySearchResult,
} from "@/lib/us-records";

function SourcePill({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] uppercase tracking-wide text-zinc-400">
      {label}
    </span>
  );
}

function CaseCard({
  item,
  blurResults,
}: {
  item: CourtCaseHit;
  blurResults?: boolean;
}) {
  return (
    <div className="anya-result-strip space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <p className="anya-result-label">Court matter</p>
        <SourcePill label={item.source.label} />
      </div>
      <p className="anya-result-value text-base">
        <BlurredValue forceBlur={blurResults} text={item.caseName} />
      </p>
      <div className="grid gap-2 text-sm text-zinc-300 md:grid-cols-2">
        {item.docketNumber ? (
          <p>
            <span className="text-zinc-500">Docket · </span>
            <BlurredValue forceBlur={blurResults} text={item.docketNumber} />
          </p>
        ) : null}
        {item.court ? (
          <p>
            <span className="text-zinc-500">Court · </span>
            <BlurredValue forceBlur={blurResults} text={item.court} />
          </p>
        ) : null}
        {item.dateFiled ? (
          <p>
            <span className="text-zinc-500">Filed · </span>
            <BlurredValue forceBlur={blurResults} text={item.dateFiled} />
          </p>
        ) : null}
        {item.natureOfSuit ? (
          <p>
            <span className="text-zinc-500">Nature · </span>
            <BlurredValue forceBlur={blurResults} text={item.natureOfSuit} />
          </p>
        ) : null}
      </div>
      {item.snippet ? (
        <p className="text-sm text-zinc-400">
          <BlurredValue forceBlur={blurResults} text={item.snippet} />
        </p>
      ) : null}
      {item.source.deepLink ? (
        <a
          className="inline-flex items-center gap-1 text-sm text-anya-accent hover:underline"
          href={item.source.deepLink}
          rel="noreferrer"
          target="_blank"
        >
          Open source <ExternalLink className="size-3.5" />
        </a>
      ) : null}
    </div>
  );
}

function PersonCard({
  item,
  blurResults,
}: {
  item: PersonHit;
  blurResults?: boolean;
}) {
  return (
    <div className="anya-result-strip space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <p className="anya-result-label">{item.kind}</p>
        <SourcePill label={item.source.label} />
      </div>
      <p className="anya-result-value text-base">
        <BlurredValue forceBlur={blurResults} text={item.name} />
      </p>
      {item.subtitle ? (
        <p className="text-sm text-zinc-400">
          <BlurredValue forceBlur={blurResults} text={item.subtitle} />
        </p>
      ) : null}
      <div className="grid gap-2 text-sm text-zinc-300 md:grid-cols-2">
        {item.details.map((detail) => (
          <p key={`${item.id}-${detail.label}`}>
            <span className="text-zinc-500">{detail.label} · </span>
            <BlurredValue forceBlur={blurResults} text={detail.value} />
          </p>
        ))}
      </div>
      {item.source.deepLink ? (
        <a
          className="inline-flex items-center gap-1 text-sm text-anya-accent hover:underline"
          href={item.source.deepLink}
          rel="noreferrer"
          target="_blank"
        >
          Open source <ExternalLink className="size-3.5" />
        </a>
      ) : null}
    </div>
  );
}

export function UsCourtSearchResults({
  result,
  blurResults = false,
}: {
  result: UsCourtSearchResult;
  blurResults?: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="anya-result-strip">
        <p className="anya-result-label">Matches</p>
        <p className="anya-result-value">
          <BlurredValue
            forceBlur={blurResults}
            text={`${result.count.toLocaleString()} court matters`}
          />
        </p>
        {result.sources.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {result.sources.map((source) => (
              <SourcePill key={source} label={source} />
            ))}
          </div>
        ) : null}
      </div>
      {result.errors.length > 0 ? (
        <div className="rounded-lg border border-amber-400/20 bg-amber-400/8 px-3 py-2 text-sm text-amber-100">
          {result.errors.map((error) => (
            <p key={error.id}>
              {error.label}: {error.message}
            </p>
          ))}
        </div>
      ) : null}
      <div className="grid gap-3">
        {result.cases.map((item) => (
          <CaseCard key={item.id} blurResults={blurResults} item={item} />
        ))}
      </div>
    </div>
  );
}

export function UsIdentitySearchResults({
  result,
  blurResults = false,
  title = "Public identity hits",
}: {
  result: UsIdentitySearchResult;
  blurResults?: boolean;
  title?: string;
}) {
  return (
    <div className="space-y-4">
      <div className="anya-result-strip">
        <p className="anya-result-label">{title}</p>
        <p className="anya-result-value">
          <BlurredValue
            forceBlur={blurResults}
            text={`${result.count.toLocaleString()} composed records`}
          />
        </p>
        {result.sources.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {result.sources.map((source) => (
              <SourcePill key={source} label={source} />
            ))}
          </div>
        ) : null}
        {result.parsed.fullName || result.parsed.state || result.parsed.dob ? (
          <p className="mt-2 text-xs text-zinc-500">
            Parsed
            {result.parsed.fullName ? ` · ${result.parsed.fullName}` : ""}
            {result.parsed.state ? ` · ${result.parsed.state}` : ""}
            {result.parsed.dob ? ` · DOB ${result.parsed.dob}` : ""}
          </p>
        ) : null}
      </div>
      {result.errors.length > 0 ? (
        <div className="rounded-lg border border-amber-400/20 bg-amber-400/8 px-3 py-2 text-sm text-amber-100">
          Partial source failures:
          {result.errors.map((error) => (
            <p key={error.id}>
              {error.label}: {error.message}
            </p>
          ))}
        </div>
      ) : null}
      {result.people.length > 0 ? (
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Registry people</p>
          <div className="grid gap-3">
            {result.people.map((item) => (
              <PersonCard key={item.id} blurResults={blurResults} item={item} />
            ))}
          </div>
        </div>
      ) : null}
      {result.cases.length > 0 ? (
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Related court matters</p>
          <div className="grid gap-3">
            {result.cases.map((item) => (
              <CaseCard key={item.id} blurResults={blurResults} item={item} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
