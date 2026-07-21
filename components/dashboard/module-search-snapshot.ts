import type { BankSearchResult } from "@/lib/bank-search";
import type { BinLookupResult } from "@/lib/bin-lookup";
import type { CryptoWalletResult } from "@/lib/crypto-wallet";
import type {
  CryptoAddressIntelResult,
  CryptoFundFlowResult,
  CryptoRiskCheckResult,
  CryptoTxDeepDiveResult,
} from "@/lib/crypto-intel/types";
import type { IbanLookupResult } from "@/lib/iban-lookup";
import type { UsProviderSearchResult } from "@/lib/us-provider-directory";
import type { VinDecodeResult } from "@/lib/vin-decode";
import type {
  UsCourtSearchResult,
  UsIdentitySearchResult,
  UsVaSorSearchResult,
} from "@/lib/us-records";
import type { CombSearchResult } from "@/lib/proxynova-comb";
import type { DiscordSearchResult } from "@/lib/discord-profile";
import type { DomainSearchResult } from "@/lib/domain-search";
import type { SitePentestResult } from "@/lib/site-pentest-shared";
import type { FivemSearchResult } from "@/lib/fivem-search";
import type { RobloxSearchResult } from "@/lib/roblox-search";
import type { TinderLiveSearchResult } from "@/lib/tinder-live/types";
import type { UsernameAccountsSearchResult } from "@/lib/username-accounts/types";
import type { FormattedRecord } from "@/lib/search-utils";
import type { StealerArchiveEntry } from "@/lib/breachhub";
import type { StealerCredentialRow } from "@/lib/stealer-logs-view";
import type { AiIntelResult } from "@/lib/ai-intel";
import type { InstagramSearchPayload } from "@/components/dashboard/instagram-search-results";
import type { IntelxSearchPayload } from "@/components/dashboard/intelx-search-results";
import type { SearchJobPayload } from "@/components/dashboard/search-jobs-context";

export type StructuredSearchResult =
  | { kind: "crypto-wallet"; data: CryptoWalletResult }
  | { kind: "crypto-address"; data: CryptoAddressIntelResult }
  | { kind: "crypto-tx"; data: CryptoTxDeepDiveResult }
  | { kind: "crypto-risk"; data: CryptoRiskCheckResult }
  | { kind: "crypto-flow"; data: CryptoFundFlowResult }
  | { kind: "bin"; data: BinLookupResult }
  | { kind: "iban"; data: IbanLookupResult }
  | { kind: "bank"; data: BankSearchResult }
  | { kind: "vin"; data: VinDecodeResult }
  | { kind: "car-insurance"; data: UsProviderSearchResult }
  | { kind: "healthcare"; data: UsProviderSearchResult }
  | { kind: "us-court"; data: UsCourtSearchResult }
  | { kind: "us-identity"; data: UsIdentitySearchResult }
  | { kind: "us-npd"; data: UsIdentitySearchResult }
  | { kind: "us-va-sor"; data: UsVaSorSearchResult }
  | { kind: "us-global"; data: UsIdentitySearchResult }
  | { kind: "us-sanctions"; data: UsIdentitySearchResult }
  | { kind: "us-wanted"; data: UsIdentitySearchResult }
  | { kind: "us-sor-national"; data: UsVaSorSearchResult }
  | { kind: "us-state-directory"; data: UsIdentitySearchResult }
  | { kind: "us-portal-backlog"; data: UsIdentitySearchResult }
  | { kind: "us-intl-directory"; data: UsIdentitySearchResult }
  | { kind: "site-pentest"; data: SitePentestResult }
  | { kind: "tinder-live"; data: TinderLiveSearchResult }
  | { kind: "username-accounts"; data: UsernameAccountsSearchResult };

export type ModuleSearchSnapshot = {
  version: 1;
  query: string;
  error: string;
  emptyResult: string;
  records: FormattedRecord[];
  resultCount?: number;
  aiResult: AiIntelResult | null;
  combResult: CombSearchResult | null;
  domainResult: DomainSearchResult | null;
  discordResult: DiscordSearchResult | null;
  intelxResult: IntelxSearchPayload | null;
  fivemResult: FivemSearchResult | null;
  stealerResult: {
    credentials: StealerCredentialRow[];
    archives: StealerArchiveEntry[];
    count?: number;
    fallbackRecords?: FormattedRecord[];
  } | null;
  robloxResult: RobloxSearchResult | null;
  instagramResult: InstagramSearchPayload | null;
  structuredResult: StructuredSearchResult | null;
  rawResult: string;
  lastSearchLabel: string;
  blurResults: boolean;
};

export function emptyModuleSearchSnapshot(
  query: string,
  blurResults: boolean,
): ModuleSearchSnapshot {
  return {
    version: 1,
    query,
    error: "",
    emptyResult: "",
    records: [],
    resultCount: undefined,
    aiResult: null,
    combResult: null,
    domainResult: null,
    discordResult: null,
    intelxResult: null,
    fivemResult: null,
    stealerResult: null,
    robloxResult: null,
    instagramResult: null,
    structuredResult: null,
    rawResult: "",
    lastSearchLabel: "",
    blurResults,
  };
}

export function snapshotToPayload(
  snapshot: ModuleSearchSnapshot,
): SearchJobPayload {
  return snapshot as unknown as SearchJobPayload;
}

export function payloadToSnapshot(
  payload: SearchJobPayload | undefined,
): ModuleSearchSnapshot | null {
  if (!payload || payload.version !== 1) return null;

  return payload as unknown as ModuleSearchSnapshot;
}

export function formatResultSummary(snapshot: ModuleSearchSnapshot): string {
  if (snapshot.error) return snapshot.error;
  if (snapshot.emptyResult) return snapshot.emptyResult;

  if (typeof snapshot.resultCount === "number") {
    return `${snapshot.resultCount.toLocaleString()} result${snapshot.resultCount === 1 ? "" : "s"}`;
  }

  if (snapshot.stealerResult) {
    const count =
      snapshot.stealerResult.count ??
      Math.max(
        snapshot.stealerResult.credentials.length,
        snapshot.stealerResult.archives.length,
      );

    return `${count.toLocaleString()} result${count === 1 ? "" : "s"}`;
  }

  if (snapshot.combResult) {
    const count = snapshot.combResult.returned ?? 0;

    return `${count.toLocaleString()} result${count === 1 ? "" : "s"}`;
  }

  if (snapshot.records.length > 0) {
    return `${snapshot.records.length.toLocaleString()} result${snapshot.records.length === 1 ? "" : "s"}`;
  }

  if (snapshot.intelxResult) return "Export ready";
  if (snapshot.aiResult) return "AI analysis ready";
  if (snapshot.structuredResult) return "Results ready";
  if (snapshot.domainResult) return "Domain results ready";
  if (snapshot.discordResult) return "Discord results ready";
  if (snapshot.fivemResult) return "FiveM results ready";
  if (snapshot.robloxResult) return "Roblox results ready";
  if (snapshot.instagramResult) return "Instagram results ready";

  return "Done";
}
