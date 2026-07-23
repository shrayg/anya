import type { BankSearchResult } from "@/lib/bank-search";
import type { BinLookupResult } from "@/lib/bin-lookup";
import type { IbanLookupResult } from "@/lib/iban-lookup";
import type { UsProviderSearchResult } from "@/lib/us-provider-directory";
import type { VinDecodeResult } from "@/lib/vin-decode";

import { ResultCopyButton } from "@/components/dashboard/result-copy-button";
import { BlurredValue } from "@/components/dashboard/blurred-value";
import {
  ResultCard,
  ResultCardList,
  ResultStatStrip,
  type ResultCardFieldDef,
} from "@/components/dashboard/result-card";

type ResultRow = { label: string; value: string };

function compactRows(
  rows: Array<{ label: string; value: string | undefined }>,
): ResultRow[] {
  return rows.filter((row): row is ResultRow => Boolean(row.value));
}

export function BinSearchResults({
  result,
  blurResults = false,
}: {
  result: BinLookupResult;
  blurResults?: boolean;
}) {
  const rows = compactRows([
    { label: "BIN", value: result.bin },
    { label: "Scheme", value: result.scheme },
    { label: "Type", value: result.type },
    { label: "Brand", value: result.brand },
    { label: "Bank", value: result.bank },
    { label: "Country", value: result.country },
    { label: "Country code", value: result.countryCode },
    { label: "Currency", value: result.currency },
  ]);

  return <ResultGrid blurResults={blurResults} rows={rows} title="BIN lookup" />;
}

export function IbanSearchResults({
  result,
  blurResults = false,
}: {
  result: IbanLookupResult;
  blurResults?: boolean;
}) {
  const rows = compactRows([
    { label: "IBAN", value: result.iban },
    { label: "Valid", value: result.valid ? "Yes" : "No" },
    { label: "Bank", value: result.bankName },
    { label: "Bank code", value: result.bankCode },
    { label: "BIC / SWIFT", value: result.bic },
    { label: "City", value: result.city },
    { label: "ZIP", value: result.zip },
    ...(result.messages.length > 0
      ? [{ label: "Notes", value: result.messages.join(" · ") }]
      : []),
  ]);

  return (
    <ResultGrid blurResults={blurResults} rows={rows} title="IBAN lookup" />
  );
}

export function BankSearchResults({
  result,
  blurResults = false,
}: {
  result: BankSearchResult;
  blurResults?: boolean;
}) {
  return (
    <div className="anya-result-stack">
      <ResultStatStrip
        label="Matches"
        value={
          <BlurredValue
            forceBlur={blurResults}
            text={`${result.count.toLocaleString()} institutions`}
          />
        }
      />
      <ResultCardList>
        {result.banks.map((bank, i) => {
          const fields: ResultCardFieldDef[] = [];

          if (bank.city && bank.state) {
            fields.push({
              key: "location",
              label: "Location",
              value: `${bank.city}, ${bank.state} ${bank.zip ?? ""}`.trim(),
            });
          }
          if (bank.assets) {
            fields.push({ key: "assets", label: "Assets", value: bank.assets });
          }
          if (bank.offices) {
            fields.push({
              key: "offices",
              label: "Offices",
              value: String(bank.offices),
            });
          }
          if (bank.charter) {
            fields.push({
              key: "charter",
              label: "Charter",
              value: bank.charter,
            });
          }
          if (bank.website) {
            fields.push({
              key: "website",
              label: "Website",
              value: bank.website,
              highlight: true,
              block: true,
            });
          }

          return (
            <ResultCard
              key={`${bank.id ?? bank.name}-${bank.city}`}
              blurResults={blurResults}
              fields={fields}
              indexLabel={i + 1}
              listIndex={i}
              subtitle={bank.city && bank.state ? `${bank.city}, ${bank.state}` : undefined}
              title={bank.name}
            />
          );
        })}
      </ResultCardList>
    </div>
  );
}

export function VinSearchResults({
  result,
  blurResults = false,
}: {
  result: VinDecodeResult;
  blurResults?: boolean;
}) {
  const rows = Object.entries(result.fields).map(([label, value]) => ({
    label,
    value,
  }));
  const copyText = [
    `VIN: ${result.vin}`,
    ...rows.map((row) => `${row.label}: ${row.value}`),
  ].join("\n");
  const fields: ResultCardFieldDef[] = [
    { key: "vin", label: "VIN", value: result.vin, highlight: true },
    ...rows.map((row) => ({
      key: row.label,
      label: row.label,
      value: row.value,
    })),
  ];

  return (
    <div className="anya-result-stack">
      <ResultCardList>
        <ResultCard
          blurResults={blurResults}
          copyText={copyText}
          fields={fields}
          listIndex={0}
          title="VIN decode"
        />
      </ResultCardList>
      {result.errorText && (
        <p className="text-xs text-zinc-500">
          <BlurredValue forceBlur={blurResults} text={result.errorText} />
        </p>
      )}
    </div>
  );
}

export function UsProviderSearchResults({
  result,
  blurResults = false,
}: {
  result: UsProviderSearchResult;
  blurResults?: boolean;
}) {
  return (
    <div className="anya-result-stack">
      <ResultStatStrip
        label="Matches"
        value={
          <BlurredValue
            forceBlur={blurResults}
            text={`${result.count.toLocaleString()} providers`}
          />
        }
      />
      <ResultCardList>
        {result.providers.map((provider, i) => {
          const fields: ResultCardFieldDef[] = [];

          if (provider.coverage) {
            fields.push({
              key: "coverage",
              label: "Coverage",
              value: provider.coverage,
            });
          }
          if (provider.headquarters) {
            fields.push({
              key: "hq",
              label: "HQ",
              value: provider.headquarters,
            });
          }
          if (provider.phone) {
            fields.push({
              key: "phone",
              label: "Phone",
              value: provider.phone,
            });
          }
          if (provider.website) {
            fields.push({
              key: "website",
              label: "Website",
              value: provider.website,
              highlight: true,
              block: true,
            });
          }
          if (provider.notes) {
            fields.push({
              key: "notes",
              label: "Notes",
              value: provider.notes,
              block: true,
            });
          }

          return (
            <ResultCard
              key={provider.name}
              badge={provider.category}
              blurResults={blurResults}
              fields={fields}
              indexLabel={i + 1}
              listIndex={i}
              title={provider.name}
            />
          );
        })}
      </ResultCardList>
    </div>
  );
}

function ResultGrid({
  rows,
  blurResults = false,
  title = "Lookup",
}: {
  rows: { label: string; value: string }[];
  blurResults?: boolean;
  title?: string;
}) {
  const copyText = rows.map((row) => `${row.label}: ${row.value}`).join("\n");
  const fields: ResultCardFieldDef[] = rows.map((row) => ({
    key: row.label,
    label: row.label,
    value: row.value,
  }));

  return (
    <div className="anya-result-stack">
      <div className="anya-result-stack-toolbar">
        <p className="anya-result-stack-meta">
          {rows.length} field{rows.length === 1 ? "" : "s"}
        </p>
        <ResultCopyButton label="Copy all" text={copyText} />
      </div>
      <ResultCardList>
        <ResultCard
          blurResults={blurResults}
          copyText={copyText}
          fields={fields}
          listIndex={0}
          title={title}
        />
      </ResultCardList>
    </div>
  );
}
