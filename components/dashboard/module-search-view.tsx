"use client";

import type { BankSearchResult } from "@/lib/bank-search";
import type { BinLookupResult } from "@/lib/bin-lookup";
import type { CryptoWalletResult } from "@/lib/crypto-wallet";
import type {
  CryptoAddressIntelResult,
  CryptoFundFlowResult,
  CryptoFullSuiteResult,
  CryptoRiskCheckResult,
  CryptoTxDeepDiveResult,
} from "@/lib/crypto-intel/types";
import { detectCryptoInput } from "@/lib/crypto-intel/detect";
import type { IbanLookupResult } from "@/lib/iban-lookup";
import type { UsProviderSearchResult } from "@/lib/us-provider-directory";
import type { VinDecodeResult } from "@/lib/vin-decode";
import type {
  UsCourtSearchResult,
  UsIdentitySearchResult,
  UsVaSorSearchResult,
} from "@/lib/us-records";
import type { CombCredential, CombSearchResult } from "@/lib/proxynova-comb";
import type { DiscordSearchResult } from "@/lib/discord-profile";
import type { DomainSearchResult } from "@/lib/domain-search";
import type { SitePentestResult } from "@/lib/site-pentest-shared";
import type { FivemSearchResult } from "@/lib/fivem-search";
import type { RobloxSearchResult } from "@/lib/roblox-search";
import type { HingeLiveSearchResult } from "@/lib/hinge-live/types";
import type { TinderLiveSearchResult } from "@/lib/tinder-live/types";
import type { AccountPresenceSearchResult } from "@/lib/account-presence";
import type { EmailPresenceSearchResult } from "@/lib/email-presence";
import type { IndexSweepSearchResult } from "@/lib/index-sweep";
import type { FormattedRecord } from "@/lib/search-utils";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import clsx from "clsx";
import { ArrowRight, FolderPlus, Home } from "lucide-react";
import dynamic from "next/dynamic";
import {
  useSearchJobs,
} from "@/components/dashboard/search-jobs-context";
import {
  emptyModuleSearchSnapshot,
  formatResultSummary,
  payloadToSnapshot,
  snapshotToPayload,
  type ModuleSearchSnapshot,
  type StructuredSearchResult,
} from "@/components/dashboard/module-search-snapshot";

import { apiFetch } from "@/lib/csrf-client";
import { SearchBarTour } from "@/components/search-bar-tour";
import { SearchProgressBar } from "@/components/search-progress-bar";
import { LiquidButton } from "@/components/ui/liquid-glass-button";
import { SpecularButton } from "@/components/ui/specular-button";
import { BreachesSearchResults } from "@/components/dashboard/breaches-search-results";
import { CryptoWalletResults } from "@/components/dashboard/crypto-wallet-results";
import { CryptoFullSuiteResults } from "@/components/dashboard/crypto-full-suite-results";
import {
  CryptoAddressIntelResults,
  CryptoFundFlowResults,
  CryptoRiskCheckResults,
  CryptoTxDeepDiveResults,
} from "@/components/dashboard/crypto-intel-results";
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
import { StealerLogsSearchResults } from "@/components/dashboard/stealer-logs-search-results";
import type { StealerArchiveEntry } from "@/lib/breachhub";
import { extractStealerArchives } from "@/lib/breachhub";
import {
  archivesFromStealerResults,
  extractStealerCredentialRows,
  mergeStealerArchives,
  type StealerCredentialRow,
} from "@/lib/stealer-logs-view";
import { RobloxSearchResults } from "@/components/dashboard/roblox-search-results";
import { DomainSearchResults } from "@/components/dashboard/domain-search-results";
import {
  IntelxSearchResults,
  type IntelxSearchPayload,
} from "@/components/dashboard/intelx-search-results";

import { HingeLiveResults } from "@/components/dashboard/hinge-live-results";
import { TinderLiveResults } from "@/components/dashboard/tinder-live-results";
import {
  AccountPresenceResults,
  EmailPresenceResults,
} from "@/components/dashboard/account-presence-results";
import { IndexSweepResults } from "@/components/dashboard/index-sweep-results";
import { ModuleStatusDot } from "@/components/dashboard/module-status-dot";
import { AiSearchResults } from "@/components/dashboard/ai-search-results";
import { CryptoAiChatResults } from "@/components/dashboard/crypto-ai-chat-results";
import { useDashboardUser } from "@/components/dashboard/dashboard-auth-provider";
import { CasePicker } from "@/components/dashboard/case-picker";
import { aiModeFromSidebarItem, type AiIntelResult } from "@/lib/ai-intel";
import {
  CRYPTO_WALLET_INVALID_MESSAGE,
  detectCryptoChain,
} from "@/lib/crypto-wallet";
import { normalizeEmail } from "@/lib/proxynova-comb";
import {
  sanitizePublicContent,
  sanitizePublicText,
} from "@/lib/public-branding";
import {
  AutofillDecoyFields,
  SEARCH_AUTOFILL_SHIELD,
  TEXTAREA_AUTOFILL_SHIELD,
  unlockAutofillShield,
} from "@/lib/search-autofill-shield";
import { isDiscordSnowflake } from "@/lib/osintcat";
import { normalizeInstagramUsername } from "@/lib/instagram-username";
import { DASHBOARD_TOUR_STORAGE_KEY } from "@/lib/dashboard-tour";
import { isDatingAppSlug, normalizeDatingQuery } from "@/lib/dating-search";
import { extractStealerLogEntries, normalizeDomain } from "@/lib/domain-search";
import {
  defaultSitePentestModules,
  parseSitePentestTarget,
} from "@/lib/site-pentest-shared";
import {
  checkModuleAccess,
  planHasUltimateModules,
  RESIDENTIAL_PROXY_CREDIT_COST,
  resolveResidentialProxyBillingSlug,
  resolveUserPlan,
  shouldBlurResults,
} from "@/lib/plans";
import {
  getModuleMaintenanceMessage,
  isModuleUnderMaintenance,
} from "@/lib/module-maintenance";
import {
  getAiModeForModule,
  getModuleFanOutBehavior,
  isOathnetApiType,
  isPhoneQuery,
  resolveSearchApiPath,
  resolveSearchApiType,
  composeModuleQuery,
  type ModuleOptionalFilter,
  type SearchModuleDef,
} from "@/lib/search-modules";
import { ModuleSearchFields } from "@/components/dashboard/module-search-fields";
import {
  composeModuleSearchFields,
  createSearchFieldRow,
  defaultSearchFieldsForModule,
  fieldTypeToBreachKindHint,
  type ModuleSearchFieldRow,
} from "@/lib/module-search-fields";
import {
  DEFAULT_PUBLIC_RECORDS_SOURCES,
  type PublicRecordsSourceOptionId,
} from "@/lib/public-records/source-options";
import { PublicRecordsOptionsPanel } from "@/components/dashboard/public-records-options";
import {
  WORKSPACE_SEARCH_TOUR_STEPS,
  WORKSPACE_SEARCH_TOUR_STORAGE_KEY,
} from "@/lib/search-tour";
import { ResultExportControls } from "@/components/dashboard/result-export-controls";
import { SearchEmptyState } from "@/components/dashboard/search-empty-state";
import { SearchResultCards } from "@/components/dashboard/search-result-cards";
import {
  formatSearchRecords,
  formatStructuredSearchData,
} from "@/lib/search-utils";
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

