"use client";

import { apiFetch } from "@/lib/csrf-client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, FolderPlus, Home } from "lucide-react";

import { SearchBarTour } from "@/components/search-bar-tour";
import { BreachesSearchResults } from "@/components/dashboard/breaches-search-results";
import { CryptoWalletResults } from "@/components/dashboard/crypto-wallet-results";
import {
  BankSearchResults,
  BinSearchResults,
  IbanSearchResults,
  UsProviderSearchResults,
  VinSearchResults,
} from "@/components/dashboard/financial-search-results";
import {
  UsCourtSearchResults,
  UsIdentitySearchResults,
  UsVaSorSearchResults,
} from "@/components/dashboard/us-records-search-results";
import {
  InstagramSearchResults,
  type InstagramSearchPayload,
} from "@/components/dashboard/instagram-search-results";
import { DiscordSearchResults } from "@/components/dashboard/discord-search-results";
import { FivemSearchResults } from "@/components/dashboard/fivem-search-results";
import { RobloxSearchResults } from "@/components/dashboard/roblox-search-results";
import { DomainSearchResults } from "@/components/dashboard/domain-search-results";
import {
  IntelxSearchResults,
  type IntelxSearchPayload,
} from "@/components/dashboard/intelx-search-results";
import dynamic from "next/dynamic";
import { ModuleStatusDot } from "@/components/dashboard/module-status-dot";
import { AiSearchResults } from "@/components/dashboard/ai-search-results";
import { CryptoAiChatResults } from "@/components/dashboard/crypto-ai-chat-results";
import { useDashboardUser } from "@/components/dashboard/dashboard-auth-provider";
import { CasePicker } from "@/components/dashboard/case-picker";
import { aiModeFromSidebarItem, type AiIntelResult } from "@/lib/ai-intel";
import type { BankSearchResult } from "@/lib/bank-search";
import type { BinLookupResult } from "@/lib/bin-lookup";
import type { CryptoWalletResult } from "@/lib/crypto-wallet";
import {
  CRYPTO_WALLET_INVALID_MESSAGE,
  detectCryptoChain,
} from "@/lib/crypto-wallet";
import type { IbanLookupResult } from "@/lib/iban-lookup";
import type { UsProviderSearchResult } from "@/lib/us-provider-directory";
import type { VinDecodeResult } from "@/lib/vin-decode";
import type {
  UsCourtSearchResult,
  UsIdentitySearchResult,
  UsVaSorSearchResult,
} from "@/lib/us-records";
import type { CombCredential, CombSearchResult } from "@/lib/proxynova-comb";
import { normalizeEmail } from "@/lib/proxynova-comb";
import { sanitizePublicContent, sanitizePublicText } from "@/lib/public-branding";
import { isDiscordSnowflake } from "@/lib/osintcat";
import type { DiscordSearchResult } from "@/lib/discord-profile";
import { normalizeInstagramUsername } from "@/lib/instagram-username";
import { DASHBOARD_TOUR_STORAGE_KEY } from "@/lib/dashboard-tour";
import { isDatingAppSlug, normalizeDatingQuery } from "@/lib/dating-search";
import type { DomainSearchResult } from "@/lib/domain-search";
import { extractStealerLogEntries, normalizeDomain } from "@/lib/domain-search";
import type { SitePentestResult } from "@/lib/site-pentest-shared";
import {
  defaultSitePentestModules,
  parseSitePentestTarget,
} from "@/lib/site-pentest-shared";
import type { FivemSearchResult } from "@/lib/fivem-search";
import type { RobloxSearchResult } from "@/lib/roblox-search";
import { checkModuleAccess, resolveUserPlan, shouldBlurResults } from "@/lib/plans";
import {
  getAiModeForModule,
  isPhoneQuery,
  resolveSearchApiType,
  type SearchModuleDef,
} from "@/lib/search-modules";
import {
  WORKSPACE_SEARCH_TOUR_STEPS,
  WORKSPACE_SEARCH_TOUR_STORAGE_KEY,
} from "@/lib/search-tour";
import { ResultExportControls } from "@/components/dashboard/result-export-controls";
import { SearchEmptyState } from "@/components/dashboard/search-empty-state";
import { SearchResultCards } from "@/components/dashboard/search-result-cards";
import type { FormattedRecord } from "@/lib/search-utils";
import { formatSearchRecords, formatStructuredSearchData } from "@/lib/search-utils";
import {
  downloadExportFile,
  formatBreachCredentialAsExport,
  formatBreachCredentialsAsExport,
  formatRawAsExport,
  formatRecordAsExport,
  formatRecordsAsExport,
  safeExportFilename,
  type ExportFormat,
} from "@/lib/export-intel";

const SitePentestResults = dynamic(
  () =>
    import("@/components/dashboard/site-pentest-results").then(
      (mod) => mod.SitePentestResults,
    ),
  { ssr: false },
);
type StructuredResult =
  | { kind: "crypto-wallet"; data: CryptoWalletResult }
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
  | { kind: "site-pentest"; data: SitePentestResult };
const PUBLIC_RECORDS_COMPOSE_KINDS = new Set([
  "us-identity",
  "us-npd",
  "us-global",
  "us-sanctions",
  "us-wanted",
  "us-state-directory",
  "us-portal-backlog",
  "us-intl-directory",
]);

const PUBLIC_RECORDS_COMPOSE_TITLES: Record<string, string> = {
  "us-identity": "Public identity hits",
  "us-npd": "NPD composed dossier",
  "us-global": "Global public records dossier",
  "us-sanctions": "Sanctions & watchlists",
  "us-wanted": "Wanted persons",
  "us-state-directory": "US state records directory",
  "us-portal-backlog": "Portal adapter backlog",
  "us-intl-directory": "International records directory",
};

type CaseOption = {
  id: number;
  title: string;
  subjectName: string;
};

