import { ExternalLink } from "lucide-react";

import { BlurredValue } from "@/components/dashboard/blurred-value";
import type {
  CourtCaseHit,
  PersonHit,
  PublicPortalHit,
  UsCourtSearchResult,
  UsIdentitySearchResult,
  UsVaSorSearchResult,
} from "@/lib/us-records";

function SourcePill({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] uppercase tracking-wide text-zinc-400">
      {label}
    </span>
  );
}

function kindLabel(kind: PersonHit["kind"]): string {
  switch (kind) {
    case "sex-offender":
      return "Sex offender registry";
    case "sanctions":
      return "Sanctions";
    case "wanted":
      return "Wanted";
    case "inmate":
      return "Inmate";
    case "business":
      return "Business exclusion";
    case "provider":
      return "Provider";
    case "candidate":
      return "Candidate";
    default:
      return "Public record";
  }
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
        <p className="anya-result-label">{kindLabel(item.kind)}</p>
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

function PortalCard({
  item,
  blurResults,
}: {
  item: PublicPortalHit;
  blurResults?: boolean;
}) {
  return (
    <div className="anya-result-strip space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <p className="anya-result-label">Public portal</p>
        <SourcePill label={item.source.label} />
      </div>
      <p className="anya-result-value text-base">
        <BlurredValue forceBlur={blurResults} text={item.title} />
      </p>
      <p className="text-sm text-zinc-400">
        <BlurredValue forceBlur={blurResults} text={item.summary} />
      </p>
      {item.source.deepLink ? (
        <a
          className="inline-flex items-center gap-1 text-sm text-anya-accent hover:underline"
          href={item.source.deepLink}
          rel="noreferrer"
          target="_blank"
        >
          Open official portal <ExternalLink className="size-3.5" />
        </a>
      ) : null}
    </div>
  );
}

function ParsedHint({
  result,
}: {
  result: Pick<UsIdentitySearchResult, "parsed">;
}) {
  const { parsed } = result;
  if (
    !parsed.fullName &&
    !parsed.state &&
    !parsed.dob &&
    !parsed.county &&
    !parsed.zip
  ) {
    return null;
  }

  return (
    <p className="mt-2 text-xs text-zinc-500">
      Parsed
      {parsed.fullName ? ` · ${parsed.fullName}` : ""}
      {parsed.county ? ` · ${parsed.county}` : ""}
      {parsed.city ? ` · ${parsed.city}` : ""}
      {parsed.state ? ` · ${parsed.state}` : ""}
      {parsed.zip ? ` · ${parsed.zip}` : ""}
      {parsed.dob ? ` · DOB ${parsed.dob}` : ""}
    </p>
  );
}

export function UsCourtSearchResults({
  result,
  blurResults = false,
}: {
  result: UsCourtSearchResult;
  blurResults?: boolean;
}) {
  const portals = result.portals ?? [];

  return (
    <div className="space-y-4">
      <div className="anya-result-strip">
        <p className="anya-result-label">Matches</p>
        <p className="anya-result-value">
          <BlurredValue
            forceBlur={blurResults}
            text={`${result.count.toLocaleString()} court / portal results`}
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
      {portals.length > 0 ? (
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-wide text-zinc-500">State portals</p>
          <div className="grid gap-3">
            {portals.map((item) => (
              <PortalCard key={item.id} blurResults={blurResults} item={item} />
            ))}
          </div>
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
  const portals = result.portals ?? [];

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
        <ParsedHint result={result} />
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
      {portals.length > 0 ? (
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-wide text-zinc-500">State portals</p>
          <div className="grid gap-3">
            {portals.map((item) => (
              <PortalCard key={item.id} blurResults={blurResults} item={item} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function UsVaSorSearchResults({
  result,
  blurResults = false,
}: {
  result: UsVaSorSearchResult;
  blurResults?: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="anya-result-strip">
        <p className="anya-result-label">Virginia Sex Offender Registry</p>
        <p className="anya-result-value">
          <BlurredValue
            forceBlur={blurResults}
            text={`${result.count.toLocaleString()} registry matches`}
          />
        </p>
        {result.sources.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {result.sources.map((source) => (
              <SourcePill key={source} label={source} />
            ))}
          </div>
        ) : null}
        <ParsedHint result={result} />
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
        {result.people.map((item) => (
          <PersonCard key={item.id} blurResults={blurResults} item={item} />
        ))}
      </div>
    </div>
  );
}