type StructuredResult = StructuredSearchResult;
const PUBLIC_RECORDS_COMPOSE_KINDS = new Set([
  "us-identity",
  "us-npd",
  "us-global",
  "us-sanctions",
  "us-wanted",
  "us-state-directory",
  "us-portal-backlog",
  "us-intl-directory",
  "public-records",
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
  "public-records": "Public records",
};

type CaseOption = {
  id: number;
  title: string;
  subjectName: string;
};

export function ModuleSearchView({
  moduleDef,
}: {
  moduleDef: SearchModuleDef;
}) {
  const profile = useDashboardUser();
  const plan = resolveUserPlan(profile);
  const balance = profile.balance ?? 0;
  const {
    jobs,
    selectedJobId,
    beginJob,
    completeJob,
    failJob,
    setJobProgress,
    getJob,
    getLatestJobForModule,
  } = useSearchJobs();
  const boundJobIdRef = useRef<string | null>(null);

  const isPublicRecords = moduleDef.slug === "public-records";
  const isCryptoIntel = moduleDef.slug === "crypto-intel";
  const fanOutBehavior = useMemo(
    () => getModuleFanOutBehavior(moduleDef),
    [moduleDef],
  );
  const hideToolChips =
    Boolean(moduleDef.hideTools) || fanOutBehavior.mode !== "none";

  const [query, setQuery] = useState("");
  const [searchFields, setSearchFields] = useState<ModuleSearchFieldRow[]>(() =>
    defaultSearchFieldsForModule(moduleDef),
  );
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [publicRecordsSources, setPublicRecordsSources] = useState<
    PublicRecordsSourceOptionId[]
  >(() => [...DEFAULT_PUBLIC_RECORDS_SOURCES]);
  const [showPublicRecordsOptions, setShowPublicRecordsOptions] =
    useState(false);
  const [optionalFilterValues, setOptionalFilterValues] = useState<
    Partial<Record<ModuleOptionalFilter["id"], string>>
  >({});
  const searchParams = useSearchParams();
  const toolLockedRef = useRef(false);

  useEffect(() => {
    const prefill = searchParams.get("q")?.trim();

    if (prefill) {
      setQuery(prefill);
      setSearchFields((prev) => {
        if (prev.length === 0) {
          return [createSearchFieldRow("query", prefill)];
        }

        const next = [...prev];
        next[0] = { ...next[0]!, value: prefill };

        return next;
      });
      if (isPublicRecords) {
        const parts = prefill.split(/\s+/);
        setFirstName(parts[0] ?? "");
        setLastName(parts.slice(1).join(" "));
      }
    }
  }, [searchParams, moduleDef.slug, isPublicRecords]);

  const [selectedToolId, setSelectedToolId] = useState(
    moduleDef.tools?.[0]?.id ?? "",
  );
  /** Contact Profiles deep search — residential proxy probes (+1 credit). */
  const [contactProfilesDeep, setContactProfilesDeep] = useState(false);

  useEffect(() => {
    // Fan-out modules lock chips off and ignore ?tool= deep links.
    // Server-stream (discord/stealer) runs tools[0]; all-tools runs every apiType.
    if (fanOutBehavior.mode !== "none") {
      const primary = moduleDef.tools?.[0]?.id ?? "";

      setSelectedToolId(primary);
      toolLockedRef.current = true;

      return;
    }

    const fromUrl = searchParams.get("tool")?.trim();
    const validTool = moduleDef.tools?.find((t) => {
      if (t.id !== fromUrl) return false;
      // Specialty identity-intel deep links require Ultimate+.
      if (
        t.apiType &&
        isOathnetApiType(t.apiType) &&
        !planHasUltimateModules(plan)
      ) {
        return false;
      }

      return true;
    });
    const initial = validTool?.id ?? moduleDef.tools?.[0]?.id ?? "";

    setSelectedToolId(initial);
    toolLockedRef.current = Boolean(validTool);
  }, [
    moduleDef.slug,
    moduleDef.tools,
    fanOutBehavior.mode,
    searchParams,
    plan,
  ]);

  useEffect(() => {
    setSearchFields(defaultSearchFieldsForModule(moduleDef));
    setOptionalFilterValues({});
    setShowPublicRecordsOptions(false);
    setPublicRecordsSources([...DEFAULT_PUBLIC_RECORDS_SOURCES]);
    setQuery("");
    setContactProfilesDeep(false);
    if (moduleDef.slug === "public-records") {
      setFirstName("");
      setLastName("");
    }
  }, [moduleDef.slug]);

  const selectedTool = moduleDef.tools?.find(
    (tool) => tool.id === selectedToolId,
  );

  const showsContactProfilesDeepToggle =
    moduleDef.slug === "email-presence" ||
    selectedToolId === "email-presence";

  const billingModuleSlug = useMemo(
    () =>
      resolveResidentialProxyBillingSlug({
        moduleSlug: moduleDef.slug,
        selectedToolId,
        contactProfilesDeep: showsContactProfilesDeepToggle
          ? contactProfilesDeep
          : false,
      }) ?? moduleDef.slug,
    [
      contactProfilesDeep,
      moduleDef.slug,
      selectedToolId,
      showsContactProfilesDeepToggle,
    ],
  );

  const residentialProxyCostHint = useMemo(() => {
    const proxySlug = resolveResidentialProxyBillingSlug({
      moduleSlug: moduleDef.slug,
      selectedToolId,
      contactProfilesDeep: showsContactProfilesDeepToggle
        ? contactProfilesDeep
        : false,
    });

    if (!proxySlug) return null;

    if (proxySlug === "email-presence-deep") {
      return `Deep search costs ${RESIDENTIAL_PROXY_CREDIT_COST} credit (Instagram, Snapchat, TikTok, Facebook, Discord, LinkedIn signup, adult sites).`;
    }

    if (proxySlug === "instagram-live") {
      return `Instagram Live costs ${RESIDENTIAL_PROXY_CREDIT_COST} credit per search. Instagram ID / DataVoid tools stay on plan quota.`;
    }

    if (proxySlug === "hinge-live") {
      return `Hinge Live costs ${RESIDENTIAL_PROXY_CREDIT_COST} credit per search.`;
    }

    return `This search costs ${RESIDENTIAL_PROXY_CREDIT_COST} credit.`;
  }, [
    contactProfilesDeep,
    moduleDef.slug,
    selectedToolId,
    showsContactProfilesDeepToggle,
  ]);
  const toolAiMode = selectedTool?.aiMode;
  const isAi = moduleDef.module === "ai" || Boolean(toolAiMode);
  const aiMode = (() => {
    if (toolAiMode) return toolAiMode;

    const fromModule = getAiModeForModule(moduleDef);

    if (fromModule !== "auto" && fromModule !== "search") return fromModule;
    if (fromModule === "search") return "search";

    return aiModeFromSidebarItem(moduleDef.name);
  })();
  const isSummary = aiMode === "summary";

  const composedFields = useMemo(
    () => composeModuleSearchFields(searchFields, moduleDef),
    [searchFields, moduleDef],
  );

  const cryptoDetection = useMemo(
    () =>
      isCryptoIntel
        ? detectCryptoInput(composedFields.query || query)
        : null,
    [isCryptoIntel, composedFields.query, query],
  );

  useEffect(() => {
    if (!isCryptoIntel || toolLockedRef.current) return;
    if (!cryptoDetection || cryptoDetection.kind === "unknown") return;
    if (!moduleDef.tools?.some((t) => t.id === cryptoDetection.suggestedToolId)) {
      return;
    }

    setSelectedToolId(cryptoDetection.suggestedToolId);
  }, [cryptoDetection, isCryptoIntel, moduleDef.tools]);

  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState("");
  const [emptyResult, setEmptyResult] = useState("");
  const [records, setRecords] = useState<FormattedRecord[]>([]);
  const [resultCount, setResultCount] = useState<number | undefined>(undefined);
  const [aiResult, setAiResult] = useState<AiIntelResult | null>(null);
  const [combResult, setCombResult] = useState<CombSearchResult | null>(null);
  const [domainResult, setDomainResult] = useState<DomainSearchResult | null>(
    null,
  );
  const [discordResult, setDiscordResult] =
    useState<DiscordSearchResult | null>(null);
  const [intelxResult, setIntelxResult] = useState<IntelxSearchPayload | null>(
    null,
  );
  const [fivemResult, setFivemResult] = useState<FivemSearchResult | null>(
    null,
  );
  const [stealerResult, setStealerResult] = useState<{
    credentials: StealerCredentialRow[];
    archives: StealerArchiveEntry[];
    count?: number;
    fallbackRecords?: ReturnType<typeof formatSearchRecords>;
    breachedData?: CombSearchResult | null;
  } | null>(null);
  const [robloxResult, setRobloxResult] = useState<RobloxSearchResult | null>(
    null,
  );
  const [instagramResult, setInstagramResult] =
    useState<InstagramSearchPayload | null>(null);
  const [instagramEnriching, setInstagramEnriching] = useState(false);
  const [instagramLoadingMore, setInstagramLoadingMore] = useState(false);
  const [instagramProgressLabel, setInstagramProgressLabel] = useState("");
  const instagramLoadGenRef = useRef(0);
  const [discordLoadingMore, setDiscordLoadingMore] = useState(false);
  const [discordProgressLabel, setDiscordProgressLabel] = useState("");
  const [searchProgressRatio, setSearchProgressRatio] = useState<number | null>(
    null,
  );
  const [structuredResult, setStructuredResult] =
    useState<StructuredResult | null>(null);
  const [rawResult, setRawResult] = useState("");
  const [lastSearchLabel, setLastSearchLabel] = useState("");
  const [caseOptions, setCaseOptions] = useState<CaseOption[]>([]);
  const [saveCaseId, setSaveCaseId] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [workspaceSearchTourReady, setWorkspaceSearchTourReady] =
    useState(false);

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
  const [selectedExportIndex, setSelectedExportIndex] = useState<number | null>(
    null,
  );
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

  const applySnapshot = useCallback((snap: ModuleSearchSnapshot) => {
    setQuery(snap.query);
    setError(snap.error);
    setEmptyResult(snap.emptyResult);
    setRecords(snap.records);
    setResultCount(snap.resultCount);
    setAiResult(snap.aiResult);
    setCombResult(snap.combResult);
    setDomainResult(snap.domainResult);
    setDiscordResult(snap.discordResult);
    setIntelxResult(snap.intelxResult);
    setFivemResult(snap.fivemResult);
    setStealerResult(snap.stealerResult);
    setRobloxResult(snap.robloxResult);
    setInstagramResult(snap.instagramResult);
    setStructuredResult(snap.structuredResult);
    setRawResult(snap.rawResult);
    setLastSearchLabel(snap.lastSearchLabel);
    setBlurResults(snap.blurResults);
    setSelectedExportIndex(null);
  }, []);

  const clearResultState = useCallback(() => {
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
    setStealerResult(null);
    setRobloxResult(null);
    setInstagramResult(null);
    setInstagramEnriching(false);
    setInstagramLoadingMore(false);
    setInstagramProgressLabel("");
    setDiscordLoadingMore(false);
    setDiscordProgressLabel("");
    setSearchProgressRatio(null);
    setStructuredResult(null);
    setRawResult("");
    setLastSearchLabel("");
    setSaveMessage("");
    setSelectedExportIndex(null);
  }, []);

  // Restore / bind the latest (or selected) job for this module when navigating back.
  useEffect(() => {
    const selected = selectedJobId ? getJob(selectedJobId) : undefined;
    const job =
      selected && selected.moduleId === moduleDef.slug
        ? selected
        : getLatestJobForModule(moduleDef.slug);

    boundJobIdRef.current = job?.id ?? null;

    if (!job) return;

    if (job.query) {
      setQuery(job.query);
    }

    if (job.status === "running") {
      setIsSearching(true);
      clearResultState();

      return;
    }

    if (job.status === "done") {
      const snap = payloadToSnapshot(job.payload);

      if (snap) applySnapshot(snap);
      setIsSearching(false);
      setSearchProgressRatio(null);

      return;
    }

    if (job.status === "error") {
      clearResultState();
      setError(job.error || "Search failed.");
      setLastSearchLabel(`${moduleDef.name} · ${job.query}`);
      setIsSearching(false);
    }
  }, [
    applySnapshot,
    clearResultState,
    getJob,
    getLatestJobForModule,
    moduleDef.name,
    moduleDef.slug,
    selectedJobId,
  ]);

  // Apply updates when the bound background job finishes while this view is open.
  useEffect(() => {
    const id = boundJobIdRef.current;

    if (!id) return;

    const job = jobs.find((entry) => entry.id === id);

    if (!job) return;

    if (job.status === "running") {
      setIsSearching(true);

      return;
    }

    if (job.status === "done") {
      const snap = payloadToSnapshot(job.payload);

      if (snap) applySnapshot(snap);
      setIsSearching(false);
      setSearchProgressRatio(null);

      return;
    }

    if (job.status === "error") {
      setError(job.error || "Search failed.");
      setIsSearching(false);
      setSearchProgressRatio(null);

      return;
    }

    if (job.status === "cancelled") {
      setIsSearching(false);
      setSearchProgressRatio(null);
    }
  }, [applySnapshot, jobs]);

  const moduleLocked = useMemo(() => {
    const access = checkModuleAccess(plan, billingModuleSlug, { balance });

    if (access.allowed) {
      return null;
    }

    return access.reason || "This module is not available on your plan.";
  }, [balance, billingModuleSlug, plan]);

  /** Live tools (or whole modules) flagged as under repair. */
  const maintenanceMessage = useMemo(() => {
    // Hinge Live (and any dedicated live slug) — whole module.
    if (
      moduleDef.slug === "hinge-live" ||
      moduleDef.slug === "instagram-live"
    ) {
      return getModuleMaintenanceMessage(moduleDef.slug);
    }

    // Instagram page: only the Live OSINT tool is under repair.
    if (moduleDef.slug === "instagram") {
      if (!selectedToolId || selectedToolId === "instagram-live") {
        return getModuleMaintenanceMessage("instagram-live");
      }

      return null;
    }

    if (selectedToolId && isModuleUnderMaintenance(selectedToolId)) {
      return getModuleMaintenanceMessage(selectedToolId);
    }

    if (billingModuleSlug && isModuleUnderMaintenance(billingModuleSlug)) {
      return getModuleMaintenanceMessage(billingModuleSlug);
    }

    return null;
  }, [billingModuleSlug, moduleDef.slug, selectedToolId]);

  /** Soft banner on Instagram even when a non-Live tool is selected. */
  const maintenanceBanner =
    maintenanceMessage ??
    (moduleDef.slug === "instagram"
      ? getModuleMaintenanceMessage("instagram-live")
      : null);

  const searchBlockedByMaintenance = Boolean(maintenanceMessage);

  const hasSelectableCards = useMemo(
    () =>
      records.length > 0 ||
      Boolean(combResult) ||
      Boolean(robloxResult) ||
      Boolean(instagramResult) ||
      Boolean(fivemResult) ||
      Boolean(domainResult),
    [
      combResult,
      domainResult,
      fivemResult,
      instagramResult,
      records.length,
      robloxResult,
    ],
  );

  /** Idle = no results surface yet — center the search composer in the viewport. */
  const hasResultsSurface = useMemo(() => {
    // Site pentest always mounts its results chrome; keep top layout.
    if (moduleDef.slug === "site-pentest") return true;

    return (
      Boolean(emptyResult) ||
      records.length > 0 ||
      Boolean(aiResult) ||
      Boolean(combResult) ||
      Boolean(domainResult) ||
      Boolean(discordResult) ||
      Boolean(intelxResult) ||
      Boolean(fivemResult) ||
      Boolean(stealerResult) ||
      Boolean(robloxResult) ||
      Boolean(instagramResult) ||
      Boolean(structuredResult)
    );
  }, [
    aiResult,
    combResult,
    discordResult,
    domainResult,
    emptyResult,
    fivemResult,
    instagramResult,
    intelxResult,
    moduleDef.slug,
    records.length,
    robloxResult,
    stealerResult,
    structuredResult,
  ]);

  const searchProgressStatus = useMemo(() => {
    if (!isSearching) return null;
    // Keep the composer calm — no provider/module names under the search bar.
    // Detailed fan-out labels still live on Discord/Instagram result panels.
    return "Searching…";
  }, [isSearching]);

  const rootRef = useRef<HTMLDivElement>(null);
  const scrolledForResultsRef = useRef(false);

  const shouldScrollToResults =
    hasResultsSurface &&
    (moduleDef.slug !== "site-pentest" ||
      structuredResult?.kind === "site-pentest");

  // First paint of results (incl. streamed partials) → scroll results into view.
  useEffect(() => {
    if (!shouldScrollToResults) {
      scrolledForResultsRef.current = false;

      return;
    }

    if (scrolledForResultsRef.current) return;

    scrolledForResultsRef.current = true;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const scrollToResults = () => {
      const el = rootRef.current?.querySelector<HTMLElement>(
        '[data-tour="search-results"]',
      );

      el?.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "start",
      });
    };

    requestAnimationFrame(() => {
      requestAnimationFrame(scrollToResults);
    });
  }, [shouldScrollToResults]);

  const handleSelectExportIndex = (index: number) => {
    setSelectedExportIndex(index < 0 ? null : index);
  };

  const resolveSelectedExport = ():
    | { kind: "record"; record: FormattedRecord }
    | { kind: "breach"; row: CombCredential; index: number }
    | null => {
    if (selectedExportIndex === null) return null;

    if (records.length > 0) {
      const record = records.find(
        (entry) => entry.index === selectedExportIndex,
      );

      if (record) return { kind: "record", record };
    }

    if (combResult) {
      const row = combResult.credentials[selectedExportIndex - 1];

      if (row) return { kind: "breach", row, index: selectedExportIndex };
    }

    if (robloxResult) {
      const robloxRecords = formatSearchRecords(robloxResult.results);
      const record = robloxRecords.find(
        (entry) => entry.index === selectedExportIndex,
      );

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
      const stealerRecord = stealerRecords.find(
        (entry) => entry.index === selectedExportIndex,
      );

      if (stealerRecord) return { kind: "record", record: stealerRecord };

      const breachRow =
        domainResult.breachedData?.credentials[selectedExportIndex - 1];

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

    const filename = safeExportFilename(
      lastSearchLabel || moduleDef.slug,
      format,
    );
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
    if (!instagramResult?.query || instagramEnriching || instagramLoadingMore)
      return;

    setInstagramEnriching(true);
    setError("");

    try {
      const response = await fetch(
        `/api/osint/instagram?query=${encodeURIComponent(instagramResult.query)}&moduleSlug=instagram-live&followUp=1&maxUsers=500&enrichBios=1&bioLimit=60&bubbleMap=1&includeActivity=1&maxPosts=12&maxTagged=12&commentPosts=4&secondDegree=1&secondDegreeBudget=12`,
      );
      const responseText = await response.text();
      let data: InstagramSearchPayload & { error?: string };

      try {
        data = responseText
          ? (JSON.parse(responseText) as InstagramSearchPayload & {
              error?: string;
            })
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
      body: JSON.stringify({ moduleSlug: billingModuleSlug }),
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

  const recordSearch = async (
    trimmed: string,
    type: string,
    resultData: string,
  ) => {
    const response = await apiFetch("/api/user/stats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: trimmed,
        type,
        moduleSlug: billingModuleSlug,
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

    const composed = isSummary
      ? {
          query: query.trim(),
          firstName: "",
          lastName: "",
          optionalFilters: {},
          hasInput: Boolean(query.trim()),
        }
      : composeModuleSearchFields(searchFields, moduleDef);

    if (composed.firstName) setFirstName(composed.firstName);
    if (composed.lastName) setLastName(composed.lastName);
    setOptionalFilterValues(composed.optionalFilters);

    const nameQuery = isPublicRecords
      ? composed.query ||
        [composed.firstName, composed.lastName]
          .map((part) => part.trim())
          .filter(Boolean)
          .join(" ")
      : composed.query;
    const trimmed = isPublicRecords
      ? composeModuleQuery(nameQuery, composed.optionalFilters)
      : composed.query;

    if (!trimmed) {
      setError(
        isPublicRecords
          ? "Enter a first and last name (optional filters alone are not enough)."
          : "Enter a search target.",
      );

      return;
    }

    setQuery(trimmed);

    const searchQuery = isDatingAppSlug(moduleDef.slug)
      ? normalizeDatingQuery(trimmed, moduleDef.slug)
      : trimmed;

    if (!trimmed) return;

    setIsSearching(true);
    clearResultState();
    setCasesLoaded(false);
    const initialBlur = shouldBlurResults(plan);

    setBlurResults(initialBlur);
    instagramLoadGenRef.current += 1;

    if (moduleLocked) {
      setError(moduleLocked);
      setIsSearching(false);

      return;
    }

    if (maintenanceMessage) {
      setError(maintenanceMessage);
      setIsSearching(false);

      return;
    }

    const access = await authorizeSearch();

    if (!access.allowed) {
      if (isMountedRef.current) {
        setError(access.reason || "This search is not available on your plan.");
        setIsSearching(false);
      }

      return;
    }

    let blurFlag = initialBlur;

    if (access.allowed && "blurResults" in access && access.blurResults) {
      blurFlag = true;
      if (isMountedRef.current) setBlurResults(true);
    }

    // Client-side validation before registering a background job.
    const validationError = (() => {
      if (isAi) return null;

      let activeType = resolveSearchApiType(moduleDef, trimmed);
      const selectedTool = moduleDef.tools?.find(
        (tool) => tool.id === selectedToolId,
      );

      if (selectedTool?.apiType) {
        activeType = selectedTool.apiType;
      }

      if (activeType === "breaches" && trimmed.length < 2) {
        return "Enter an email, username, or search term.";
      }
      if (activeType === "crypto-wallet" && !detectCryptoChain(trimmed)) {
        return CRYPTO_WALLET_INVALID_MESSAGE;
      }
      if (
        (activeType === "crypto-full" ||
          activeType === "crypto-address" ||
          activeType === "crypto-risk" ||
          activeType === "crypto-flow") &&
        !detectCryptoChain(trimmed) &&
        !(activeType === "crypto-full" && detectCryptoInput(trimmed).kind === "tx")
      ) {
        return CRYPTO_WALLET_INVALID_MESSAGE;
      }
      if (
        activeType === "crypto-tx" &&
        detectCryptoInput(trimmed).kind !== "tx"
      ) {
        return "Paste an Ethereum 0x…64 hash, Bitcoin 64-hex txid, or Solana signature.";
      }
      if (moduleDef.slug === "phone" && !isPhoneQuery(trimmed)) {
        return "Enter a valid phone number (10–15 digits).";
      }
      if (moduleDef.slug === "username" && trimmed.length < 2) {
        return "Enter a username (at least 2 characters).";
      }
      if (moduleDef.slug === "stealer-logs" && isDiscordSnowflake(trimmed)) {
        return "Discord IDs are not supported here. Use the Discord ID module.";
      }
      if (
        moduleDef.slug === "stealer-logs" &&
        composed.primaryType === "domain" &&
        !normalizeDomain(trimmed)
      ) {
        return "Enter a valid domain name (e.g. example.com).";
      }
      if (moduleDef.slug === "discord-id" && !isDiscordSnowflake(trimmed)) {
        return "Enter a valid Discord ID (17–20 digits).";
      }
      if (moduleDef.slug === "oathnet-roblox" && !isDiscordSnowflake(trimmed)) {
        return "Enter a valid Discord ID (17–20 digits).";
      }
      if (moduleDef.slug === "fraud-footprint") {
        const tool = moduleDef.tools?.find((t) => t.id === selectedToolId);
        const api = tool?.apiType || "seon/email";

        if (
          (api === "seon-email" ||
            api === "seon/email" ||
            api === "seon/email-verification") &&
          !normalizeEmail(trimmed)
        ) {
          return "Enter a valid email address.";
        }
        if (
          (api === "seon-phone" || api === "seon/phone") &&
          !isPhoneQuery(trimmed)
        ) {
          return "Enter a valid phone number (10–15 digits).";
        }
        if (
          api === "seon/ip" &&
          !/^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$|^[0-9a-f:]+$/i.test(
            trimmed,
          )
        ) {
          return "Enter a valid IP address.";
        }
        if (api === "seon/bin" && !/^\d{6,8}$/.test(trimmed)) {
          return "Enter a valid 6-8 digit BIN.";
        }
      }
      if (moduleDef.slug === "fivem" && !isDiscordSnowflake(trimmed)) {
        return "FiveM lookups require a Discord ID (17–20 digits).";
      }
      if (
        moduleDef.slug === "instagram" &&
        !normalizeInstagramUsername(trimmed)
      ) {
        return "Enter a valid Instagram username or profile URL.";
      }
      if (moduleDef.slug === "domain" && !normalizeDomain(trimmed)) {
        return "Enter a valid domain name (e.g. example.com).";
      }
      if (moduleDef.slug === "site-pentest" && !parseSitePentestTarget(trimmed)) {
        return "Enter a valid domain or http(s) URL (e.g. example.com).";
      }
      if (moduleDef.slug === "hash-lookup" && trimmed.length < 8) {
        return "Enter a valid hash (at least 8 characters).";
      }
      if (moduleDef.slug === "name-search" && trimmed.length < 2) {
        return "Enter a name to search (at least 2 characters).";
      }
      if (isPublicRecords) {
        if (!composed.firstName.trim() || !composed.lastName.trim()) {
          return "Enter both a first name and a last name.";
        }
        if (publicRecordsSources.length === 0) {
          return "Enable at least one source in Options.";
        }
      }

      return null;
    })();

    if (validationError) {
      setError(validationError);
      setIsSearching(false);

      return;
    }

    const { jobId, signal } = beginJob({
      moduleId: moduleDef.slug,
      moduleName: moduleDef.name,
      query: trimmed,
    });

    boundJobIdRef.current = jobId;

    const commitSuccess = (
      partial: Partial<ModuleSearchSnapshot>,
      persistData?: string,
    ) => {
      const snap: ModuleSearchSnapshot = {
        ...emptyModuleSearchSnapshot(trimmed, blurFlag),
        ...partial,
        query: trimmed,
        lastSearchLabel:
          partial.lastSearchLabel ?? `${moduleDef.name} · ${trimmed}`,
        blurResults: partial.blurResults ?? blurFlag,
      };

      completeJob(jobId, {
        payload: snapshotToPayload(snap),
        resultSummary: formatResultSummary(snap),
      });

      if (persistData) {
        persistSearch(trimmed, moduleDef.slug, persistData);
      }

      if (isMountedRef.current) {
        applySnapshot(snap);
        setIsSearching(false);
        setSearchProgressRatio(null);
      }
    };

    const commitEmpty = (message?: string | null) => {
      commitSuccess({
        emptyResult:
          (typeof message === "string" && message.trim()) ||
          "No results were found.",
      });
    };

    const commitFail = (message: string) => {
      failJob(jobId, message);
      if (isMountedRef.current) {
        setError(message);
        setIsSearching(false);
        setSearchProgressRatio(null);
      }
    };

    if (isAi) {
      try {
        const aiModuleSlug =
          toolAiMode === "crypto" ? "crypto-ai" : moduleDef.slug;
        const searchResponse = await fetch(
          `/api/osint/ai?query=${encodeURIComponent(trimmed)}&mode=${aiMode}&moduleSlug=${encodeURIComponent(aiModuleSlug)}`,
          { signal },
        );
        const data = (await searchResponse.json()) as AiIntelResult & {
          error?: string;
        };

        if (signal.aborted) return;

        if (!searchResponse.ok) {
          commitFail(data.error || "AI analysis failed.");

          return;
        }

        commitSuccess(
          {
            aiResult: data,
            rawResult: JSON.stringify(data, null, 2),
          },
          JSON.stringify(data),
        );
      } catch (err) {
        if (signal.aborted) return;
        commitFail(
          err instanceof Error && err.message
            ? sanitizePublicText(err.message)
            : "Could not complete AI analysis.",
        );
      }

      return;
    }

    let activeType = resolveSearchApiType(moduleDef, trimmed);
    const selectedTool = moduleDef.tools?.find(
      (tool) => tool.id === selectedToolId,
    );

    if (selectedTool?.apiType) {
      activeType = selectedTool.apiType;
    }

    // Generic multi-tool fan-out: query every tool apiType in parallel and
    // merge into one snapshot. Discord/stealer use server-stream (tools[0])
    // via the NDJSON paths below instead.
    const fanOutTools =
      fanOutBehavior.mode === "all-tools" && moduleDef.tools?.length
        ? moduleDef.tools.filter((tool) => {
            if (!tool.apiType || tool.aiMode) return false;
            // OathNet contribution is Ultimate / Enterprise only.
            if (
              isOathnetApiType(tool.apiType) &&
              !planHasUltimateModules(plan)
            ) {
              return false;
            }
            // Holehe / GHunt require an email address.
            if (
              (tool.apiType === "oathnet/holehe" ||
                tool.apiType === "oathnet/ghunt") &&
              !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(searchQuery)
            ) {
              return false;
            }
            // Domain-only OathNet pivots.
            if (
              (tool.apiType === "oathnet/stealer-subdomain" ||
                tool.apiType === "oathnet/extract-subdomain") &&
              !/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(searchQuery)
            ) {
              return false;
            }

            return true;
          })
        : [];

    if (fanOutTools.length > 1) {
      try {
        setJobProgress(
          jobId,
          `${moduleDef.name} · fan-out (0/${fanOutTools.length})`,
        );

        let doneCount = 0;
        const settled = await Promise.all(
          fanOutTools.map(async (tool) => {
            const apiType = tool.apiType!;
            const indexSweepKindParam =
              apiType === "index-sweep" &&
              (moduleDef.slug === "phone" ||
                moduleDef.slug === "phone-index" ||
                tool.id === "phone-index")
                ? "&kind=phone"
                : "";
            const reconlyModeParam =
              apiType === "reconly" &&
              (tool.id === "reconly-fivem" || moduleDef.slug === "fivem")
                ? "&mode=fivem"
                : "";
            const instagramParam =
              apiType === "instagram"
                ? "&maxUsers=100&includeActivity=0&enrichBios=0"
                : "";
            const emailPresenceDeepParam =
              apiType === "email-presence" &&
              moduleDef.slug === "email-presence" &&
              contactProfilesDeep
                ? "&deep=1"
                : "";
            const toolBillingSlug =
              apiType === "instagram"
                ? "instagram-live"
                : apiType === "email-presence" &&
                    moduleDef.slug === "email-presence" &&
                    contactProfilesDeep
                  ? "email-presence-deep"
                  : apiType === "email-presence"
                    ? "email-presence"
                    : moduleDef.slug === "hinge-live"
                      ? "hinge-live"
                      : moduleDef.slug;
            const searchUrl = `${resolveSearchApiPath(apiType)}?query=${encodeURIComponent(searchQuery)}&scope=${encodeURIComponent(moduleDef.slug)}&moduleSlug=${encodeURIComponent(toolBillingSlug)}${indexSweepKindParam}${reconlyModeParam}${instagramParam}${emailPresenceDeepParam}`;

            try {
              const searchResponse = await fetch(searchUrl, { signal });
              const responseText = await searchResponse.text();
              let data: Record<string, unknown> = {};

              try {
                data = responseText
                  ? (JSON.parse(responseText) as Record<string, unknown>)
                  : {};
              } catch {
                doneCount += 1;
                setJobProgress(
                  jobId,
                  `${moduleDef.name} · fan-out (${doneCount}/${fanOutTools.length})`,
                );

                return {
                  tool,
                  ok: false as const,
                  error: "Search returned an unexpected response.",
                  data: null as Record<string, unknown> | null,
                };
              }

              doneCount += 1;
              setJobProgress(
                jobId,
                `${moduleDef.name} · ${tool.label} (${doneCount}/${fanOutTools.length})`,
              );

              if (!searchResponse.ok) {
                return {
                  tool,
                  ok: false as const,
                  error:
                    typeof data.error === "string"
                      ? data.error
                      : "Search failed.",
                  data,
                };
              }

              return {
                tool,
                ok: true as const,
                error: null as string | null,
                data,
              };
            } catch (err) {
              if (signal.aborted) throw err;

              doneCount += 1;
              setJobProgress(
                jobId,
                `${moduleDef.name} · fan-out (${doneCount}/${fanOutTools.length})`,
              );

              return {
                tool,
                ok: false as const,
                error:
                  err instanceof Error && err.message
                    ? err.message
                    : "Search failed.",
                data: null as Record<string, unknown> | null,
              };
            }
          }),
        );

        if (signal.aborted) return;

        let vinData: VinDecodeResult | null = null;
        let binData: BinLookupResult | null = null;
        let accountsData: AccountPresenceSearchResult | null = null;
        let presenceData: EmailPresenceSearchResult | null = null;
        let sweepData: IndexSweepSearchResult | null = null;
        let domainData: DomainSearchResult | null = null;
        let combData: CombSearchResult | null = null;
        let robloxData: RobloxSearchResult | null = null;
        let fivemData: FivemSearchResult | null = null;
        const mergedRecords: FormattedRecord[] = [];
        const rawBundle: Record<string, unknown> = {};
        let hadOk = false;

        const pushRecords = (
          rows: FormattedRecord[],
          badgeFallback: string,
        ) => {
          for (const rec of rows) {
            mergedRecords.push({
              ...rec,
              badge: rec.badge ?? badgeFallback,
              index: mergedRecords.length + 1,
            });
          }
        };

        for (const item of settled) {
          if (item.data) rawBundle[item.tool.id] = item.data;
          if (!item.ok || !item.data) continue;

          hadOk = true;

          const apiType = item.tool.apiType ?? "";
          const label = item.tool.label;

          if (apiType === "vin") {
            const candidate = item.data as VinDecodeResult & {
              fields?: Record<string, string>;
              indexHits?: { results?: unknown[] };
            };

            if (
              !vinData &&
              candidate.fields &&
              Object.keys(candidate.fields).length > 0
            ) {
              vinData = {
                vin:
                  typeof candidate.vin === "string" && candidate.vin
                    ? candidate.vin
                    : searchQuery,
                fields: candidate.fields,
                errorText: candidate.errorText,
              };
            }

            const indexResults = Array.isArray(candidate.indexHits?.results)
              ? candidate.indexHits.results
              : [];

            if (indexResults.length > 0) {
              pushRecords(formatSearchRecords(indexResults), "VIN index");
            }

            continue;
          }

          if (apiType === "bin") {
            if (!binData) binData = item.data as BinLookupResult;
            continue;
          }

          if (apiType === "domains") {
            const candidate = item.data as DomainSearchResult;

            if (candidate.hasResults && !domainData) {
              domainData = candidate;
            }

            continue;
          }

          if (apiType === "breaches") {
            const candidate = item.data as CombSearchResult;

            if (!combData) combData = candidate;
            continue;
          }

          if (
            apiType === "username-accounts" ||
            apiType === "handle-sweep"
          ) {
            const candidate = item.data as AccountPresenceSearchResult;

            if (
              candidate.count > 0 &&
              Array.isArray(candidate.sources) &&
              candidate.sources.length > 0
            ) {
              if (!accountsData) {
                accountsData = {
                  ...candidate,
                  sources: candidate.sources.map((block) => ({
                    ...block,
                    found: [...block.found],
                  })),
                };
              } else {
                const current: AccountPresenceSearchResult = accountsData;
                for (const block of candidate.sources) {
                  const existing = current.sources.find(
                    (entry) => entry.id === block.id,
                  );

                  if (!existing) {
                    current.sources.push({
                      ...block,
                      found: [...block.found],
                    });
                    continue;
                  }

                  const seen = new Set(existing.found.map((hit) => hit.url));

                  for (const hit of block.found) {
                    if (seen.has(hit.url)) continue;
                    seen.add(hit.url);
                    existing.found.push(hit);
                  }

                  existing.count = existing.found.length;
                  existing.checked += block.checked;
                  existing.errors += block.errors;
                }

                accountsData = {
                  query: current.query,
                  username: current.username,
                  durationMs: current.durationMs,
                  warning: current.warning,
                  count: current.sources.reduce(
                    (sum, block) => sum + block.count,
                    0,
                  ),
                  checked: current.sources.reduce(
                    (sum, block) => sum + block.checked,
                    0,
                  ),
                  sources: current.sources,
                };
              }
            }

            continue;
          }

          if (apiType === "email-presence") {
            const candidate = item.data as EmailPresenceSearchResult;

            if (candidate.found?.length && !presenceData) {
              presenceData = candidate;
            }

            continue;
          }

          if (apiType === "index-sweep") {
            const candidate = item.data as IndexSweepSearchResult;

            if (candidate.dorks?.length && !sweepData) {
              sweepData = candidate;
            }

            continue;
          }

          if (apiType === "roblox") {
            const candidate = item.data as RobloxSearchResult;

            if (!robloxData) robloxData = candidate;
            continue;
          }

          if (apiType === "fivem") {
            const candidate = item.data as FivemSearchResult;

            if (!fivemData) fivemData = candidate;
            continue;
          }

          if (apiType === "breach") {
            const breachData = item.data as {
              results?: unknown[];
              message?: string;
            };
            const results = Array.isArray(breachData.results)
              ? breachData.results
              : [];

            if (results.length > 0) {
              pushRecords(formatSearchRecords(results), label);
            }

            continue;
          }

          pushRecords(formatStructuredSearchData(item.data), label);
        }

        const recordsOut = mergedRecords.map((rec, i) => ({
          ...rec,
          index: i + 1,
        }));

        const structuredResult: StructuredSearchResult | null = vinData
          ? { kind: "vin", data: vinData }
          : binData
            ? { kind: "bin", data: binData }
            : accountsData
              ? { kind: "username-accounts", data: accountsData }
              : presenceData
                ? { kind: "email-presence", data: presenceData }
                : sweepData
                  ? { kind: "index-sweep", data: sweepData }
                  : null;

        const hasSpecialty = Boolean(
          structuredResult ||
            domainData ||
            combData ||
            robloxData ||
            fivemData ||
            recordsOut.length > 0,
        );

        if (hasSpecialty) {
          commitSuccess(
            {
              ...(structuredResult ? { structuredResult } : {}),
              ...(domainData ? { domainResult: domainData } : {}),
              ...(combData ? { combResult: combData } : {}),
              ...(robloxData ? { robloxResult: robloxData } : {}),
              ...(fivemData ? { fivemResult: fivemData } : {}),
              records: recordsOut,
              resultCount:
                (structuredResult ? 1 : 0) +
                (domainData ? 1 : 0) +
                (combData?.returned ?? 0) +
                (robloxData?.results?.length ?? 0) +
                recordsOut.length,
              rawResult: JSON.stringify(rawBundle, null, 2),
              lastSearchLabel: `${moduleDef.name} · ${trimmed}`,
            },
            JSON.stringify(rawBundle),
          );

          return;
        }

        if (!hadOk) {
          const firstErr = settled.find((s) => s.error)?.error;

          commitFail(sanitizePublicText(firstErr || "Search failed."));

          return;
        }

        commitEmpty();
      } catch (err) {
        if (signal.aborted) return;
        commitFail(
          err instanceof Error && err.message
            ? sanitizePublicText(err.message)
            : "Could not complete the search.",
        );
      }

      return;
    }

    // stealer-logs uses /api/osint/stealer (multi-source fan-out + victims).

    const discordHasSignal = (discordData: DiscordSearchResult) => {
      const hasProfile = Boolean(
        discordData.profile &&
          discordData.profile.username &&
          discordData.profile.username !== "Unknown",
      );
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
      const hasGuilds =
        (discordData.guilds?.count ?? 0) > 0 ||
        (discordData.guilds?.items?.length ?? 0) > 0;
      const hasConnections =
        (discordData.connections?.length ?? 0) > 0 ||
        (discordData.usernameHistory?.length ?? 0) > 0;
      const hasContacts = Boolean(
        discordData.contacts?.email ||
          discordData.contacts?.phone ||
          discordData.contacts?.ip,
      );

      return (
        hasProfile ||
        hasLeaks ||
        hasRoblox ||
        hasEnrichment ||
        hasFivem ||
        hasDsa ||
        hasGuilds ||
        hasConnections ||
        hasContacts
      );
    };

    // Discord ID main fan-out: stream NDJSON partials so results paint early.
    if (activeType === "discord") {
      try {
        const searchUrl = `${resolveSearchApiPath(activeType)}?query=${encodeURIComponent(searchQuery)}&scope=${encodeURIComponent(moduleDef.slug)}&moduleSlug=${encodeURIComponent(moduleDef.slug)}&stream=1`;
        const searchResponse = await fetch(searchUrl, {
          signal,
          headers: { Accept: "application/x-ndjson" },
        });

        if (signal.aborted) return;

        if (!searchResponse.ok) {
          const responseText = await searchResponse.text();
          let data: Record<string, unknown> = {};

          try {
            data = responseText
              ? (JSON.parse(responseText) as Record<string, unknown>)
              : {};
          } catch {
            /* ignore */
          }

          commitFail(
            sanitizePublicText(
              typeof data.error === "string" ? data.error : "Search failed.",
            ),
          );

          return;
        }

        const contentType = searchResponse.headers.get("content-type") ?? "";
        let finalDiscord: DiscordSearchResult | null = null;
        let streamError: string | null = null;

        if (
          contentType.includes("ndjson") &&
          searchResponse.body
        ) {
          const reader = searchResponse.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          if (isMountedRef.current) {
            setDiscordLoadingMore(true);
            setDiscordProgressLabel("Assembling Discord fan-out…");
            setJobProgress(jobId, "Discord OSINT · starting");
            setEmptyResult("");
            setLastSearchLabel(`${moduleDef.name} · ${trimmed}`);
            // Soft shell so the compact loader paints before the first module settles.
            setDiscordResult({
              id: searchQuery,
              profile: {
                id: searchQuery,
                username: "Unknown",
                globalName: null,
                displayName: searchQuery,
                avatarUrl: "",
                bannerUrl: null,
                bannerColor: null,
                accentColor: null,
                createdAt: new Date(
                  Number(BigInt(searchQuery) >> 22n) + 1_420_070_400_000,
                ).toISOString(),
                badges: [],
                discriminator: "0",
                bio: null,
                nitro: false,
                clanTag: null,
                clanBadgeUrl: null,
                avatarDecorationUrl: null,
                nameplate: null,
                profilePreviewUrl: `https://discord.com/users/${encodeURIComponent(searchQuery)}`,
              },
              leaks: { count: 0, results: [] },
              fivem: { count: 0, accounts: [], bans: [] },
              dsa: { count: 0, sanctions: [] },
              enrichment: null,
              robloxLink: null,
              guilds: { count: 0, items: [] },
              connections: [],
              contacts: undefined,
              usernameHistory: [],
            });
          }

          while (true) {
            const { done, value } = await reader.read();

            if (done) break;
            if (signal.aborted) return;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");

            buffer = lines.pop() ?? "";

            for (const line of lines) {
              const trimmedLine = line.trim();

              if (!trimmedLine) continue;

              let event: {
                type?: string;
                module?: string;
                done?: number;
                total?: number;
                error?: string;
                result?: DiscordSearchResult;
              };

              try {
                event = JSON.parse(trimmedLine) as typeof event;
              } catch {
                continue;
              }

              if (event.type === "error") {
                streamError =
                  typeof event.error === "string"
                    ? event.error
                    : "Search failed.";
                if (event.result) finalDiscord = event.result;
                continue;
              }

              if (
                (event.type === "partial" || event.type === "done") &&
                event.result
              ) {
                finalDiscord = event.result;

                if (event.type === "partial" && isMountedRef.current) {
                  const moduleLabel =
                    typeof event.module === "string" && event.module
                      ? event.module
                      : "module";
                  const progress =
                    typeof event.done === "number" &&
                    typeof event.total === "number"
                      ? `${event.done}/${event.total}`
                      : "";
                  const label = progress
                    ? `Discord OSINT · ${moduleLabel} (${progress})`
                    : `Discord OSINT · ${moduleLabel}`;

                  setDiscordProgressLabel(label);
                  setJobProgress(jobId, label);
                  if (
                    typeof event.done === "number" &&
                    typeof event.total === "number" &&
                    event.total > 0
                  ) {
                    setSearchProgressRatio(event.done / event.total);
                  }

                  if (discordHasSignal(event.result)) {
                    setEmptyResult("");
                    setDiscordResult(event.result);
                    setRawResult(JSON.stringify(event.result, null, 2));
                    setLastSearchLabel(`${moduleDef.name} · ${trimmed}`);
                  }
                }
              }
            }
          }
        } else {
          const responseText = await searchResponse.text();
          let data: Record<string, unknown> = {};

          try {
            data = responseText
              ? (JSON.parse(responseText) as Record<string, unknown>)
              : {};
          } catch {
            commitFail("Search returned an unexpected response. Try again.");

            return;
          }

          finalDiscord = data as DiscordSearchResult;
        }

        if (signal.aborted) return;

        if (isMountedRef.current) {
          setDiscordLoadingMore(false);
          setDiscordProgressLabel("");
        }

        if (streamError && !finalDiscord) {
          commitFail(sanitizePublicText(streamError));

          return;
        }

        if (!finalDiscord || !discordHasSignal(finalDiscord)) {
          commitEmpty(
            streamError ||
              (finalDiscord as { error?: string } | null)?.error ||
              "No results were found.",
          );

          return;
        }

        commitSuccess(
          {
            discordResult: finalDiscord,
            rawResult: JSON.stringify(finalDiscord, null, 2),
          },
          JSON.stringify(finalDiscord),
        );
      } catch (err) {
        if (signal.aborted) return;
        if (isMountedRef.current) {
          setDiscordLoadingMore(false);
          setDiscordProgressLabel("");
        }
        commitFail(
          err instanceof Error && err.message
            ? sanitizePublicText(err.message)
            : "Search failed.",
        );
      }

      return;
    }

    // Stealer Logs hub: stream NDJSON partials so credentials/archives paint early.
    if (activeType === "stealer") {
      try {
        const searchUrl = `${resolveSearchApiPath(activeType)}?query=${encodeURIComponent(searchQuery)}&scope=${encodeURIComponent(moduleDef.slug)}&moduleSlug=${encodeURIComponent(moduleDef.slug)}&stream=1`;
        const searchResponse = await fetch(searchUrl, {
          signal,
          headers: { Accept: "application/x-ndjson" },
        });

        if (signal.aborted) return;

        if (!searchResponse.ok) {
          const responseText = await searchResponse.text();
          let data: Record<string, unknown> = {};

          try {
            data = responseText
              ? (JSON.parse(responseText) as Record<string, unknown>)
              : {};
          } catch {
            /* ignore */
          }

          commitFail(
            sanitizePublicText(
              typeof data.error === "string"
                ? data.error
                : `Search failed (HTTP ${searchResponse.status}). Try again.`,
            ),
          );

          return;
        }

        const contentType = searchResponse.headers.get("content-type") ?? "";
        type StealerStreamPayload = {
          query?: string;
          count?: number;
          results?: unknown[];
          credentials?: StealerCredentialRow[];
          archives?: StealerArchiveEntry[];
          breachedData?: CombSearchResult | null;
          message?: string;
          error?: string;
        };
        let finalStealer: StealerStreamPayload | null = null;
        let streamError: string | null = null;

        const applyStealerPayload = (
          payload: StealerStreamPayload,
          opts?: { progress?: string },
        ) => {
          const results = Array.isArray(payload.results) ? payload.results : [];
          const credentials = Array.isArray(payload.credentials)
            ? payload.credentials
            : [];
          const archives = Array.isArray(payload.archives)
            ? payload.archives
            : [];
          const breachedData = payload.breachedData ?? null;
          const breachCount = breachedData?.credentials?.length ?? 0;
          const count =
            typeof payload.count === "number"
              ? payload.count
              : Math.max(
                  credentials.length,
                  results.length,
                  archives.length,
                  breachCount,
                );

          if (isMountedRef.current) {
            if (opts?.progress) {
              setJobProgress(jobId, opts.progress);
            }
            setEmptyResult("");
            setLastSearchLabel(`${moduleDef.name} · ${trimmed}`);
            setStealerResult({
              credentials,
              archives,
              count,
              breachedData,
              fallbackRecords:
                results.length > 0 && credentials.length === 0
                  ? formatSearchRecords(results)
                  : [],
            });
            setResultCount(count);
            setRawResult(JSON.stringify(payload, null, 2));
          }
        };

        if (contentType.includes("ndjson") && searchResponse.body) {
          const reader = searchResponse.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          if (isMountedRef.current) {
            setJobProgress(jobId, "Stealer OSINT · starting");
            setEmptyResult("");
            setLastSearchLabel(`${moduleDef.name} · ${trimmed}`);
            setStealerResult({
              credentials: [],
              archives: [],
              count: 0,
              fallbackRecords: [],
            });
          }

          while (true) {
            const { done, value } = await reader.read();

            if (done) break;
            if (signal.aborted) return;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");

            buffer = lines.pop() ?? "";

            for (const line of lines) {
              const trimmedLine = line.trim();

              if (!trimmedLine) continue;

              let event: {
                type?: string;
                module?: string;
                done?: number;
                total?: number;
                error?: string;
                result?: StealerStreamPayload;
              };

              try {
                event = JSON.parse(trimmedLine) as typeof event;
              } catch {
                continue;
              }

              if (event.type === "error") {
                streamError =
                  typeof event.error === "string"
                    ? event.error
                    : "Search failed.";
                if (event.result) finalStealer = event.result;
                continue;
              }

              if (
                (event.type === "partial" || event.type === "done") &&
                event.result
              ) {
                finalStealer = event.result;

                if (event.type === "partial" && isMountedRef.current) {
                  const moduleLabel =
                    typeof event.module === "string" && event.module
                      ? event.module
                      : "module";
                  const progress =
                    typeof event.done === "number" &&
                    typeof event.total === "number"
                      ? `Stealer OSINT · ${moduleLabel} (${event.done}/${event.total})`
                      : `Stealer OSINT · ${moduleLabel}`;

                  if (
                    typeof event.done === "number" &&
                    typeof event.total === "number" &&
                    event.total > 0
                  ) {
                    setSearchProgressRatio(event.done / event.total);
                  }

                  applyStealerPayload(event.result, { progress });
                }
              }
            }
          }
        } else {
          const responseText = await searchResponse.text();
          try {
            finalStealer = JSON.parse(responseText) as StealerStreamPayload;
          } catch {
            commitFail("Search returned an unexpected response. Try again.");

            return;
          }
        }

        if (signal.aborted) return;

        if (streamError && !finalStealer) {
          commitFail(sanitizePublicText(streamError));

          return;
        }

        if (!finalStealer) {
          commitEmpty(streamError || "No results were found.");

          return;
        }

        const results = Array.isArray(finalStealer.results)
          ? finalStealer.results
          : [];
        const credentials = Array.isArray(finalStealer.credentials)
          ? finalStealer.credentials
          : [];
        const archives = Array.isArray(finalStealer.archives)
          ? finalStealer.archives
          : [];
        const breachedData = finalStealer.breachedData ?? null;
        const breachCount = breachedData?.credentials?.length ?? 0;

        if (
          results.length === 0 &&
          credentials.length === 0 &&
          archives.length === 0 &&
          breachCount === 0
        ) {
          commitEmpty(
            streamError ||
              finalStealer.message ||
              finalStealer.error ||
              "No results were found.",
          );

          return;
        }

        const count =
          typeof finalStealer.count === "number"
            ? finalStealer.count
            : Math.max(
                credentials.length,
                results.length,
                archives.length,
                breachCount,
              );

        commitSuccess(
          {
            stealerResult: {
              credentials,
              archives,
              count,
              breachedData,
              fallbackRecords:
                results.length > 0 && credentials.length === 0
                  ? formatSearchRecords(results)
                  : [],
            },
            resultCount: count,
            rawResult: JSON.stringify(finalStealer, null, 2),
          },
          JSON.stringify(finalStealer),
        );
      } catch (err) {
        if (signal.aborted) return;
        commitFail(
          err instanceof Error && err.message
            ? sanitizePublicText(err.message)
            : "Search failed.",
        );
      }

      return;
    }

    // Breaches hub: stream NDJSON partials so credentials paint as providers finish.
    if (activeType === "breaches") {
      try {
        const breachKind = fieldTypeToBreachKindHint(composed.primaryType);
        const typeParam = breachKind
          ? `&type=${encodeURIComponent(breachKind)}`
          : "";
        const searchUrl = `${resolveSearchApiPath(activeType)}?query=${encodeURIComponent(searchQuery)}&scope=${encodeURIComponent(moduleDef.slug)}&moduleSlug=${encodeURIComponent(moduleDef.slug)}${typeParam}&stream=1`;
        const searchResponse = await fetch(searchUrl, {
          signal,
          headers: { Accept: "application/x-ndjson" },
        });

        if (signal.aborted) return;

        if (!searchResponse.ok) {
          const responseText = await searchResponse.text();
          let data: Record<string, unknown> = {};

          try {
            data = responseText
              ? (JSON.parse(responseText) as Record<string, unknown>)
              : {};
          } catch {
            /* ignore */
          }

          commitFail(
            sanitizePublicText(
              typeof data.error === "string"
                ? data.error
                : `Search failed (HTTP ${searchResponse.status}). Try again.`,
            ),
          );

          return;
        }

        type BreachesStreamPayload = CombSearchResult & {
          error?: string;
          message?: string;
          hasGodsEyeReport?: boolean;
          godseyeReport?: Record<string, unknown> | null;
          hasBreachVipResults?: boolean;
          breachVipCount?: number;
          csintCount?: number;
          breachHubCount?: number;
          osintCatCount?: number;
          godseyeSearchCount?: number;
        };

        let finalBreaches: BreachesStreamPayload | null = null;
        let streamError: string | null = null;

        const isBreachesEmpty = (payload: BreachesStreamPayload) =>
          payload.returned === 0 &&
          !payload.hasGodsEyeReport &&
          !payload.hasBreachVipResults &&
          !(payload.csintCount && payload.csintCount > 0) &&
          !(payload.breachHubCount && payload.breachHubCount > 0) &&
          !(payload.osintCatCount && payload.osintCatCount > 0) &&
          !(payload.godseyeSearchCount && payload.godseyeSearchCount > 0);

        const applyBreachesPayload = (
          payload: BreachesStreamPayload,
          opts?: { progress?: string },
        ) => {
          if (!isMountedRef.current) return;

          if (opts?.progress) {
            setJobProgress(jobId, opts.progress);
          }

          setEmptyResult("");
          setLastSearchLabel(`${moduleDef.name} · ${trimmed}`);
          setCombResult(payload);
          setResultCount(
            typeof payload.returned === "number"
              ? payload.returned
              : payload.credentials?.length ?? 0,
          );
          setRawResult(JSON.stringify(payload, null, 2));
        };

        const contentType = searchResponse.headers.get("content-type") ?? "";

        if (contentType.includes("ndjson") && searchResponse.body) {
          const reader = searchResponse.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          if (isMountedRef.current) {
            setJobProgress(jobId, "Breaches · starting");
            setEmptyResult("");
            setLastSearchLabel(`${moduleDef.name} · ${trimmed}`);
            setCombResult({
              source: "Breached Data",
              query: searchQuery,
              totalMatches: 0,
              returned: 0,
              start: 0,
              credentials: [],
            });
          }

          while (true) {
            const { done, value } = await reader.read();

            if (done) break;
            if (signal.aborted) return;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");

            buffer = lines.pop() ?? "";

            for (const line of lines) {
              const trimmedLine = line.trim();

              if (!trimmedLine) continue;

              let event: {
                type?: string;
                module?: string;
                done?: number;
                total?: number;
                error?: string;
                result?: BreachesStreamPayload;
              };

              try {
                event = JSON.parse(trimmedLine) as typeof event;
              } catch {
                continue;
              }

              if (event.type === "error") {
                streamError =
                  typeof event.error === "string"
                    ? event.error
                    : "Search failed.";
                // Keep the best partial — never clobber real rows with softEmpty.
                if (
                  event.result &&
                  !isBreachesEmpty(event.result) &&
                  (event.result.credentials?.length ?? 0) >=
                    (finalBreaches?.credentials?.length ?? 0)
                ) {
                  finalBreaches = event.result;
                }
                continue;
              }

              if (
                (event.type === "partial" || event.type === "done") &&
                event.result
              ) {
                const incomingCount = event.result.credentials?.length ?? 0;
                const currentCount = finalBreaches?.credentials?.length ?? 0;

                // Never shrink an already-painted credential set (timeout /
                // softEmpty frames used to freeze the UI at Comb-only counts).
                if (!finalBreaches || incomingCount >= currentCount) {
                  finalBreaches = event.result;
                } else if (event.type === "done" && finalBreaches) {
                  finalBreaches = {
                    ...event.result,
                    credentials: finalBreaches.credentials,
                    returned: finalBreaches.credentials.length,
                    totalMatches: finalBreaches.credentials.length,
                    breachHubCount:
                      event.result.breachHubCount ??
                      finalBreaches.breachHubCount,
                    csintCount:
                      event.result.csintCount ?? finalBreaches.csintCount,
                    message: event.result.message ?? finalBreaches.message,
                  };
                }

                if (event.type === "partial" && isMountedRef.current) {
                  const moduleLabel =
                    typeof event.module === "string" && event.module
                      ? event.module
                      : "module";
                  const progress =
                    typeof event.done === "number" &&
                    typeof event.total === "number"
                      ? `Breaches · ${moduleLabel} (${event.done}/${event.total})`
                      : `Breaches · ${moduleLabel}`;

                  if (
                    typeof event.done === "number" &&
                    typeof event.total === "number" &&
                    event.total > 0
                  ) {
                    setSearchProgressRatio(event.done / event.total);
                  }

                  applyBreachesPayload(finalBreaches ?? event.result, {
                    progress,
                  });
                }
              }
            }
          }
        } else {
          const responseText = await searchResponse.text();

          try {
            finalBreaches = JSON.parse(responseText) as BreachesStreamPayload;
          } catch {
            commitFail("Search returned an unexpected response. Try again.");

            return;
          }
        }

        if (signal.aborted) return;

        if (streamError && !finalBreaches) {
          commitFail(sanitizePublicText(streamError));

          return;
        }

        if (!finalBreaches || isBreachesEmpty(finalBreaches)) {
          commitEmpty(
            streamError ||
              finalBreaches?.message ||
              finalBreaches?.error ||
              "No results were found.",
          );

          return;
        }

        commitSuccess(
          {
            combResult: finalBreaches,
            resultCount:
              typeof finalBreaches.returned === "number"
                ? finalBreaches.returned
                : finalBreaches.credentials?.length ?? 0,
            rawResult: JSON.stringify(finalBreaches, null, 2),
          },
          JSON.stringify(finalBreaches),
        );
      } catch (err) {
        if (signal.aborted) return;
        commitFail(
          err instanceof Error && err.message
            ? sanitizePublicText(err.message)
            : "Search failed.",
        );
      }

      return;
    }

    try {
      const scopeParam = `&scope=${encodeURIComponent(moduleDef.slug)}`;
      const moduleParam = `&moduleSlug=${encodeURIComponent(billingModuleSlug)}`;
      // Progressive Instagram load: first ~100 for fast map paint, then paced
      // batches up to 500 so we self-rate-limit instead of scraping thousands.
      const instagramParam =
        activeType === "instagram"
          ? "&maxUsers=100&includeActivity=0&enrichBios=0"
          : "";
      const emailPresenceDeepParam =
        activeType === "email-presence" && contactProfilesDeep
          ? "&deep=1"
          : "";
      const pentestParam =
        activeType === "site-pentest"
          ? `&modules=${encodeURIComponent(pentestModules.join(","))}`
          : "";
      const publicRecordsParam =
        activeType === "public-records"
          ? `&sources=${encodeURIComponent(publicRecordsSources.join(","))}`
          : "";
      // Phone surfaces force phone path so every format variant is searched strictly.
      const indexSweepKindParam =
        activeType === "index-sweep" &&
        (moduleDef.slug === "phone" ||
          moduleDef.slug === "phone-index" ||
          selectedToolId === "phone-index")
          ? "&kind=phone"
          : "";
      const reconlyModeParam =
        activeType === "reconly" &&
        (selectedToolId === "reconly-fivem" || moduleDef.slug === "fivem")
          ? "&mode=fivem"
          : "";
      // Twitter uses dedicated OsintCat twitter-osint (+ BreachHub fallback).
      // Snusbase / IntelVault / etc. use top-level /api/<vendor> paths.
      const searchUrl =
        moduleDef.slug === "twitter"
          ? `/api/osintcat/twitter-osint?query=${encodeURIComponent(searchQuery)}${moduleParam}`
          : `${resolveSearchApiPath(activeType)}?query=${encodeURIComponent(searchQuery)}${scopeParam}${moduleParam}${instagramParam}${emailPresenceDeepParam}${pentestParam}${publicRecordsParam}${indexSweepKindParam}${reconlyModeParam}`;
      const searchResponse = await fetch(searchUrl, { signal });
      const responseText = await searchResponse.text();
      let data: Record<string, unknown> = {};

      try {
        data = responseText
          ? (JSON.parse(responseText) as Record<string, unknown>)
          : {};
      } catch {
        if (signal.aborted) return;
        commitFail(
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

      if (signal.aborted) return;

      if (!searchResponse.ok) {
        commitFail(
          sanitizePublicText(
            typeof data.error === "string" ? data.error : "Search failed.",
          ),
        );

        return;
      }

      const serialized = JSON.stringify(data);
      const markNoResults = commitEmpty;

      // Vendor stealer chips (SeekNow / Wentyn / DataVoid / …) — normalize into
      // the stealer credentials/archives view used by the All-stealers hub.
      if (
        moduleDef.slug === "stealer-logs" &&
        activeType !== "breach" &&
        activeType !== "stealer"
      ) {
        const vendor = data as {
          results?: unknown[];
          count?: number;
          message?: string;
          error?: string;
          credentials?: StealerCredentialRow[];
          archives?: StealerArchiveEntry[];
        };
        const results = Array.isArray(vendor.results) ? vendor.results : [];
        const credentials = Array.isArray(vendor.credentials)
          ? vendor.credentials
          : extractStealerCredentialRows(results, searchQuery);
        const archives = mergeStealerArchives(
          Array.isArray(vendor.archives) ? vendor.archives : [],
          extractStealerArchives({ results }),
          archivesFromStealerResults(results),
        );

        if (
          results.length === 0 &&
          credentials.length === 0 &&
          archives.length === 0
        ) {
          markNoResults(vendor.message || vendor.error);

          return;
        }

        commitSuccess(
          {
            stealerResult: {
              credentials,
              archives,
              count:
                typeof vendor.count === "number"
                  ? vendor.count
                  : Math.max(
                      credentials.length,
                      results.length,
                      archives.length,
                    ),
              fallbackRecords:
                results.length > 0 && credentials.length === 0
                  ? formatSearchRecords(results)
                  : [],
            },
            resultCount:
              typeof vendor.count === "number"
                ? vendor.count
                : Math.max(
                    credentials.length,
                    results.length,
                    archives.length,
                  ),
            rawResult: JSON.stringify(data, null, 2),
          },
          serialized,
        );

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

        commitSuccess({


          domainResult: domainData,


          rawResult: JSON.stringify(domainData, null, 2),


        }, serialized);


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

        commitSuccess({


          fivemResult: fivemData,


          rawResult: JSON.stringify(fivemData, null, 2),


        }, serialized);


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
          commitFail(robloxData.error);

          return;
        }

        if (!hasResults && !hasLinked && !hasDiscordToRoblox) {
          markNoResults(robloxData.message);

          return;
        }

        commitSuccess({


          robloxResult: robloxData,


          rawResult: JSON.stringify(robloxData, null, 2),


        }, serialized);


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

        commitSuccess({
          records: formatted,
          resultCount:
            typeof linkData.count === "number" ? linkData.count : results.length,
          rawResult: JSON.stringify(data, null, 2),
        }, serialized);

        return;
      }

      if (activeType === "instagram") {
        const instagramData = data as InstagramSearchPayload & {
          error?: string;
          message?: string;
        };

        if (instagramData.error) {
          commitFail(instagramData.error);

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

        commitSuccess(
          {
            instagramResult: {
              ...instagramData,
              mutuals: instagramData.mutuals ?? [],
            },
            rawResult: JSON.stringify(instagramData, null, 2),
          },
          serialized,
        );

        // Background paced batches — UI already shows first ~100.
        const loadGen = ++instagramLoadGenRef.current;
        const username = instagramData.query || trimmed;

        void (async () => {
          const chill = (ms: number) =>
            new Promise((resolve) => setTimeout(resolve, ms));

          if (!isMountedRef.current) return;

          setInstagramLoadingMore(true);
          setInstagramProgressLabel(
            "First ~100 connections loaded. Pausing, then fetching up to 500…",
          );

          try {
            // Self-rate-limit: wait before the heavier pass.
            await chill(4_000);
            if (
              !isMountedRef.current ||
              instagramLoadGenRef.current !== loadGen
            ) {
              return;
            }

            setInstagramProgressLabel(
              "Fetching more connections (capped at 500) and activity signals…",
            );

            const response = await fetch(
              `/api/osint/instagram?query=${encodeURIComponent(username)}&moduleSlug=instagram-live&followUp=1&maxUsers=500&includeActivity=1&maxPosts=12&maxTagged=12&commentPosts=4&enrichBios=0`,
            );
            const text = await response.text();

            if (!response.ok || !text) return;

            let next: InstagramSearchPayload;

            try {
              next = JSON.parse(text) as InstagramSearchPayload;
            } catch {
              return;
            }
            if (
              !isMountedRef.current ||
              instagramLoadGenRef.current !== loadGen
            ) {
              return;
            }
            if (
              !next.profile &&
              !(next.followers?.length || next.following?.length)
            ) {
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
            if (
              isMountedRef.current &&
              instagramLoadGenRef.current === loadGen
            ) {
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
        const hasGuilds =
          (discordData.guilds?.count ?? 0) > 0 ||
          (discordData.guilds?.items?.length ?? 0) > 0;
        const hasConnections =
          (discordData.connections?.length ?? 0) > 0 ||
          (discordData.usernameHistory?.length ?? 0) > 0;
        const hasContacts = Boolean(
          discordData.contacts?.email ||
            discordData.contacts?.phone ||
            discordData.contacts?.ip,
        );

        if (
          !hasProfile &&
          !hasLeaks &&
          !hasRoblox &&
          !hasEnrichment &&
          !hasFivem &&
          !hasDsa &&
          !hasGuilds &&
          !hasConnections &&
          !hasContacts
        ) {
          markNoResults(discordData.error || "No results were found.");

          return;
        }

        commitSuccess(
          {
            discordResult: discordData,
            rawResult: JSON.stringify(discordData, null, 2),
          },
          serialized,
        );

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
              intelxData.error || "No export content returned.",
            ),
          );

          return;
        }

        const exportBody = sanitizePublicContent(
          intelxData.content ?? "",
        ).trim();

        if (!exportBody) {
          markNoResults(
            sanitizePublicText(
              intelxData.error || "No export content returned.",
            ),
          );

          return;
        }

        const storageId = intelxData.storageId ?? trimmed;
        const bucketId = intelxData.bucket ?? "leaks.public";

        commitSuccess(
          {
            intelxResult: {
              storageId,
              bucket: bucketId,
              content: exportBody,
            },
            resultCount: 1,
            rawResult: exportBody || serialized,
            lastSearchLabel: `${moduleDef.name} · ${storageId}`,
          },
          exportBody || serialized,
        );

        return;
      }

      if (activeType === "breach") {
        const breachData = data as {
          results?: unknown[];
          count?: number;
          message?: string;
          error?: string;
          credentials?: StealerCredentialRow[];
          archives?: StealerArchiveEntry[];
        };
        const results = Array.isArray(breachData.results)
          ? breachData.results
          : [];
        const credentials = Array.isArray(breachData.credentials)
          ? breachData.credentials
          : [];
        const archives = Array.isArray(breachData.archives)
          ? breachData.archives
          : [];

        if (moduleDef.slug === "stealer-logs") {
          if (
            results.length === 0 &&
            credentials.length === 0 &&
            archives.length === 0
          ) {
            markNoResults(breachData.message || breachData.error);

            return;
          }

          commitSuccess(
            {
              stealerResult: {
                credentials,
                archives,
                count:
                  typeof breachData.count === "number"
                    ? breachData.count
                    : credentials.length || results.length,
                fallbackRecords:
                  results.length > 0 && credentials.length === 0
                    ? formatSearchRecords(results)
                    : [],
              },
              resultCount:
                typeof breachData.count === "number"
                  ? breachData.count
                  : Math.max(
                      credentials.length,
                      results.length,
                      archives.length,
                    ),
              rawResult: JSON.stringify(data, null, 2),
            },
            serialized,
          );

          return;
        }

        if (results.length === 0) {
          markNoResults(breachData.message || breachData.error);

          return;
        }

        const formatted = formatSearchRecords(results);

        if (formatted.length === 0) {
          markNoResults(
            breachData.message || breachData.error || "No results were found.",
          );

          return;
        }

        commitSuccess({
          records: formatted,
          resultCount:
            typeof breachData.count === "number"
              ? breachData.count
              : results.length,
          rawResult: JSON.stringify(data, null, 2),
        }, serialized);

        return;
      }

      if (activeType === "ip") {
        const formatted = formatStructuredSearchData(data);

        if (formatted.length === 0) {
          const ipData = data as { error?: string };

          markNoResults(
            sanitizePublicText(
              ipData.error || "No IP intelligence was returned.",
            ),
          );

          return;
        }

        commitSuccess({
          records: formatted,
          resultCount: formatted.length,
          rawResult: JSON.stringify(data, null, 2),
        }, serialized);

        return;
      }

      if (activeType === "site-pentest") {
        const pentest = data as SitePentestResult & { error?: string };

        if (!pentest.findings && !pentest.results) {
          commitFail(
            sanitizePublicText(pentest.error || "Site pentest audit failed."),
          );

          return;
        }

        const findingCount =
          pentest.summary?.findingCount ??
          pentest.count ??
          (Array.isArray(pentest.findings) ? pentest.findings.length : 0);

        commitSuccess({


          structuredResult: { kind: "site-pentest", data: pentest },


          resultCount: findingCount,


          emptyResult: findingCount === 0 ? "No results were found." : "",


          rawResult: JSON.stringify(data, null, 2),


        }, serialized);


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
            commitSuccess({
              records: formattedProfile,
              resultCount: formattedProfile.length,
              rawResult: JSON.stringify(data, null, 2),
            }, serialized);

            return;
          }
        }

        if (results.length === 0) {
          markNoResults(typeof data.message === "string" ? data.message : null);

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

        commitSuccess({
          records: formatted,
          resultCount:
            typeof data.count === "number" ? data.count : results.length,
          rawResult: JSON.stringify(data, null, 2),
        }, serialized);

        return;
      }

      if (activeType === "crypto-wallet") {
        commitSuccess({

          structuredResult: {
          kind: "crypto-wallet",
          data: data as CryptoWalletResult,
        },

          rawResult: JSON.stringify(data, null, 2),

        }, serialized);

        return;
      }

      if (activeType === "crypto-full") {
        commitSuccess({
          structuredResult: {
            kind: "crypto-full",
            data: data as CryptoFullSuiteResult,
          },
          rawResult: JSON.stringify(data, null, 2),
        }, serialized);

        return;
      }

      if (activeType === "crypto-address") {
        commitSuccess({

          structuredResult: {
          kind: "crypto-address",
          data: data as CryptoAddressIntelResult,
        },

          rawResult: JSON.stringify(data, null, 2),

        }, serialized);

        return;
      }

      if (activeType === "crypto-tx") {
        commitSuccess({

          structuredResult: {
          kind: "crypto-tx",
          data: data as CryptoTxDeepDiveResult,
        },

          rawResult: JSON.stringify(data, null, 2),

        }, serialized);

        return;
      }

      if (activeType === "crypto-risk") {
        commitSuccess({

          structuredResult: {
          kind: "crypto-risk",
          data: data as CryptoRiskCheckResult,
        },

          rawResult: JSON.stringify(data, null, 2),

        }, serialized);

        return;
      }

      if (activeType === "crypto-flow") {
        commitSuccess({

          structuredResult: {
          kind: "crypto-flow",
          data: data as CryptoFundFlowResult,
        },

          rawResult: JSON.stringify(data, null, 2),

        }, serialized);

        return;
      }

      if (activeType === "tinder-live") {
        const liveData = data as TinderLiveSearchResult & {
          error?: string;
          message?: string;
        };

        if (!liveData.profiles?.length) {
          markNoResults(
            liveData.message ||
              liveData.error ||
              "No Tinder recommendations returned for those filters.",
          );

          return;
        }

        commitSuccess({


          structuredResult: { kind: "tinder-live", data: liveData },


          rawResult: JSON.stringify(data, null, 2),


        }, serialized);


        return;
      }

      if (activeType === "hinge-live") {
        const liveData = data as HingeLiveSearchResult & {
          error?: string;
          message?: string;
        };

        if (!liveData.profiles?.length) {
          markNoResults(
            liveData.message ||
              liveData.error ||
              "No Hinge recommendations returned for those filters.",
          );

          return;
        }

        commitSuccess({
          structuredResult: { kind: "hinge-live", data: liveData },
          rawResult: JSON.stringify(data, null, 2),
        }, serialized);

        return;
      }

      if (activeType === "username-accounts" || activeType === "handle-sweep") {
        const accountsData = data as AccountPresenceSearchResult & {
          error?: string;
          message?: string;
        };

        if (!accountsData.sources?.length && !accountsData.count) {
          markNoResults(
            accountsData.message ||
              accountsData.error ||
              "No public profiles returned for that username.",
          );

          return;
        }

        if (!accountsData.count) {
          markNoResults("No public profiles returned for that username.");

          return;
        }

        commitSuccess({
          structuredResult: {
            kind: "username-accounts",
            data: accountsData,
          },
          rawResult: JSON.stringify(data, null, 2),
        }, serialized);

        return;
      }

      if (activeType === "email-presence") {
        const presence = data as EmailPresenceSearchResult & {
          error?: string;
          message?: string;
        };

        if (!presence.found?.length) {
          markNoResults(
            presence.message ||
              presence.error ||
              "No registered accounts detected for that email or phone.",
          );

          return;
        }

        commitSuccess({
          structuredResult: { kind: "email-presence", data: presence },
          rawResult: JSON.stringify(data, null, 2),
        }, serialized);

        return;
      }

      if (activeType === "index-sweep") {
        const sweep = data as IndexSweepSearchResult & {
          error?: string;
          message?: string;
        };

        if (!sweep.dorks?.length) {
          markNoResults(
            sweep.message ||
              sweep.error ||
              "Could not build Index Sweep operators for that query.",
          );

          return;
        }

        commitSuccess({
          structuredResult: { kind: "index-sweep", data: sweep },
          rawResult: JSON.stringify(data, null, 2),
        }, serialized);

        return;
      }

      if (activeType === "bin") {
        commitSuccess({

          structuredResult: { kind: "bin", data: data as BinLookupResult },

          rawResult: JSON.stringify(data, null, 2),

        }, serialized);

        return;
      }

      if (activeType === "iban") {
        const ibanData = data as IbanLookupResult;

        commitSuccess({


          structuredResult: { kind: "iban", data: ibanData },


          rawResult: JSON.stringify(data, null, 2),


        }, serialized);


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

        commitSuccess({


          structuredResult: { kind: "bank", data: bankData },


          rawResult: JSON.stringify(data, null, 2),


        }, serialized);


        return;
      }

      if (activeType === "vin") {
        commitSuccess({

          structuredResult: { kind: "vin", data: data as VinDecodeResult },

          rawResult: JSON.stringify(data, null, 2),

        }, serialized);

        return;
      }

      if (activeType === "car-insurance" || activeType === "healthcare") {
        const providerData = data as UsProviderSearchResult & {
          message?: string;
        };

        if (!providerData.providers?.length) {
          markNoResults(
            providerData.message ||
              (activeType === "car-insurance"
                ? "No US car insurers matched that search."
                : "No US health care providers matched that search."),
          );

          return;
        }

        commitSuccess({


          structuredResult: {
          kind: activeType,
          data: providerData,
        },


          rawResult: JSON.stringify(data, null, 2),


        }, serialized);


        return;
      }

      if (activeType === "us-court") {
        const courtData = data as UsCourtSearchResult & { error?: string };
        const portalCount = courtData.portals?.length ?? 0;
        const hitCount = (courtData.cases?.length ?? 0) + portalCount;

        if (!hitCount) {
          if (courtData.errors?.length) {
            commitSuccess({
              structuredResult: { kind: "us-court", data: courtData },
              rawResult: JSON.stringify(data, null, 2),
            });
          } else {
            markNoResults(
              courtData.message ||
                courtData.error ||
                "No court matters matched that search.",
            );
          }

          return;
        }

        commitSuccess({


          structuredResult: { kind: "us-court", data: courtData },


          rawResult: JSON.stringify(data, null, 2),


        }, serialized);


        return;
      }

      if (activeType === "public-records") {
        const identityData = data as UsIdentitySearchResult & {
          error?: string;
          breaches?: CombSearchResult | null;
        };
        const breachData =
          identityData.breaches && identityData.breaches.returned > 0
            ? identityData.breaches
            : null;
        const hitCount =
          (identityData.count ?? 0) > 0 ||
          Boolean(breachData) ||
          (identityData.portals?.length ?? 0) > 0;

        if (!hitCount) {
          if (identityData.errors?.length) {
            commitSuccess({
              structuredResult: {
                kind: "public-records",
                data: identityData,
              },
              combResult: null,
              rawResult: JSON.stringify(data, null, 2),
            });
          } else {
            markNoResults(
              identityData.message ||
                identityData.error ||
                "No public records matches found.",
            );
          }

          return;
        }

        commitSuccess({
          structuredResult: { kind: "public-records", data: identityData },
          combResult: breachData,
          rawResult: JSON.stringify(data, null, 2),
        }, serialized);

        return;
      }

      if (PUBLIC_RECORDS_COMPOSE_KINDS.has(activeType)) {
        const identityData = data as UsIdentitySearchResult & {
          error?: string;
        };
        const kind = activeType as
          | "us-identity"
          | "us-npd"
          | "us-global"
          | "us-sanctions"
          | "us-wanted"
          | "us-state-directory"
          | "us-portal-backlog"
          | "us-intl-directory"
          | "public-records";

        if (!identityData.count) {
          if (identityData.errors?.length || identityData.portals?.length) {
            commitSuccess({
              structuredResult: { kind, data: identityData },
              rawResult: JSON.stringify(data, null, 2),
            });
          } else {
            markNoResults(
              identityData.message ||
                identityData.error ||
                "No public registry matches found.",
            );
          }

          return;
        }

        commitSuccess({


          structuredResult: { kind, data: identityData },


          rawResult: JSON.stringify(data, null, 2),


        }, serialized);


        return;
      }

      if (activeType === "us-va-sor" || activeType === "us-sor-national") {
        const sorData = data as UsVaSorSearchResult & { error?: string };

        if (!sorData.count) {
          if (sorData.errors?.length) {
            commitSuccess({
              structuredResult: {
                kind:
                  activeType === "us-sor-national"
                    ? "us-sor-national"
                    : "us-va-sor",
                data: sorData,
              },
              rawResult: JSON.stringify(data, null, 2),
            });
          } else {
            markNoResults(
              sorData.message ||
                sorData.error ||
                "No sex offender registry matches found.",
            );
          }

          return;
        }

        commitSuccess({


          structuredResult: {
          kind:
            activeType === "us-sor-national" ? "us-sor-national" : "us-va-sor",
          data: sorData,
        },


          rawResult: JSON.stringify(data, null, 2),


        }, serialized);


        return;
      }

      const formatted = formatStructuredSearchData(data);

      if (formatted.length === 0) {
        markNoResults();

        return;
      }

      commitSuccess(
        {
          records: formatted,
          resultCount:
            typeof (data as { count?: number }).count === "number"
              ? (data as { count: number }).count
              : formatted.length,
          rawResult: JSON.stringify(data, null, 2),
        },
        serialized,
      );
    } catch (err) {
      if (signal.aborted) return;

      const message =
        err instanceof Error && err.message
          ? sanitizePublicText(err.message)
          : "Could not complete the search.";

      commitFail(message);
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
    <div
      ref={rootRef}
      className={clsx(
        "module-search px-6 pb-8 md:px-8 md:pb-10",
        hasResultsSurface
          ? "module-search--has-results pt-10 md:pt-12"
          : "module-search--idle pt-6 md:pt-8",
        shouldScrollToResults && "module-search--results-immersive",
      )}
    >
      <div className="module-search-nav mb-6 flex items-center justify-end gap-4 md:mb-8">
        <Link
          className="module-search-back inline-flex items-center gap-2"
          href="/"
        >
          <Home className="size-4" />
          Home
        </Link>
      </div>

      <div className="module-search-stage">
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
          {maintenanceBanner ? (
            <p className="mt-3 border-l-2 border-rose-400/60 bg-rose-400/8 px-4 py-3 text-sm text-rose-100">
              {maintenanceBanner}
            </p>
          ) : null}
          {moduleLocked && (
            <p className="mt-3 border-l-2 border-amber-400/60 bg-amber-400/8 px-4 py-3 text-sm text-amber-100">
              {moduleLocked}{" "}
              <Link className="text-anya-accent underline" href="/pricing">
                View plans
              </Link>
              {residentialProxyCostHint ? (
                <>
                  {" "}
                  <Link
                    className="text-anya-accent underline"
                    href="/pricing?tab=credits"
                  >
                    Buy credits
                  </Link>
                </>
              ) : null}
            </p>
          )}
          {!moduleLocked && !searchBlockedByMaintenance && residentialProxyCostHint ? (
            <p className="mt-3 border-l-2 border-sky-400/50 bg-sky-400/8 px-4 py-3 text-sm text-sky-100">
              {residentialProxyCostHint}{" "}
              <Link
                className="text-anya-accent underline"
                href="/pricing?tab=credits"
              >
                Top up credits
              </Link>
            </p>
          ) : null}
        </header>

        <div className="module-search-composer">
          <section className="ui-panel module-search-panel module-search-panel--composer">
            <div className="ui-panel-body">
              {moduleDef.tools &&
              moduleDef.tools.length > 0 &&
              !hideToolChips ? (
                <div
                  aria-label="Module tools"
                  className="module-search-tools"
                  role="toolbar"
                >
                  {moduleDef.tools.map((tool) => {
                    // Specialty identity-intel chips are Ultimate / Enterprise only.
                    if (
                      tool.apiType &&
                      isOathnetApiType(tool.apiType) &&
                      !planHasUltimateModules(plan)
                    ) {
                      return null;
                    }

                    const active = tool.id === selectedToolId;

                    return (
                      <button
                        key={tool.id}
                        aria-pressed={active}
                        className={
                          active
                            ? "module-search-tool module-search-tool--active"
                            : "module-search-tool"
                        }
                        type="button"
                        onClick={() => {
                          toolLockedRef.current = true;
                          setSelectedToolId(tool.id);
                        }}
                      >
                        {tool.label}
                      </button>
                    );
                  })}
                </div>
              ) : null}
              {showsContactProfilesDeepToggle ? (
                <label className="module-search-proxy-toggle mb-3 flex cursor-pointer items-start gap-3 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-zinc-300">
                  <input
                    checked={contactProfilesDeep}
                    className="mt-0.5 size-4 shrink-0 accent-[var(--anya-accent,#7dd3fc)]"
                    type="checkbox"
                    onChange={(event) =>
                      setContactProfilesDeep(event.target.checked)
                    }
                  />
                  <span>
                    <span className="font-medium text-zinc-100">
                      Deep search (+{RESIDENTIAL_PROXY_CREDIT_COST} credit)
                    </span>
                    <span className="mt-0.5 block text-xs text-zinc-500">
                      Adds Instagram, Snapchat, TikTok, Facebook, Discord,
                      LinkedIn signup, and adult platforms. Off by default —
                      standard presence stays on plan quota.
                    </span>
                  </span>
                </label>
              ) : null}
              {isCryptoIntel && cryptoDetection?.chainLabel ? (
                <p className="mb-3 text-xs text-zinc-400">
                  Detected:{" "}
                  <span className="font-medium text-zinc-200">
                    {cryptoDetection.chainLabel}
                  </span>
                  {cryptoDetection.kind === "tx" ? " · transaction" : " · wallet"}
                  {!toolLockedRef.current ? (
                    <span className="text-zinc-500">
                      {" "}
                      · routing to{" "}
                      {cryptoDetection.suggestedToolId === "full"
                        ? "Full intel"
                        : cryptoDetection.suggestedToolId}
                    </span>
                  ) : null}
                </p>
              ) : null}
              <form
                autoComplete="off"
                className="relative"
                onSubmit={handleSearch}
              >
                {isSummary ? (
                  <div className="module-search-summary-form space-y-4">
                    <AutofillDecoyFields />
                    <textarea
                      {...TEXTAREA_AUTOFILL_SHIELD}
                      readOnly
                      className="ui-input w-full resize-y font-mono"
                      data-tour="search-input"
                      name="osint-summary-query"
                      placeholder="Paste intel, JSON, logs, or case notes…"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      onFocus={unlockAutofillShield}
                    />
                    <div className="module-search-form-actions">
                      <span
                        aria-hidden
                        className="module-search-form-actions-spacer"
                      />
                      <LiquidButton
                        className="home-search-submit liquid-glass-button--accent module-search-submit shrink-0"
                        data-tour="search-submit"
                        disabled={
                          !query.trim() ||
                          isSearching ||
                          Boolean(moduleLocked) ||
                          searchBlockedByMaintenance
                        }
                        type="submit"
                      >
                        {isSearching ? (
                          "Scanning…"
                        ) : (
                          <>
                            <span>Analyse</span>
                            <ArrowRight className="size-4" />
                          </>
                        )}
                      </LiquidButton>
                    </div>
                  </div>
                ) : (
                  <ModuleSearchFields
                    canSubmit={
                      composedFields.hasInput &&
                      !isSearching &&
                      !moduleLocked &&
                      !searchBlockedByMaintenance
                    }
                    disabled={
                      Boolean(moduleLocked) || searchBlockedByMaintenance
                    }
                    extraActions={
                      isPublicRecords ? (
                        <button
                          className="ui-btn shrink-0 sm:min-w-[6.5rem]"
                          disabled={
                            Boolean(moduleLocked) || searchBlockedByMaintenance
                          }
                          type="button"
                          onClick={() =>
                            setShowPublicRecordsOptions((open) => !open)
                          }
                        >
                          Options
                          <span className="ml-1 text-[10px] text-zinc-500">
                            ({publicRecordsSources.length})
                          </span>
                        </button>
                      ) : null
                    }
                    fields={searchFields}
                    isSearching={isSearching}
                    moduleDef={moduleDef}
                    submitLabel={
                      isAi
                        ? "Analyse"
                        : moduleDef.slug === "intelx"
                          ? "Open"
                          : isPublicRecords
                            ? "Search"
                            : "Run"
                    }
                    onChange={setSearchFields}
                  />
                )}
              </form>

              <SearchProgressBar
                active={isSearching}
                hasResults={hasResultsSurface}
                progress={searchProgressRatio}
                status={searchProgressStatus}
              />

              {isPublicRecords ? (
                <PublicRecordsOptionsPanel
                  open={showPublicRecordsOptions}
                  selected={publicRecordsSources}
                  onChange={setPublicRecordsSources}
                  onClose={() => setShowPublicRecordsOptions(false)}
                />
              ) : null}

              {error && (
                <p className="mt-4 rounded-lg border border-red-400/20 bg-red-400/8 px-3 py-2 text-sm text-red-200">
                  {error}
                </p>
              )}
            </div>
          </section>
        </div>
      </div>

      {!isSearching && emptyResult && moduleDef.slug !== "site-pentest" ? (
        <div
          className="module-search-results mt-5 w-full max-w-none border-t border-white/8 pt-5"
          data-tour="search-results"
        >
          {lastSearchLabel ? (
            <p className="mb-4 text-sm text-zinc-400">{lastSearchLabel}</p>
          ) : null}
          <SearchEmptyState detail={emptyResult} />
        </div>
      ) : null}

      {moduleDef.slug === "site-pentest" ? (
        <div
          className="module-search-results mt-5 w-full max-w-none border-t border-white/8 pt-5"
          data-tour="search-results"
        >
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
                  options={caseOptions}
                  value={saveCaseId}
                  onChange={setSaveCaseId}
                />
                <SpecularButton
                  accent
                  className="ui-btn ui-btn-primary"
                  disabled={!saveCaseId || savingToCase || !rawResult}
                  size="sm"
                  type="button"
                  onClick={handleSaveToCase}
                >
                  <FolderPlus className="size-3.5" />
                  {savingToCase ? "Saving…" : "File intel"}
                </SpecularButton>
              </div>
            </div>
          )}
          {saveMessage ? (
            <p className="mb-3 text-sm text-zinc-300">{saveMessage}</p>
          ) : null}
          <SitePentestResults
            blurResults={blurResults}
            result={
              structuredResult?.kind === "site-pentest"
                ? structuredResult.data
                : null
            }
            scanning={isSearching}
            selectedModules={pentestModules}
            onModulesChange={setPentestModules}
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
        stealerResult ||
        robloxResult ||
        instagramResult ||
        (structuredResult && structuredResult.kind !== "site-pentest")) && (
        <div
          className="module-search-results mt-5 w-full max-w-none border-t border-white/8 pt-5"
          data-tour="search-results"
        >
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
                options={caseOptions}
                value={saveCaseId}
                onChange={setSaveCaseId}
              />
              <SpecularButton
                accent
                className="ui-btn ui-btn-primary"
                disabled={!saveCaseId || savingToCase}
                size="sm"
                type="button"
                onClick={handleSaveToCase}
              >
                <FolderPlus className="size-3.5" />
                {savingToCase ? "Saving…" : "File intel"}
              </SpecularButton>
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
              <CryptoAiChatResults
                blurResults={blurResults}
                result={aiResult}
              />
            ) : (
              <AiSearchResults blurResults={blurResults} result={aiResult} />
            )
          ) : intelxResult ? (
            <IntelxSearchResults
              blurResults={blurResults}
              result={intelxResult}
            />
          ) : fivemResult ? (
            <div className="space-y-8">
              <FivemSearchResults
                blurResults={blurResults}
                result={fivemResult}
                selectedExportIndex={selectedExportIndex}
                onSelectExportIndex={handleSelectExportIndex}
              />
              {records.length > 0 ? (
                <SearchResultCards
                  blurResults={blurResults}
                  records={records}
                  selectedExportIndex={selectedExportIndex}
                  totalCount={resultCount}
                  onSelectExportIndex={handleSelectExportIndex}
                />
              ) : null}
            </div>
          ) : stealerResult ? (
            <StealerLogsSearchResults
              archives={stealerResult.archives}
              blurResults={blurResults}
              breachedData={stealerResult.breachedData ?? null}
              credentials={stealerResult.credentials}
              fallbackRecords={stealerResult.fallbackRecords}
              totalCredentialCount={stealerResult.count}
            />
          ) : robloxResult ? (
            <div className="space-y-8">
              <RobloxSearchResults
                blurResults={blurResults}
                result={robloxResult}
                selectedExportIndex={selectedExportIndex}
                onSelectExportIndex={handleSelectExportIndex}
              />
              {records.length > 0 ? (
                <SearchResultCards
                  blurResults={blurResults}
                  records={records}
                  selectedExportIndex={selectedExportIndex}
                  totalCount={resultCount}
                  onSelectExportIndex={handleSelectExportIndex}
                />
              ) : null}
            </div>
          ) : instagramResult ? (
            <InstagramSearchResults
              blurResults={blurResults}
              enriching={instagramEnriching}
              loadingMore={instagramLoadingMore}
              progressLabel={instagramProgressLabel}
              result={instagramResult}
              selectedExportIndex={selectedExportIndex}
              onEnrichBios={handleInstagramEnrichBios}
              onSelectExportIndex={handleSelectExportIndex}
            />
          ) : discordResult ? (
            <DiscordSearchResults
              blurResults={blurResults}
              loadingMore={discordLoadingMore}
              progressLabel={discordProgressLabel}
              result={discordResult}
            />
          ) : domainResult ? (
            <div className="space-y-8">
              <DomainSearchResults
                blurResults={blurResults}
                result={domainResult}
                selectedExportIndex={selectedExportIndex}
                onSelectExportIndex={handleSelectExportIndex}
              />
              {records.length > 0 ? (
                <SearchResultCards
                  blurResults={blurResults}
                  records={records}
                  selectedExportIndex={selectedExportIndex}
                  totalCount={resultCount}
                  onSelectExportIndex={handleSelectExportIndex}
                />
              ) : null}
            </div>
          ) : structuredResult?.kind === "public-records" ? (
            <div className="space-y-8">
              {(structuredResult.data.count > 0 ||
                (structuredResult.data.portals?.length ?? 0) > 0 ||
                structuredResult.data.people.length > 0 ||
                structuredResult.data.cases.length > 0) && (
                <UsIdentitySearchResults
                  blurResults={blurResults}
                  result={structuredResult.data}
                  title="Public records"
                />
              )}
              {combResult ? (
                <div>
                  <p className="mb-3 text-sm font-medium text-zinc-300">
                    Breach & leak indexes
                  </p>
                  <BreachesSearchResults
                    blurResults={blurResults}
                    result={combResult}
                    selectedExportIndex={selectedExportIndex}
                    onSelectExportIndex={handleSelectExportIndex}
                  />
                </div>
              ) : null}
            </div>
          ) : combResult ? (
            <div className="space-y-8">
              <BreachesSearchResults
                blurResults={blurResults}
                result={combResult}
                selectedExportIndex={selectedExportIndex}
                onSelectExportIndex={handleSelectExportIndex}
              />
              {records.length > 0 ? (
                <SearchResultCards
                  blurResults={blurResults}
                  pageSize={Math.max(records.length, 1)}
                  records={records}
                  selectedExportIndex={selectedExportIndex}
                  totalCount={resultCount}
                  onSelectExportIndex={handleSelectExportIndex}
                />
              ) : null}
            </div>
          ) : structuredResult?.kind === "crypto-wallet" ? (
            <CryptoWalletResults
              blurResults={blurResults}
              result={structuredResult.data}
            />
          ) : structuredResult?.kind === "crypto-full" ? (
            <CryptoFullSuiteResults
              blurResults={blurResults}
              result={structuredResult.data}
            />
          ) : structuredResult?.kind === "crypto-address" ? (
            <CryptoAddressIntelResults
              blurResults={blurResults}
              result={structuredResult.data}
            />
          ) : structuredResult?.kind === "crypto-tx" ? (
            <CryptoTxDeepDiveResults
              blurResults={blurResults}
              result={structuredResult.data}
            />
          ) : structuredResult?.kind === "crypto-risk" ? (
            <CryptoRiskCheckResults
              blurResults={blurResults}
              result={structuredResult.data}
            />
          ) : structuredResult?.kind === "crypto-flow" ? (
            <CryptoFundFlowResults
              blurResults={blurResults}
              result={structuredResult.data}
            />
          ) : structuredResult?.kind === "tinder-live" ? (
            <TinderLiveResults data={structuredResult.data} />
          ) : structuredResult?.kind === "hinge-live" ? (
            <HingeLiveResults data={structuredResult.data} />
          ) : structuredResult?.kind === "username-accounts" ? (
            <div className="space-y-8">
              <AccountPresenceResults
                blurResults={blurResults}
                data={structuredResult.data}
              />
              {records.length > 0 ? (
                <SearchResultCards
                  blurResults={blurResults}
                  records={records}
                  selectedExportIndex={selectedExportIndex}
                  totalCount={resultCount}
                  onSelectExportIndex={handleSelectExportIndex}
                />
              ) : null}
            </div>
          ) : structuredResult?.kind === "email-presence" ? (
            <div className="space-y-8">
              <EmailPresenceResults
                blurResults={blurResults}
                data={structuredResult.data}
              />
              {records.length > 0 ? (
                <SearchResultCards
                  blurResults={blurResults}
                  records={records}
                  selectedExportIndex={selectedExportIndex}
                  totalCount={resultCount}
                  onSelectExportIndex={handleSelectExportIndex}
                />
              ) : null}
            </div>
          ) : structuredResult?.kind === "index-sweep" ? (
            <div className="space-y-8">
              <IndexSweepResults
                blurResults={blurResults}
                data={structuredResult.data}
              />
              {records.length > 0 ? (
                <SearchResultCards
                  blurResults={blurResults}
                  records={records}
                  selectedExportIndex={selectedExportIndex}
                  totalCount={resultCount}
                  onSelectExportIndex={handleSelectExportIndex}
                />
              ) : null}
            </div>
          ) : structuredResult?.kind === "bin" ? (
            <div className="space-y-8">
              <BinSearchResults
                blurResults={blurResults}
                result={structuredResult.data}
              />
              {records.length > 0 ? (
                <SearchResultCards
                  blurResults={blurResults}
                  records={records}
                  selectedExportIndex={selectedExportIndex}
                  totalCount={resultCount}
                  onSelectExportIndex={handleSelectExportIndex}
                />
              ) : null}
            </div>
          ) : structuredResult?.kind === "iban" ? (
            <IbanSearchResults
              blurResults={blurResults}
              result={structuredResult.data}
            />
          ) : structuredResult?.kind === "bank" ? (
            <BankSearchResults
              blurResults={blurResults}
              result={structuredResult.data}
            />
          ) : structuredResult?.kind === "vin" ? (
            <>
              <VinSearchResults
                blurResults={blurResults}
                result={structuredResult.data}
              />
              {records.length > 0 ? (
                <div className="mt-5">
                  <SearchResultCards
                    blurResults={blurResults}
                    records={records}
                    selectedExportIndex={selectedExportIndex}
                    totalCount={resultCount}
                    onSelectExportIndex={handleSelectExportIndex}
                  />
                </div>
              ) : null}
            </>
          ) : structuredResult?.kind === "car-insurance" ||
            structuredResult?.kind === "healthcare" ? (
            <UsProviderSearchResults
              blurResults={blurResults}
              result={structuredResult.data}
            />
          ) : structuredResult?.kind === "us-court" ? (
            <UsCourtSearchResults
              blurResults={blurResults}
              result={structuredResult.data}
            />
          ) : structuredResult?.kind === "us-va-sor" ||
            structuredResult?.kind === "us-sor-national" ? (
            <UsVaSorSearchResults
              blurResults={blurResults}
              result={structuredResult.data}
            />
          ) : structuredResult &&
            structuredResult.kind !== "site-pentest" &&
            PUBLIC_RECORDS_COMPOSE_KINDS.has(structuredResult.kind) ? (
            <UsIdentitySearchResults
              blurResults={blurResults}
              result={structuredResult.data as UsIdentitySearchResult}
              title={
                PUBLIC_RECORDS_COMPOSE_TITLES[structuredResult.kind] ||
                "Public records hits"
              }
            />
          ) : records.length > 0 ? (
            <SearchResultCards
              blurResults={blurResults}
              records={records}
              selectedExportIndex={selectedExportIndex}
              totalCount={resultCount}
              onSelectExportIndex={handleSelectExportIndex}
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