export function ModuleSearchView({ moduleDef }: { moduleDef: SearchModuleDef }) {
  const profile = useDashboardUser();
  const plan = resolveUserPlan(profile);
  const balance = profile.balance ?? 0;

  const isAi = moduleDef.module === "ai";
  const aiMode = (() => {
    const fromModule = getAiModeForModule(moduleDef);
    if (fromModule !== "auto" && fromModule !== "search") return fromModule;
    if (fromModule === "search") return "search";
    return aiModeFromSidebarItem(moduleDef.name);
  })();
  const isSummary = aiMode === "summary";

  const [query, setQuery] = useState("");
  const [selectedToolId, setSelectedToolId] = useState(
    moduleDef.tools?.[0]?.id ?? "",
  );

  useEffect(() => {
    setSelectedToolId(moduleDef.tools?.[0]?.id ?? "");
  }, [moduleDef.slug, moduleDef.tools]);

  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState("");
  const [emptyResult, setEmptyResult] = useState("");
  const [records, setRecords] = useState<FormattedRecord[]>([]);
  const [resultCount, setResultCount] = useState<number | undefined>(undefined);
  const [aiResult, setAiResult] = useState<AiIntelResult | null>(null);
  const [combResult, setCombResult] = useState<CombSearchResult | null>(null);
  const [domainResult, setDomainResult] = useState<DomainSearchResult | null>(null);
  const [discordResult, setDiscordResult] = useState<DiscordSearchResult | null>(null);
  const [intelxResult, setIntelxResult] = useState<IntelxSearchPayload | null>(null);
  const [fivemResult, setFivemResult] = useState<FivemSearchResult | null>(null);
  const [robloxResult, setRobloxResult] = useState<RobloxSearchResult | null>(null);
  const [instagramResult, setInstagramResult] = useState<InstagramSearchPayload | null>(null);
  const [instagramEnriching, setInstagramEnriching] = useState(false);
  const [instagramLoadingMore, setInstagramLoadingMore] = useState(false);
  const [instagramProgressLabel, setInstagramProgressLabel] = useState("");
  const instagramLoadGenRef = useRef(0);
  const [structuredResult, setStructuredResult] = useState<StructuredResult | null>(null);
  const [rawResult, setRawResult] = useState("");
  const [lastSearchLabel, setLastSearchLabel] = useState("");
  const [caseOptions, setCaseOptions] = useState<CaseOption[]>([]);
  const [saveCaseId, setSaveCaseId] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [workspaceSearchTourReady, setWorkspaceSearchTourReady] = useState(false);

  useEffect(() => {
    const isDashboardTourDone = () => {
      try {
        return localStorage.getItem(DASHBOARD_TOUR_STORAGE_KEY) === "done";
      } catch {
        return false;
      }
    };

    if (isDashboardTourDone()) {
      setWorkspaceSearchTourReady(true);
      return;
    }

    const timer = window.setInterval(() => {
      if (isDashboardTourDone()) {
        setWorkspaceSearchTourReady(true);
        window.clearInterval(timer);
      }
    }, 500);

    const stop = window.setTimeout(() => window.clearInterval(timer), 120_000);

    return () => {
      window.clearInterval(timer);
      window.clearTimeout(stop);
    };
  }, []);
  const [savingToCase, setSavingToCase] = useState(false);
  const [blurResults, setBlurResults] = useState(false);
  const [selectedExportIndex, setSelectedExportIndex] = useState<number | null>(null);
  const [casesLoaded, setCasesLoaded] = useState(false);
  const [pentestModules, setPentestModules] = useState(() =>
    defaultSitePentestModules(),
  );
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const moduleLocked = useMemo(() => {
    const access = checkModuleAccess(plan, moduleDef.slug, { balance });

    if (access.allowed) {
      return null;
    }

    return access.reason || "This module is not available on your plan.";
  }, [balance, moduleDef.slug, plan]);

  const hasSelectableCards = useMemo(
    () =>
      records.length > 0 ||
      Boolean(combResult) ||
      Boolean(robloxResult) ||
      Boolean(instagramResult) ||
      Boolean(fivemResult) ||
      Boolean(domainResult),
    [combResult, domainResult, fivemResult, instagramResult, records.length, robloxResult],
  );

  const handleSelectExportIndex = (index: number) => {
    setSelectedExportIndex(index < 0 ? null : index);
  };

  const resolveSelectedExport = ():
    | { kind: "record"; record: FormattedRecord }
    | { kind: "breach"; row: CombCredential; index: number }
    | null => {
    if (selectedExportIndex === null) return null;

    if (records.length > 0) {
      const record = records.find((entry) => entry.index === selectedExportIndex);
      if (record) return { kind: "record", record };
    }

    if (combResult) {
      const row = combResult.credentials[selectedExportIndex - 1];
      if (row) return { kind: "breach", row, index: selectedExportIndex };
    }

    if (robloxResult) {
      const robloxRecords = formatSearchRecords(robloxResult.results);
      const record = robloxRecords.find((entry) => entry.index === selectedExportIndex);
      if (record) return { kind: "record", record };
    }

    if (fivemResult) {
      const pools = [
        ...formatSearchRecords(fivemResult.accounts.records),
        ...formatSearchRecords(fivemResult.bans.records),
      ];
      const record = pools.find((entry) => entry.index === selectedExportIndex);
      if (record) return { kind: "record", record };
    }

    if (domainResult) {
      const stealerRecords = formatSearchRecords(
        extractStealerLogEntries(domainResult.stealerLogs.data),
      );
      const stealerRecord = stealerRecords.find((entry) => entry.index === selectedExportIndex);
      if (stealerRecord) return { kind: "record", record: stealerRecord };

      const breachRow = domainResult.breachedData?.credentials[selectedExportIndex - 1];
      if (breachRow) {
        return { kind: "breach", row: breachRow, index: selectedExportIndex };
      }
    }

    return null;
  };

  const canExportAll = Boolean(
    rawResult || records.length > 0 || combResult?.credentials?.length,
  );

  const handleExportAll = (format: ExportFormat) => {
    if (!canExportAll) return;

    const filename = safeExportFilename(lastSearchLabel || moduleDef.slug, format);
    let content: string;

    if (records.length > 0) {
      content = formatRecordsAsExport(records, format, lastSearchLabel);
    } else if (combResult?.credentials?.length) {
      content = formatBreachCredentialsAsExport(
        combResult.credentials,
        format,
        lastSearchLabel,
      );
    } else if (rawResult) {
      content = formatRawAsExport(rawResult, format, lastSearchLabel);
    } else {
      return;
    }

    downloadExportFile(filename, content, format);
  };

  const handleExportSelected = (format: ExportFormat) => {
    const selected = resolveSelectedExport();
    if (!selected) return;

    const filename = safeExportFilename(
      `${lastSearchLabel || moduleDef.slug}-record-${selectedExportIndex}`,
      format,
    );

    const content =
      selected.kind === "record"
        ? formatRecordAsExport(selected.record, format, lastSearchLabel)
        : formatBreachCredentialAsExport(
            selected.row,
            selected.index,
            format,
            lastSearchLabel,
          );

    downloadExportFile(filename, content, format);
  };

  const handleInstagramEnrichBios = async () => {
    if (!instagramResult?.query || instagramEnriching || instagramLoadingMore) return;

    setInstagramEnriching(true);
    setError("");

    try {
      const response = await fetch(
        `/api/osint/instagram?query=${encodeURIComponent(instagramResult.query)}&moduleSlug=instagram&maxUsers=500&enrichBios=1&bioLimit=60&bubbleMap=1&includeActivity=1&maxPosts=12&maxTagged=12&commentPosts=4&secondDegree=1&secondDegreeBudget=12`,
      );
      const responseText = await response.text();
      let data: InstagramSearchPayload & { error?: string };
      try {
        data = responseText
          ? (JSON.parse(responseText) as InstagramSearchPayload & { error?: string })
          : ({ error: "Empty response" } as InstagramSearchPayload & {
              error?: string;
            });
      } catch {
        setError(
          `Could not enrich Instagram bios (HTTP ${response.status}). Try again.`,
        );
        return;
      }

      if (!response.ok || data.error) {
        setError(data.error || "Could not enrich Instagram bios.");
        return;
      }

      setInstagramResult({
        ...data,
        mutuals: data.mutuals ?? [],
      });
      setRawResult(JSON.stringify(data, null, 2));
    } catch {
      setError("Could not enrich Instagram bios.");
    } finally {
      setInstagramEnriching(false);
    }
  };

  useEffect(() => {
    const hasResults =
      records.length > 0 ||
      aiResult ||
      combResult ||
      domainResult ||
      discordResult ||
      fivemResult ||
      robloxResult ||
      instagramResult ||
      structuredResult;

    if (!hasResults || casesLoaded) {
      return;
    }

    let cancelled = false;

    fetch("/api/cases")
      .then((response) => response.json())
      .then((data) => {
        if (cancelled || !isMountedRef.current) return;

        if (Array.isArray(data.cases)) {
          setCaseOptions(data.cases);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled && isMountedRef.current) {
          setCasesLoaded(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    aiResult,
    casesLoaded,
    combResult,
    discordResult,
    fivemResult,
    robloxResult,
    instagramResult,
    domainResult,
    records.length,
    structuredResult,
  ]);

  const authorizeSearch = async () => {
    const response = await apiFetch("/api/user/search/authorize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ moduleSlug: moduleDef.slug }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return {
        allowed: false,
        reason: data.error || "Could not verify search access.",
      };
    }

    return response.json() as Promise<{
      allowed: boolean;
      reason?: string;
      blurResults?: boolean;
    }>;
  };

  const recordSearch = async (trimmed: string, type: string, resultData: string) => {
    const response = await apiFetch("/api/user/stats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: trimmed,
        type,
        moduleSlug: moduleDef.slug,
        resultData,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Could not record search usage.");
    }

    if (isMountedRef.current && data.blurResults) {
      setBlurResults(true);
    }
  };

  const persistSearch = (trimmed: string, type: string, resultData: string) => {
    window.setTimeout(() => {
      void recordSearch(trimmed, type, resultData).catch((error) => {
        console.error(error);
      });
    }, 0);
  };

  const handleSearch = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmed = query.trim();
    const searchQuery = isDatingAppSlug(moduleDef.slug)
      ? normalizeDatingQuery(trimmed, moduleDef.slug)
      : trimmed;

    if (!trimmed || isSearching) return;

    setIsSearching(true);
    setError("");
    setEmptyResult("");
    setRecords([]);
    setResultCount(undefined);
    setAiResult(null);
    setCombResult(null);
    setDomainResult(null);
    setDiscordResult(null);
    setIntelxResult(null);
    setFivemResult(null);
    setRobloxResult(null);
    setInstagramResult(null);
    setInstagramEnriching(false);
    setInstagramLoadingMore(false);
    setInstagramProgressLabel("");
    instagramLoadGenRef.current += 1;
    setStructuredResult(null);
    setRawResult("");
    setSaveMessage("");
    setCasesLoaded(false);
    setBlurResults(shouldBlurResults(plan));
    setSelectedExportIndex(null);

    const markNoResults = (message?: string | null) => {
      setEmptyResult(
        (typeof message === "string" && message.trim()) ||
          "No results were found.",
      );
      setLastSearchLabel(`${moduleDef.name} · ${trimmed}`);
    };

    if (moduleLocked) {
      setError(moduleLocked);
      setIsSearching(false);
      return;
    }

    const access = await authorizeSearch();

    if (!isMountedRef.current) return;

    if (!access.allowed) {
      setError(access.reason || "This search is not available on your plan.");
      setIsSearching(false);
      return;
    }

    if (access.allowed && "blurResults" in access && access.blurResults) {
      setBlurResults(true);
    }

    if (isAi) {
      try {
        const searchResponse = await fetch(
          `/api/osint/ai?query=${encodeURIComponent(trimmed)}&mode=${aiMode}&moduleSlug=${encodeURIComponent(moduleDef.slug)}`,
        );
        const data = (await searchResponse.json()) as AiIntelResult & {
          error?: string;
        };

        if (!isMountedRef.current) return;

        if (!searchResponse.ok) {
          setError(data.error || "AI analysis failed.");
          return;
        }

        setAiResult(data);
        setRawResult(JSON.stringify(data, null, 2));
        setLastSearchLabel(`${moduleDef.name} · ${trimmed}`);
        persistSearch(trimmed, moduleDef.slug, JSON.stringify(data));
      } catch {
        if (isMountedRef.current) {
          setError("Could not complete AI analysis.");
        }
      } finally {
        if (isMountedRef.current) {
          setIsSearching(false);
        }
      }

      return;
    }

    let activeType = resolveSearchApiType(moduleDef, trimmed);
    const selectedTool = moduleDef.tools?.find((tool) => tool.id === selectedToolId);
    if (selectedTool?.apiType) {
      activeType = selectedTool.apiType;
    }

    if (activeType === "breaches" && !normalizeEmail(trimmed)) {
      setError("Enter a valid email address.");
      setIsSearching(false);
      return;
    }

    if (activeType === "crypto-wallet" && !detectCryptoChain(trimmed)) {
      setError(CRYPTO_WALLET_INVALID_MESSAGE);
      setIsSearching(false);
      return;
    }

    if (moduleDef.slug === "phone" && !isPhoneQuery(trimmed)) {
      setError("Enter a valid phone number (10–15 digits).");
      setIsSearching(false);
      return;
    }

    if (moduleDef.slug === "username" && trimmed.length < 2) {
      setError("Enter a username (at least 2 characters).");
      setIsSearching(false);
      return;
    }

    if (moduleDef.slug === "stealer-logs" && isDiscordSnowflake(trimmed)) {
      setError("Discord IDs are not supported here. Use the Discord ID module.");
      setIsSearching(false);
      return;
    }

    if (moduleDef.slug === "discord-id" && !isDiscordSnowflake(trimmed)) {
      setError("Enter a valid Discord snowflake ID (17–20 digits).");
      setIsSearching(false);
      return;
    }

    if (moduleDef.slug === "oathnet-roblox" && !isDiscordSnowflake(trimmed)) {
      setError("Enter a valid Discord snowflake ID (17–20 digits).");
      setIsSearching(false);
      return;
    }

    if (moduleDef.slug === "fraud-footprint") {
      const tool = moduleDef.tools?.find((t) => t.id === selectedToolId);
      const api = tool?.apiType || "seon-email";
      if (api === "seon-email" && !normalizeEmail(trimmed)) {
        setError("Enter a valid email address.");
        setIsSearching(false);
        return;
      }
      if (api === "seon-phone" && !isPhoneQuery(trimmed)) {
        setError("Enter a valid phone number (10–15 digits).");
        setIsSearching(false);
        return;
      }
    }

    if (moduleDef.slug === "fivem" && !isDiscordSnowflake(trimmed)) {
      setError("FiveM lookups require a Discord snowflake ID (17–20 digits).");
      setIsSearching(false);
      return;
    }

    if (moduleDef.slug === "instagram" && !normalizeInstagramUsername(trimmed)) {
      setError("Enter a valid Instagram username or profile URL.");
      setIsSearching(false);
      return;
    }

    if (moduleDef.slug === "domain" && !normalizeDomain(trimmed)) {
      setError("Enter a valid domain name (e.g. example.com).");
      setIsSearching(false);
      return;
    }

    if (moduleDef.slug === "site-pentest" && !parseSitePentestTarget(trimmed)) {
      setError("Enter a valid domain or http(s) URL (e.g. example.com).");
      setIsSearching(false);
      return;
    }

    if (moduleDef.slug === "hash-lookup" && trimmed.length < 8) {
      setError("Enter a valid hash (at least 8 characters).");
      setIsSearching(false);
      return;
    }

    if (moduleDef.slug === "password-search" && trimmed.length < 3) {
      setError("Enter a password to search (at least 3 characters).");
      setIsSearching(false);
      return;
    }

    if (moduleDef.slug === "name-search" && trimmed.length < 2) {
      setError("Enter a name to search (at least 2 characters).");
      setIsSearching(false);
      return;
    }

    if (moduleDef.slug === "stealer-logs" && normalizeDomain(trimmed)) {
      activeType = "domains";
    }

    try {
      const scopeParam = `&scope=${encodeURIComponent(moduleDef.slug)}`;
      const moduleParam = `&moduleSlug=${encodeURIComponent(moduleDef.slug)}`;
      // Progressive Instagram load: first ~100 for fast map paint, then paced
      // batches up to 500 so we self-rate-limit instead of scraping thousands.
      const instagramParam =
        activeType === "instagram"
          ? "&maxUsers=100&includeActivity=0&enrichBios=0"
          : "";
      const pentestParam =
        activeType === "site-pentest"
          ? `&modules=${encodeURIComponent(pentestModules.join(","))}`
          : "";
      const searchResponse = await fetch(
        `/api/osint/${activeType}?query=${encodeURIComponent(searchQuery)}${scopeParam}${moduleParam}${instagramParam}${pentestParam}`,
      );
      const responseText = await searchResponse.text();
      let data: Record<string, unknown> = {};
      try {
        data = responseText ? (JSON.parse(responseText) as Record<string, unknown>) : {};
      } catch {
        setError(
          searchResponse.ok
            ? "Search returned an unexpected response. Try again."
            : searchResponse.status === 502 ||
                searchResponse.status === 504 ||
                searchResponse.status === 503
              ? "Search timed out or the upstream index was unreachable. Try again in a moment."
              : `Search failed (HTTP ${searchResponse.status}). Try again.`,
        );
        return;
      }

      if (!isMountedRef.current) return;

      if (!searchResponse.ok) {
        setError(
          sanitizePublicText(
            typeof data.error === "string" ? data.error : "Search failed.",
          ),
        );
        return;
      }

      const serialized = JSON.stringify(data);

      if (activeType === "breaches") {
        const breachData = data as CombSearchResult & {
          error?: string;
          message?: string;
          hasGodsEyeReport?: boolean;
          godseyeReport?: Record<string, unknown> | null;
          hasBreachVipResults?: boolean;
          breachVipCount?: number;
        };

        if (
          breachData.returned === 0 &&
          !breachData.hasGodsEyeReport &&
          !breachData.hasBreachVipResults
        ) {
          markNoResults(breachData.message);
          return;
        }

        setCombResult(breachData);
        setRawResult(JSON.stringify(breachData, null, 2));
        setLastSearchLabel(`${moduleDef.name} · ${trimmed}`);
        persistSearch(trimmed, moduleDef.slug, serialized);
        return;
      }

      if (activeType === "domains") {
        const domainData = data as DomainSearchResult & {
          error?: string;
          message?: string;
        };

        if (!domainData.hasResults) {
          markNoResults(
            domainData.message ||
              "No stealer logs or breached data found for this domain.",
          );
          return;
        }

        setDomainResult(domainData);
        setRawResult(JSON.stringify(domainData, null, 2));
        setLastSearchLabel(`${moduleDef.name} · ${trimmed}`);
        persistSearch(trimmed, moduleDef.slug, serialized);
        return;
      }

      if (activeType === "fivem") {
        const fivemData = data as FivemSearchResult & {
          error?: string;
          message?: string;
        };

        if (!fivemData.hasResults && !fivemData.profile) {
          markNoResults(
            sanitizePublicText(
              fivemData.error ||
                fivemData.message ||
                fivemData.accounts.error ||
                fivemData.bans.error ||
                "No FiveM results found for this Discord ID.",
            ),
          );
          return;
        }

        setFivemResult(fivemData);
        setRawResult(JSON.stringify(fivemData, null, 2));
        setLastSearchLabel(`${moduleDef.name} · ${trimmed}`);
        persistSearch(trimmed, moduleDef.slug, serialized);
        return;
      }

      if (activeType === "roblox") {
        const robloxData = data as RobloxSearchResult & {
          error?: string;
          message?: string;
          discordToRoblox?: Record<string, unknown> | null;
        };
        const hasResults =
          Array.isArray(robloxData.results) && robloxData.results.length > 0;
        const hasLinked =
          (Array.isArray(robloxData.linkedDiscordIds) &&
            robloxData.linkedDiscordIds.length > 0) ||
          (Array.isArray(robloxData.linkedDiscord) &&
            robloxData.linkedDiscord.length > 0);
        const hasDiscordToRoblox = Boolean(
          robloxData.discordToRoblox &&
            (typeof robloxData.discordToRoblox.username === "string" ||
              typeof robloxData.discordToRoblox.userId === "string" ||
              typeof robloxData.discordToRoblox.profileUrl === "string"),
        );

        if (robloxData.error) {
          setError(robloxData.error);
          return;
        }

        if (!hasResults && !hasLinked && !hasDiscordToRoblox) {
          markNoResults(robloxData.message);
          return;
        }

        setRobloxResult(robloxData);
        setRawResult(JSON.stringify(robloxData, null, 2));
        setLastSearchLabel(`${moduleDef.name} · ${trimmed}`);
        persistSearch(trimmed, moduleDef.slug, serialized);
        return;
      }

      if (activeType === "oathnet-roblox") {
        const linkData = data as {
          results?: unknown[];
          count?: number;
          message?: string;
          error?: string;
        };
        const results = Array.isArray(linkData.results) ? linkData.results : [];

        if (results.length === 0) {
          markNoResults(linkData.message || linkData.error);
          return;
        }

        const formatted = formatSearchRecords(results);
        setRecords(formatted);
        setResultCount(
          typeof linkData.count === "number" ? linkData.count : results.length,
        );
        setRawResult(JSON.stringify(data, null, 2));
        setLastSearchLabel(`${moduleDef.name} · ${trimmed}`);
        persistSearch(trimmed, moduleDef.slug, serialized);
        return;
      }

      if (activeType === "instagram") {
        const instagramData = data as InstagramSearchPayload & {
          error?: string;
          message?: string;
        };

        if (instagramData.error) {
          setError(instagramData.error);
          return;
        }

        const hasGraph =
          (instagramData.followers?.length ?? 0) > 0 ||
          (instagramData.following?.length ?? 0) > 0 ||
          Boolean(instagramData.profile) ||
          Boolean(instagramData.activity?.postsAnalyzed) ||
          Boolean(instagramData.activity?.taggedPostsAnalyzed);
        const hasLeaks = (instagramData.leaks?.count ?? 0) > 0;

        if (!hasGraph && !hasLeaks) {
          markNoResults(
            instagramData.message ||
              "No Instagram graph or breach data was returned.",
          );
          return;
        }

        setInstagramResult({
          ...instagramData,
          mutuals: instagramData.mutuals ?? [],
        });
        setRawResult(JSON.stringify(instagramData, null, 2));
        setLastSearchLabel(`${moduleDef.name} · ${trimmed}`);
        persistSearch(trimmed, moduleDef.slug, serialized);

        // Background paced batches — UI already shows first ~100.
        const loadGen = ++instagramLoadGenRef.current;
        const username = instagramData.query || trimmed;
        void (async () => {
          const chill = (ms: number) =>
            new Promise((resolve) => setTimeout(resolve, ms));

          setInstagramLoadingMore(true);
          setInstagramProgressLabel(
            "First ~100 connections loaded. Pausing, then fetching up to 500…",
          );

          try {
            // Self-rate-limit: wait before the heavier pass.
            await chill(4_000);
            if (!isMountedRef.current || instagramLoadGenRef.current !== loadGen) {
              return;
            }

            setInstagramProgressLabel(
              "Fetching more connections (capped at 500) and activity signals…",
            );

            const response = await fetch(
              `/api/osint/instagram?query=${encodeURIComponent(username)}&moduleSlug=instagram&maxUsers=500&includeActivity=1&maxPosts=12&maxTagged=12&commentPosts=4&enrichBios=0`,
            );
            const text = await response.text();
            if (!response.ok || !text) return;

            let next: InstagramSearchPayload;
            try {
              next = JSON.parse(text) as InstagramSearchPayload;
            } catch {
              return;
            }
            if (!isMountedRef.current || instagramLoadGenRef.current !== loadGen) {
              return;
            }
            if (!next.profile && !(next.followers?.length || next.following?.length)) {
              return;
            }

            setInstagramResult({
              ...next,
              mutuals: next.mutuals ?? [],
            });
            setRawResult(JSON.stringify(next, null, 2));
          } catch {
            // Keep the first batch on screen if the paced pass fails.
          } finally {
            if (isMountedRef.current && instagramLoadGenRef.current === loadGen) {
              setInstagramLoadingMore(false);
              setInstagramProgressLabel("");
            }
          }
        })();

        return;
      }

      if (activeType === "discord") {
        const discordData = data as DiscordSearchResult & {
          error?: string;
        };

        const hasProfile = Boolean(discordData.profile);
        const hasLeaks = (discordData.leaks?.count ?? 0) > 0;
        const hasRoblox = Boolean(
          discordData.robloxLink &&
            (discordData.robloxLink.username ||
              discordData.robloxLink.userId ||
              discordData.robloxLink.profileUrl),
        );
        const hasEnrichment = Boolean(
          discordData.enrichment &&
            typeof discordData.enrichment === "object" &&
            Object.keys(discordData.enrichment).length > 0,
        );
        const hasFivem = (discordData.fivem?.count ?? 0) > 0;
        const hasDsa = (discordData.dsa?.count ?? 0) > 0;

        if (
          !hasProfile &&
          !hasLeaks &&
          !hasRoblox &&
          !hasEnrichment &&
          !hasFivem &&
          !hasDsa
        ) {
          markNoResults(
            discordData.error || "No results were found.",
          );
          return;
        }

        setDiscordResult(discordData);
        setRawResult(JSON.stringify(discordData, null, 2));
        setLastSearchLabel(`${moduleDef.name} · ${trimmed}`);
        persistSearch(trimmed, moduleDef.slug, serialized);
        return;
      }

      if (activeType === "intelx") {
        const intelxData = data as {
          content?: string;
          hasContent?: boolean;
          error?: string;
          storageId?: string;
          bucket?: string;
          rejectedWebsiteDid?: boolean;
        };

        if (!intelxData.hasContent) {
          markNoResults(
            sanitizePublicText(
              intelxData.error || "No IntelX export content returned.",
            ),
          );
          return;
        }

        const exportBody = sanitizePublicContent(intelxData.content ?? "").trim();
        if (!exportBody) {
          markNoResults(
            sanitizePublicText(
              intelxData.error || "No IntelX export content returned.",
            ),
          );
          return;
        }

        const storageId = intelxData.storageId ?? trimmed;
        const bucketId = intelxData.bucket ?? "leaks.public";

        setIntelxResult({
          storageId,
          bucket: bucketId,
          content: exportBody,
        });
        setResultCount(1);
        setRawResult(exportBody || serialized);
        setLastSearchLabel(`${moduleDef.name} · ${storageId}`);
        persistSearch(trimmed, moduleDef.slug, exportBody || serialized);
        return;
      }

      if (activeType === "breach") {
        const breachData = data as {
          results?: unknown[];
          count?: number;
          message?: string;
          error?: string;
        };
        const results = Array.isArray(breachData.results) ? breachData.results : [];

        if (results.length === 0) {
          markNoResults(breachData.message || breachData.error);
          return;
        }

        const formatted = formatSearchRecords(results);

        if (formatted.length === 0) {
          markNoResults(breachData.message || breachData.error || "No results were found.");
          return;
        }

        setRecords(formatted);
        setResultCount(
          typeof breachData.count === "number" ? breachData.count : results.length,
        );
        setRawResult(JSON.stringify(data, null, 2));
        setLastSearchLabel(`${moduleDef.name} · ${trimmed}`);
        persistSearch(trimmed, moduleDef.slug, serialized);
        return;
      }

      if (activeType === "ip") {
        const formatted = formatStructuredSearchData(data);

        if (formatted.length === 0) {
          const ipData = data as { error?: string; osintcatError?: string; godseyeError?: string };
          markNoResults(
            sanitizePublicText(
              ipData.error ||
                ipData.osintcatError ||
                ipData.godseyeError ||
                "No IP intelligence was returned.",
            ),
          );
          return;
        }

        setRecords(formatted);
        setResultCount(formatted.length);
        setRawResult(JSON.stringify(data, null, 2));
        setLastSearchLabel(`${moduleDef.name} · ${trimmed}`);
        persistSearch(trimmed, moduleDef.slug, serialized);
        return;
      }

      if (activeType === "site-pentest") {
        const pentest = data as SitePentestResult & { error?: string };
        if (!pentest.findings && !pentest.results) {
          setError(
            sanitizePublicText(pentest.error || "Site pentest audit failed."),
          );
          return;
        }

        const findingCount =
          pentest.summary?.findingCount ??
          pentest.count ??
          (Array.isArray(pentest.findings) ? pentest.findings.length : 0);

        setStructuredResult({ kind: "site-pentest", data: pentest });
        setResultCount(findingCount);
        setRawResult(JSON.stringify(data, null, 2));
        setLastSearchLabel(`${moduleDef.name} · ${trimmed}`);
        if (findingCount === 0) {
          setEmptyResult("No results were found.");
        }
        persistSearch(trimmed, moduleDef.slug, serialized);
        return;
      }

      if (Array.isArray(data.results)) {
        const results = data.results as unknown[];
        const profile =
          data.profile &&
          typeof data.profile === "object" &&
          !Array.isArray(data.profile)
            ? (data.profile as Record<string, unknown>)
            : null;

        if (results.length === 0 && profile) {
          const formattedProfile = formatSearchRecords([profile]);
          if (formattedProfile.length > 0) {
            setRecords(formattedProfile);
            setResultCount(formattedProfile.length);
            setRawResult(JSON.stringify(data, null, 2));
            setLastSearchLabel(`${moduleDef.name} · ${trimmed}`);
            persistSearch(trimmed, moduleDef.slug, serialized);
            return;
          }
        }

        if (results.length === 0) {
          markNoResults(
            typeof data.message === "string" ? data.message : null,
          );
          return;
        }

        const formatted = formatSearchRecords(results);

        if (formatted.length === 0) {
          markNoResults(
            typeof data.message === "string"
              ? data.message
              : "No results were found.",
          );
          return;
        }

        setRecords(formatted);
        setResultCount(typeof data.count === "number" ? data.count : results.length);
        setRawResult(JSON.stringify(data, null, 2));
        setLastSearchLabel(`${moduleDef.name} · ${trimmed}`);
        persistSearch(trimmed, moduleDef.slug, serialized);
        return;
      }

      if (activeType === "crypto-wallet") {
        setStructuredResult({ kind: "crypto-wallet", data: data as CryptoWalletResult });
        setRawResult(JSON.stringify(data, null, 2));
        setLastSearchLabel(`${moduleDef.name} · ${trimmed}`);
        persistSearch(trimmed, moduleDef.slug, serialized);
        return;
      }

      if (activeType === "bin") {
        setStructuredResult({ kind: "bin", data: data as BinLookupResult });
        setRawResult(JSON.stringify(data, null, 2));
        setLastSearchLabel(`${moduleDef.name} · ${trimmed}`);
        persistSearch(trimmed, moduleDef.slug, serialized);
        return;
      }

      if (activeType === "iban") {
        const ibanData = data as IbanLookupResult;
        setStructuredResult({ kind: "iban", data: ibanData });
        setRawResult(JSON.stringify(data, null, 2));
        setLastSearchLabel(`${moduleDef.name} · ${trimmed}`);
        persistSearch(trimmed, moduleDef.slug, serialized);
        return;
      }

      if (activeType === "bank") {
        const bankData = data as BankSearchResult & { message?: string };

        if (!bankData.banks?.length) {
          markNoResults(
            bankData.message || "No bank institutions matched that search.",
          );
          return;
        }

        setStructuredResult({ kind: "bank", data: bankData });
        setRawResult(JSON.stringify(data, null, 2));
        setLastSearchLabel(`${moduleDef.name} · ${trimmed}`);
        persistSearch(trimmed, moduleDef.slug, serialized);
        return;
      }

      if (activeType === "vin") {
        setStructuredResult({ kind: "vin", data: data as VinDecodeResult });
        setRawResult(JSON.stringify(data, null, 2));
        setLastSearchLabel(`${moduleDef.name} · ${trimmed}`);
        persistSearch(trimmed, moduleDef.slug, serialized);
        return;
      }

      if (activeType === "car-insurance" || activeType === "healthcare") {
        const providerData = data as UsProviderSearchResult & { message?: string };

        if (!providerData.providers?.length) {
          markNoResults(
            providerData.message ||
              (activeType === "car-insurance"
                ? "No US car insurers matched that search."
                : "No US health care providers matched that search."),
          );
          return;
        }

        setStructuredResult({
          kind: activeType,
          data: providerData,
        });
        setRawResult(JSON.stringify(data, null, 2));
        setLastSearchLabel(`${moduleDef.name} · ${trimmed}`);
        persistSearch(trimmed, moduleDef.slug, serialized);
        return;
      }

      if (activeType === "us-court") {
        const courtData = data as UsCourtSearchResult & { error?: string };
        const portalCount = courtData.portals?.length ?? 0;
        const hitCount = (courtData.cases?.length ?? 0) + portalCount;

        if (!hitCount) {
          if (courtData.errors?.length) {
            setStructuredResult({ kind: "us-court", data: courtData });
            setRawResult(JSON.stringify(data, null, 2));
            setLastSearchLabel(`${moduleDef.name} · ${trimmed}`);
          } else {
            markNoResults(
              courtData.message ||
                courtData.error ||
                "No court matters matched that search.",
            );
          }
          return;
        }

        setStructuredResult({ kind: "us-court", data: courtData });
        setRawResult(JSON.stringify(data, null, 2));
        setLastSearchLabel(`${moduleDef.name} · ${trimmed}`);
        persistSearch(trimmed, moduleDef.slug, serialized);
        return;
      }

      if (PUBLIC_RECORDS_COMPOSE_KINDS.has(activeType)) {
        const identityData = data as UsIdentitySearchResult & { error?: string };
        const kind = activeType as
          | "us-identity"
          | "us-npd"
          | "us-global"
          | "us-sanctions"
          | "us-wanted"
          | "us-state-directory"
          | "us-portal-backlog"
          | "us-intl-directory";

        if (!identityData.count) {
          if (identityData.errors?.length || identityData.portals?.length) {
            setStructuredResult({ kind, data: identityData });
            setRawResult(JSON.stringify(data, null, 2));
            setLastSearchLabel(`${moduleDef.name} · ${trimmed}`);
          } else {
            markNoResults(
              identityData.message ||
                identityData.error ||
                "No public registry matches found.",
            );
          }
          return;
        }

        setStructuredResult({ kind, data: identityData });
        setRawResult(JSON.stringify(data, null, 2));
        setLastSearchLabel(`${moduleDef.name} · ${trimmed}`);
        persistSearch(trimmed, moduleDef.slug, serialized);
        return;
      }

      if (activeType === "us-va-sor" || activeType === "us-sor-national") {
        const sorData = data as UsVaSorSearchResult & { error?: string };

        if (!sorData.count) {
          if (sorData.errors?.length) {
            setStructuredResult({
              kind: activeType === "us-sor-national" ? "us-sor-national" : "us-va-sor",
              data: sorData,
            });
            setRawResult(JSON.stringify(data, null, 2));
            setLastSearchLabel(`${moduleDef.name} · ${trimmed}`);
          } else {
            markNoResults(
              sorData.message ||
                sorData.error ||
                "No sex offender registry matches found.",
            );
          }
          return;
        }

        setStructuredResult({
          kind: activeType === "us-sor-national" ? "us-sor-national" : "us-va-sor",
          data: sorData,
        });
        setRawResult(JSON.stringify(data, null, 2));
        setLastSearchLabel(`${moduleDef.name} · ${trimmed}`);
        persistSearch(trimmed, moduleDef.slug, serialized);
        return;
      }

      const formatted = formatStructuredSearchData(data);

      if (formatted.length === 0) {
        markNoResults();
        return;
      }

      setRecords(formatted);
      setResultCount(
        typeof (data as { count?: number }).count === "number"
          ? (data as { count: number }).count
          : formatted.length,
      );
      setRawResult(JSON.stringify(data, null, 2));
      setLastSearchLabel(`${moduleDef.name} · ${trimmed}`);
      persistSearch(trimmed, moduleDef.slug, serialized);
    } catch (err) {
      if (isMountedRef.current) {
        const message =
          err instanceof Error && err.message
            ? sanitizePublicText(err.message)
            : "Could not complete the search.";
        setError(message);
      }
    } finally {
      if (isMountedRef.current) {
        setIsSearching(false);
      }
    }
  };

  const handleSaveToCase = async () => {
    if (!saveCaseId || !rawResult) return;

    setSavingToCase(true);
    setSaveMessage("");

    try {
      const target = caseOptions.find((c) => c.id === Number(saveCaseId));
      const existingResponse = await fetch(`/api/cases/${saveCaseId}`);
      const existingData = await existingResponse.json();
      const previousIntel = existingData.case?.intelData || "";
      const block = `--- ${lastSearchLabel} ---\n${rawResult}\n\n`;

      const response = await apiFetch(`/api/cases/${saveCaseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intelData: `${previousIntel}${block}`,
        }),
      });

      if (!response.ok) {
        setSaveMessage("Failed to save to case.");
        return;
      }

      setSaveMessage(`Intel appended to "${target?.title || "case"}".`);
    } catch {
      setSaveMessage("Could not save to case.");
    } finally {
      setSavingToCase(false);
    }
  };

  return (
    <div className="module-search px-6 py-6 md:px-8 md:py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <Link className="module-search-back inline-flex items-center gap-2" href="/dashboard/search">
          <ArrowLeft className="size-4" />
          Search hub
        </Link>
        <Link className="module-search-back inline-flex items-center gap-2" href="/">
          <Home className="size-4" />
          Home
        </Link>
      </div>

      <header className="module-search-hero">
        <p className="module-search-section">{moduleDef.section}</p>
        <h1 className="module-search-title flex items-center gap-2">
          <ModuleStatusDot className="size-2" slug={moduleDef.slug} />
          {moduleDef.name}
        </h1>
        <p className="module-search-tagline">{moduleDef.tagline}</p>
        <p className="module-search-hint">{moduleDef.hint}</p>
        {moduleDef.lawfulUseNotice ? (
          <p className="mt-3 border-l-2 border-white/15 bg-white/5 px-4 py-3 text-sm text-zinc-300">
            {moduleDef.lawfulUseCopy ??
              "For lawful investigative and research use only. Not a consumer reporting agency and not for FCRA-covered decisions (credit, employment, housing, insurance). Results are composed from public government indexes and may be incomplete."}
          </p>
        ) : null}
        {moduleLocked && (
          <p className="mt-3 border-l-2 border-amber-400/60 bg-amber-400/8 px-4 py-3 text-sm text-amber-100">
            {moduleLocked}{" "}
            <Link className="text-anya-accent underline" href="/pricing">
              View plans
            </Link>
          </p>
        )}
      </header>

      <section className="ui-panel">
        <div className="ui-panel-body">
          {moduleDef.tools && moduleDef.tools.length > 0 ? (
            <div className="mb-4 flex flex-wrap gap-2">
              {moduleDef.tools.map((tool) => {
                const active = tool.id === selectedToolId;
                return (
                  <button
                    key={tool.id}
                    className={
                      active
                        ? "rounded-full border border-[var(--anya-blush)]/50 bg-[var(--anya-blush)]/15 px-3 py-1 text-xs font-medium text-[var(--anya-blush)]"
                        : "rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-zinc-300 hover:border-white/25"
                    }
                    onClick={() => setSelectedToolId(tool.id)}
                    type="button"
                  >
                    {tool.label}
                  </button>
                );
              })}
            </div>
          ) : null}
          <form className="flex flex-col gap-3 sm:flex-row sm:items-start" onSubmit={handleSearch}>
            {isSummary ? (
              <textarea
                className="ui-input min-h-[7rem] flex-1 resize-y font-mono text-sm"
                data-tour="search-input"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Paste intel, JSON, logs, or case notes…"
                value={query}
              />
            ) : (
              <input
                autoFocus
                className="ui-input flex-1 font-mono text-sm"
                data-tour="search-input"
                onChange={(event) => setQuery(event.target.value)}
                placeholder={
                  moduleDef.slug === "intelx"
                    ? "Paste Storage ID or intelx.io URL…"
                    : moduleDef.hint
                }
                spellCheck={moduleDef.slug === "intelx" ? false : undefined}
                value={query}
              />
            )}
            <button
              className="ui-btn ui-btn-primary shrink-0 sm:min-w-[6.5rem]"
              data-tour="search-submit"
              disabled={!query.trim() || isSearching || Boolean(moduleLocked)}
              type="submit"
            >
              {isSearching
                ? "Scanning…"
                : isAi
                  ? "Analyse"
                  : moduleDef.slug === "intelx"
                    ? "Open"
                    : "Run"}
            </button>
          </form>

          {error && (
            <p className="mt-4 rounded-lg border border-red-400/20 bg-red-400/8 px-3 py-2 text-sm text-red-200">
              {error}
            </p>
          )}
        </div>
      </section>

          {!isSearching && emptyResult && moduleDef.slug !== "site-pentest" ? (
            <div className="mt-5 border-t border-white/8 pt-5" data-tour="search-results">
              {lastSearchLabel ? (
                <p className="mb-4 text-sm text-zinc-400">{lastSearchLabel}</p>
              ) : null}
              <SearchEmptyState detail={emptyResult} />
            </div>
          ) : null}

          {moduleDef.slug === "site-pentest" ? (
            <div className="mt-5 border-t border-white/8 pt-5" data-tour="search-results">
              {(structuredResult?.kind === "site-pentest" || lastSearchLabel) && (
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-zinc-400">
                    {lastSearchLabel || "Site Pentest"}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <ResultExportControls
                      disabled={!rawResult}
                      label="Export"
                      onExport={handleExportAll}
                    />
                    <CasePicker
                      onChange={setSaveCaseId}
                      options={caseOptions}
                      value={saveCaseId}
                    />
                    <button
                      className="ui-btn ui-btn-primary"
                      disabled={!saveCaseId || savingToCase || !rawResult}
                      onClick={handleSaveToCase}
                      type="button"
                    >
                      <FolderPlus className="size-3.5" />
                      {savingToCase ? "Saving…" : "File intel"}
                    </button>
                  </div>
                </div>
              )}
              {saveMessage ? (
                <p className="mb-3 text-sm text-zinc-300">{saveMessage}</p>
              ) : null}
              <SitePentestResults
                blurResults={blurResults}
                onModulesChange={setPentestModules}
                result={
                  structuredResult?.kind === "site-pentest"
                    ? structuredResult.data
                    : null
                }
                scanning={isSearching}
                selectedModules={pentestModules}
              />
              {!isSearching && emptyResult ? (
                <div className="mt-4">
                  <SearchEmptyState detail={emptyResult} />
                </div>
              ) : null}
            </div>
          ) : null}

          {(records.length > 0 ||
            aiResult ||
            combResult ||
            domainResult ||
            discordResult ||
            intelxResult ||
            fivemResult ||
            robloxResult ||
            instagramResult ||
            (structuredResult && structuredResult.kind !== "site-pentest")) && (
            <div className="mt-5 border-t border-white/8 pt-5" data-tour="search-results">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-zinc-400">{lastSearchLabel}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <ResultExportControls
                    disabled={!hasSelectableCards || selectedExportIndex === null}
                    label="Export selected"
                    onExport={handleExportSelected}
                  />
                  <ResultExportControls
                    disabled={!canExportAll}
                    label="Export"
                    onExport={handleExportAll}
                  />
                  <CasePicker
                    onChange={setSaveCaseId}
                    options={caseOptions}
                    value={saveCaseId}
                  />
                  <button
                    className="ui-btn ui-btn-primary"
                    disabled={!saveCaseId || savingToCase}
                    onClick={handleSaveToCase}
                    type="button"
                  >
                    <FolderPlus className="size-3.5" />
                    {savingToCase ? "Saving…" : "File intel"}
                  </button>
                </div>
              </div>
              {saveMessage && (
                <p className="mb-3 text-sm text-zinc-300">{saveMessage}</p>
              )}
              {caseOptions.length === 0 && (
                <p className="mb-3 text-xs text-zinc-500">
                  No cases yet.{" "}
                  <Link
                    className="text-anya-accent underline hover:text-anya-accent-hover"
                    href="/dashboard/cases"
                  >
                    Open Case ID
                  </Link>{" "}
                  to start filing.
                </p>
              )}
              {aiResult ? (
                aiResult.mode === "crypto" ? (
                  <CryptoAiChatResults blurResults={blurResults} result={aiResult} />
                ) : (
                  <AiSearchResults blurResults={blurResults} result={aiResult} />
                )
              ) : intelxResult ? (
                <IntelxSearchResults blurResults={blurResults} result={intelxResult} />
              ) : fivemResult ? (
                <FivemSearchResults
                  blurResults={blurResults}
                  onSelectExportIndex={handleSelectExportIndex}
                  result={fivemResult}
                  selectedExportIndex={selectedExportIndex}
                />
              ) : robloxResult ? (
                <RobloxSearchResults
                  blurResults={blurResults}
                  onSelectExportIndex={handleSelectExportIndex}
                  result={robloxResult}
                  selectedExportIndex={selectedExportIndex}
                />
              ) : instagramResult ? (
                <InstagramSearchResults
                  blurResults={blurResults}
                  enriching={instagramEnriching}
                  loadingMore={instagramLoadingMore}
                  onEnrichBios={handleInstagramEnrichBios}
                  onSelectExportIndex={handleSelectExportIndex}
                  progressLabel={instagramProgressLabel}
                  result={instagramResult}
                  selectedExportIndex={selectedExportIndex}
                />
              ) : discordResult ? (
                <DiscordSearchResults blurResults={blurResults} result={discordResult} />
              ) : domainResult ? (
                <DomainSearchResults
                  blurResults={blurResults}
                  onSelectExportIndex={handleSelectExportIndex}
                  result={domainResult}
                  selectedExportIndex={selectedExportIndex}
                />
              ) : combResult ? (
                <BreachesSearchResults
                  blurResults={blurResults}
                  onSelectExportIndex={handleSelectExportIndex}
                  result={combResult}
                  selectedExportIndex={selectedExportIndex}
                />
              ) : structuredResult?.kind === "crypto-wallet" ? (
                <CryptoWalletResults blurResults={blurResults} result={structuredResult.data} />
              ) : structuredResult?.kind === "bin" ? (
                <BinSearchResults blurResults={blurResults} result={structuredResult.data} />
              ) : structuredResult?.kind === "iban" ? (
                <IbanSearchResults blurResults={blurResults} result={structuredResult.data} />
              ) : structuredResult?.kind === "bank" ? (
                <BankSearchResults blurResults={blurResults} result={structuredResult.data} />
              ) : structuredResult?.kind === "vin" ? (
                <VinSearchResults blurResults={blurResults} result={structuredResult.data} />
              ) : structuredResult?.kind === "car-insurance" || structuredResult?.kind === "healthcare" ? (
                <UsProviderSearchResults blurResults={blurResults} result={structuredResult.data} />
              ) : structuredResult?.kind === "us-court" ? (
                <UsCourtSearchResults blurResults={blurResults} result={structuredResult.data} />
              ) : structuredResult?.kind === "us-va-sor" || structuredResult?.kind === "us-sor-national" ? (
                <UsVaSorSearchResults blurResults={blurResults} result={structuredResult.data} />
              ) : structuredResult &&
                structuredResult.kind !== "site-pentest" &&
                PUBLIC_RECORDS_COMPOSE_KINDS.has(structuredResult.kind) ? (
                <UsIdentitySearchResults
                  blurResults={blurResults}
                  result={structuredResult.data as UsIdentitySearchResult}
                  title={
                    PUBLIC_RECORDS_COMPOSE_TITLES[structuredResult.kind] || "Public records hits"
                  }
                />
              ) : records.length > 0 ? (
                <SearchResultCards
                  blurResults={blurResults}
                  onSelectExportIndex={handleSelectExportIndex}
                  records={records}
                  selectedExportIndex={selectedExportIndex}
                  totalCount={resultCount}
                />
              ) : null}
            </div>
          )}

      <SearchBarTour
        ariaLabel="Workspace search guide"
        enabled={workspaceSearchTourReady}
        steps={WORKSPACE_SEARCH_TOUR_STEPS}
        storageKey={WORKSPACE_SEARCH_TOUR_STORAGE_KEY}
      />
    </div>
  );
}
