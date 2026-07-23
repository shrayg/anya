import type {
  CourtCaseHit,
  PersonHit,
  PublicPortalHit,
  UsCourtSearchResult,
  UsIdentitySearchResult,
  UsVaSorSearchResult,
} from "@/lib/us-records";

import { ExternalLink } from "lucide-react";

import { BlurredValue } from "@/components/dashboard/blurred-value";
import {
  ResultCard,
  ResultCardList,
  ResultStatStrip,
  type ResultCardFieldDef,
} from "@/components/dashboard/result-card";

function SourcePill({ label }: { label: string }) {
  return <span className="anya-result-badge">{label}</span>;
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
  listIndex = 0,
}: {
  item: CourtCaseHit;
  blurResults?: boolean;
  listIndex?: number;
}) {
  const fields: ResultCardFieldDef[] = [];

  if (item.docketNumber) {
    fields.push({
      key: "docket",
      label: "Docket",
      value: item.docketNumber,
    });
  }
  if (item.court) {
    fields.push({ key: "court", label: "Court", value: item.court });
  }
  if (item.dateFiled) {
    fields.push({ key: "filed", label: "Filed", value: item.dateFiled });
  }
  if (item.natureOfSuit) {
    fields.push({
      key: "nature",
      label: "Nature",
      value: item.natureOfSuit,
    });
  }
  if (item.snippet) {
    fields.push({
      key: "snippet",
      label: "Snippet",
      value: item.snippet,
      block: true,
    });
  }

  return (
    <ResultCard
      badge={item.source.label}
      blurResults={blurResults}
      fields={fields}
      listIndex={listIndex}
      subtitle={item.docketNumber || item.court || undefined}
      title={item.caseName}
      footer={
        item.source.deepLink ? (
          <div className="px-3 pb-3">
            <a
              className="inline-flex items-center gap-1 text-xs text-anya-accent hover:underline"
              href={item.source.deepLink}
              rel="noreferrer"
              target="_blank"
            >
              Open source <ExternalLink className="size-3.5" />
            </a>
          </div>
        ) : null
      }
    />
  );
}

function PersonCard({
  item,
  blurResults,
  listIndex = 0,
}: {
  item: PersonHit;
  blurResults?: boolean;
  listIndex?: number;
}) {
  const fields: ResultCardFieldDef[] = item.details.map((detail) => ({
    key: detail.label,
    label: detail.label,
    value: detail.value,
  }));

  return (
    <ResultCard
      badge={item.source.label}
      blurResults={blurResults}
      fields={fields}
      listIndex={listIndex}
      subtitle={item.subtitle || undefined}
      title={item.name}
      footer={
        <>
          <p className="px-3 text-[11px] uppercase tracking-wide text-zinc-500">
            {kindLabel(item.kind)}
          </p>
          {item.source.deepLink ? (
            <div className="px-3 pb-3">
              <a
                className="inline-flex items-center gap-1 text-xs text-anya-accent hover:underline"
                href={item.source.deepLink}
                rel="noreferrer"
                target="_blank"
              >
                Open source <ExternalLink className="size-3.5" />
              </a>
            </div>
          ) : null}
        </>
      }
    />
  );
}

function PortalCard({
  item,
  blurResults,
  listIndex = 0,
}: {
  item: PublicPortalHit;
  blurResults?: boolean;
  listIndex?: number;
}) {
  return (
    <ResultCard
      badge={item.source.label}
      blurResults={blurResults}
      fields={[
        {
          key: "summary",
          label: "Summary",
          value: item.summary,
          block: true,
        },
      ]}
      listIndex={listIndex}
      title={item.title}
      footer={
        item.source.deepLink ? (
          <div className="px-3 pb-3">
            <a
              className="inline-flex items-center gap-1 text-xs text-anya-accent hover:underline"
              href={item.source.deepLink}
              rel="noreferrer"
              target="_blank"
            >
              Open official portal <ExternalLink className="size-3.5" />
            </a>
          </div>
        ) : null
      }
    />
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
    <div className="anya-result-stack">
      <ResultStatStrip
        label="Matches"
        value={
          <>
            <BlurredValue
              forceBlur={blurResults}
              text={`${result.count.toLocaleString()} court / portal results`}
            />
            {result.sources.length > 0 ? (
              <span className="mt-2 flex flex-wrap gap-2">
                {result.sources.map((source) => (
                  <SourcePill key={source} label={source} />
                ))}
              </span>
            ) : null}
          </>
        }
      />
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
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            State portals
          </p>
          <ResultCardList>
            {portals.map((item, i) => (
              <PortalCard
                key={item.id}
                blurResults={blurResults}
                item={item}
                listIndex={i}
              />
            ))}
          </ResultCardList>
        </div>
      ) : null}
      <ResultCardList>
        {result.cases.map((item, i) => (
          <CaseCard
            key={item.id}
            blurResults={blurResults}
            item={item}
            listIndex={portals.length + i}
          />
        ))}
      </ResultCardList>
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
  const peopleOffset = 0;
  const casesOffset = result.people.length;
  const portalsOffset = casesOffset + result.cases.length;

  return (
    <div className="anya-result-stack">
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
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            Registry people
          </p>
          <ResultCardList>
            {result.people.map((item, i) => (
              <PersonCard
                key={item.id}
                blurResults={blurResults}
                item={item}
                listIndex={peopleOffset + i}
              />
            ))}
          </ResultCardList>
        </div>
      ) : null}
      {result.cases.length > 0 ? (
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            Related court matters
          </p>
          <ResultCardList>
            {result.cases.map((item, i) => (
              <CaseCard
                key={item.id}
                blurResults={blurResults}
                item={item}
                listIndex={casesOffset + i}
              />
            ))}
          </ResultCardList>
        </div>
      ) : null}
      {portals.length > 0 ? (
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            State portals
          </p>
          <ResultCardList>
            {portals.map((item, i) => (
              <PortalCard
                key={item.id}
                blurResults={blurResults}
                item={item}
                listIndex={portalsOffset + i}
              />
            ))}
          </ResultCardList>
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
    <div className="anya-result-stack">
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
      <ResultCardList>
        {result.people.map((item, i) => (
          <PersonCard
            key={item.id}
            blurResults={blurResults}
            item={item}
            listIndex={i}
          />
        ))}
      </ResultCardList>
    </div>
  );
}
