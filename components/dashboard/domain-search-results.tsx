import { BreachesSearchResults } from "@/components/dashboard/breaches-search-results";
import { BlurredValue } from "@/components/dashboard/blurred-value";
import { SearchResultCards } from "@/components/dashboard/search-result-cards";
import type { DomainSearchResult } from "@/lib/domain-search";
import {
  countStealerLogRows,
  extractStealerLogEntries,
} from "@/lib/domain-search";
import { formatSearchRecords } from "@/lib/search-utils";

export function DomainSearchResults({
  result,
  blurResults = false,
  selectedExportIndex = null,
  onSelectExportIndex,
}: {
  result: DomainSearchResult;
  blurResults?: boolean;
  selectedExportIndex?: number | null;
  onSelectExportIndex?: (index: number) => void;
}) {
  const stealerHits = countStealerLogRows(result.stealerLogs.data);
  const breachHits = result.breachedData?.returned ?? 0;
  const stealerEntries = extractStealerLogEntries(result.stealerLogs.data);
  const stealerRecords = formatSearchRecords(stealerEntries);

  return (
    <div className="space-y-8">
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="anya-result-strip">
          <p className="anya-result-label">Domain</p>
          <p className="anya-result-value">
            <BlurredValue forceBlur={blurResults} text={result.domain} />
          </p>
        </div>
        <div className="anya-result-strip">
          <p className="anya-result-label">Stealer log hits</p>
          <p className="anya-result-value">
            <BlurredValue forceBlur={blurResults} text={stealerHits.toLocaleString()} />
          </p>
        </div>
        <div className="anya-result-strip">
          <p className="anya-result-label">Breached data hits</p>
          <p className="anya-result-value">
            <BlurredValue forceBlur={blurResults} text={breachHits.toLocaleString()} />
          </p>
        </div>
      </div>

      <section className="space-y-4">
        <div>
          <h3 className="font-[family-name:var(--font-bruno-ace-sc)] text-sm tracking-wide text-white">
            Stealer Logs
          </h3>
          <p className="text-xs text-zinc-500">
            Stealer indexes tied to {result.domain}
          </p>
        </div>
        {result.stealerLogs.error ? (
          <p className="border-l-2 border-amber-400/60 bg-amber-400/8 px-4 py-3 text-sm text-amber-100">
            {result.stealerLogs.error}
          </p>
        ) : stealerRecords.length > 0 ? (
          <SearchResultCards
            blurResults={blurResults}
            onSelectExportIndex={onSelectExportIndex}
            records={stealerRecords}
            selectedExportIndex={selectedExportIndex}
            totalCount={stealerHits}
          />
        ) : (
          <p className="text-sm text-zinc-500">No stealer log rows for this domain.</p>
        )}
      </section>

      <section className="space-y-4 border-t border-white/6 pt-8">
        <div>
          <h3 className="font-[family-name:var(--font-bruno-ace-sc)] text-sm tracking-wide text-white">
            Breached Data
          </h3>
          <p className="text-xs text-zinc-500">COMB credential index for {result.domain}</p>
        </div>
        {result.breachedDataError ? (
          <p className="border-l-2 border-amber-400/60 bg-amber-400/8 px-4 py-3 text-sm text-amber-100">
            {result.breachedDataError}
          </p>
        ) : result.breachedData ? (
          <BreachesSearchResults
            blurResults={blurResults}
            onSelectExportIndex={onSelectExportIndex}
            result={result.breachedData}
            selectedExportIndex={selectedExportIndex}
          />
        ) : (
          <p className="text-sm text-zinc-500">No breached credentials for this domain.</p>
        )}
      </section>
    </div>
  );
}
