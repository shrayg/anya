import type { BankSearchResult } from "@/lib/bank-search";
import type { BinLookupResult } from "@/lib/bin-lookup";
import type { IbanLookupResult } from "@/lib/iban-lookup";
import type { UsProviderSearchResult } from "@/lib/us-provider-directory";
import type { VinDecodeResult } from "@/lib/vin-decode";

import { ResultCopyButton } from "@/components/dashboard/result-copy-button";
import { BlurredValue } from "@/components/dashboard/blurred-value";

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

  return <ResultGrid blurResults={blurResults} rows={rows} />;
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

  return <ResultGrid blurResults={blurResults} rows={rows} />;
}

export function BankSearchResults({
  result,
  blurResults = false,
}: {
  result: BankSearchResult;
  blurResults?: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="anya-result-strip">
        <p className="anya-result-label">Matches</p>
        <p className="anya-result-value">
          <BlurredValue
            forceBlur={blurResults}
            text={`${result.count.toLocaleString()} institutions`}
          />
        </p>
      </div>
      <div className="grid gap-3">
        {result.banks.map((bank) => (
          <div
            key={`${bank.id ?? bank.name}-${bank.city}`}
            className="anya-result-strip space-y-2"
          >
            <p className="anya-result-label">Institution</p>
            <p className="anya-result-value text-base">
              <BlurredValue forceBlur={blurResults} text={bank.name} />
            </p>
            <div className="grid gap-2 text-sm text-zinc-300 md:grid-cols-2">
              {bank.city && bank.state && (
                <span>
                  <BlurredValue
                    forceBlur={blurResults}
                    text={`${bank.city}, ${bank.state} ${bank.zip ?? ""}`}
                  />
                </span>
              )}
              {bank.assets && (
                <span>
                  <BlurredValue
                    forceBlur={blurResults}
                    text={`Assets: ${bank.assets}`}
                  />
                </span>
              )}
              {bank.offices && (
                <span>
                  <BlurredValue
                    forceBlur={blurResults}
                    text={`Offices: ${bank.offices}`}
                  />
                </span>
              )}
              {bank.charter && (
                <span>
                  <BlurredValue
                    forceBlur={blurResults}
                    text={`Charter: ${bank.charter}`}
                  />
                </span>
              )}
              {bank.website && (
                <span className="break-all text-anya-accent">
                  <BlurredValue forceBlur={blurResults} text={bank.website} />
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
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

  return (
    <div className="space-y-4">
      <div className="anya-result-strip">
        <p className="anya-result-label">VIN</p>
        <p className="anya-result-value font-mono">
          <BlurredValue forceBlur={blurResults} text={result.vin} />
        </p>
      </div>
      <ResultGrid blurResults={blurResults} rows={rows} />
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
    <div className="space-y-4">
      <div className="anya-result-strip">
        <p className="anya-result-label">Matches</p>
        <p className="anya-result-value">
          <BlurredValue
            forceBlur={blurResults}
            text={`${result.count.toLocaleString()} providers`}
          />
        </p>
      </div>
      <div className="grid gap-3">
        {result.providers.map((provider) => (
          <div key={provider.name} className="anya-result-strip space-y-2">
            <p className="anya-result-label">{provider.category}</p>
            <p className="anya-result-value text-base">
              <BlurredValue forceBlur={blurResults} text={provider.name} />
            </p>
            <div className="grid gap-2 text-sm text-zinc-300 md:grid-cols-2">
              {provider.coverage && (
                <span>
                  <BlurredValue
                    forceBlur={blurResults}
                    text={`Coverage: ${provider.coverage}`}
                  />
                </span>
              )}
              {provider.headquarters && (
                <span>
                  <BlurredValue
                    forceBlur={blurResults}
                    text={`HQ: ${provider.headquarters}`}
                  />
                </span>
              )}
              {provider.phone && (
                <span>
                  <BlurredValue
                    forceBlur={blurResults}
                    text={`Phone: ${provider.phone}`}
                  />
                </span>
              )}
              {provider.website && (
                <span className="break-all text-anya-accent">
                  <BlurredValue
                    forceBlur={blurResults}
                    text={provider.website}
                  />
                </span>
              )}
              {provider.notes && (
                <span className="md:col-span-2 text-zinc-400">
                  <BlurredValue forceBlur={blurResults} text={provider.notes} />
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResultGrid({
  rows,
  blurResults = false,
}: {
  rows: { label: string; value: string }[];
  blurResults?: boolean;
}) {
  const copyText = rows.map((row) => `${row.label}: ${row.value}`).join("\n");

  return (
    <div className="anya-result-stack">
      <div className="anya-result-stack-toolbar">
        <p className="anya-result-stack-meta">
          {rows.length} field{rows.length === 1 ? "" : "s"}
        </p>
        <ResultCopyButton label="Copy all" text={copyText} />
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label} className="anya-result-strip">
            <div className="anya-result-field-head">
              <p className="anya-result-label">{row.label}</p>
              <ResultCopyButton compact text={row.value} />
            </div>
            <p className="anya-result-value">
              <BlurredValue forceBlur={blurResults} text={row.value} />
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
