"use client";

import type { UserProfile } from "@/lib/account-plan";
import type { DiscordSearchResult } from "@/lib/discord-profile";
import Link from "next/link";
import clsx from "clsx";
import {
  ArrowRight,
  AtSign,
  ChevronDown,
  Database,
  Hash,
  LockKeyhole,
  Phone,
  Search,
  Sparkles,
  User,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ElementType } from "react";

import { BreachesSearchResults } from "@/components/dashboard/breaches-search-results";
import { DiscordSearchResults } from "@/components/dashboard/discord-search-results";
import { SearchResultCards } from "@/components/dashboard/search-result-cards";
import { HingeLiveResults } from "@/components/dashboard/hinge-live-results";
import {
  InstagramSearchResults,
  type InstagramSearchPayload,
} from "@/components/dashboard/instagram-search-results";
import { StealerLogsSearchResults } from "@/components/dashboard/stealer-logs-search-results";
import { LiquidButton } from "@/components/ui/liquid-glass-button";
import { LiquidGlassCard } from "@/components/ui/liquid-glass";
import { SearchProgressBar } from "@/components/search-progress-bar";
import { getHubSections } from "@/lib/search-modules";
import {
  STARTER_SEARCH_MODES,
  resolveStarterSearchRoute,
  type StarterSearchMode,
} from "@/lib/starter-search";
import { useTypingPlaceholder } from "@/lib/use-typing-placeholder";
import { consumeOsintNdjsonStream } from "@/lib/osint-ndjson-client";
import {
  normalizeEmail,
  type CombSearchResult,
} from "@/lib/proxynova-comb";
import { sanitizePublicText } from "@/lib/public-branding";
import {
  AutofillDecoyFields,
  SEARCH_AUTOFILL_SHIELD,
  unlockAutofillShield,
} from "@/lib/search-autofill-shield";
import {
  checkDailySearchQuota,
  checkModuleAccess,
  hasWorkspaceDashboardAccess,
  HOME_PREMIUM_MODULE_OPTIONS,
  PAY_PER_USE_COST,
  RESIDENTIAL_PROXY_CREDIT_COST,
  resolveUserPlan,
  shouldBlurResults,
  STARTER_MODULE_SLUGS,
} from "@/lib/plans";
import {
  clearSearchResume,
  readSearchResume,
  saveSearchResume,
} from "@/lib/search-resume";
import { apiFetch } from "@/lib/csrf-client";
import {
  formatSearchRecords,
  formatStructuredSearchData,
  type FormattedRecord,
} from "@/lib/search-utils";
import { extractStealerCredentialRows } from "@/lib/stealer-logs-view";
import type { HingeLiveSearchResult } from "@/lib/hinge-live/types";
import type { StealerArchiveEntry } from "@/lib/breachhub";
import type { StealerCredentialRow } from "@/lib/stealer-logs-view";

type AuthState =
  | { status: "loading" }
  | { status: "guest" }
  | {
      status: "authenticated";
      user: UserProfile;
      canManageWorkspace: boolean;
      searchesLast24h: number;
      intelxUsedToday: number;
    };

const MODE_ICONS: Record<StarterSearchMode, ElementType> = {
  email: AtSign,
  phone: Phone,
  username: User,
  discord: Hash,
  breaches: Database,
};

const LOCKED_MODULES = getHubSections().flatMap((section) =>
  section.items.filter(
    (module) =>
      !module.comingSoon && !STARTER_MODULE_SLUGS.has(module.slug),
  ),
);

type HomeSearchProps = {
  lockedModules?: ReadonlyArray<{ name: string; slug: string }>;
};

export function HomeSearch({ lockedModules }: HomeSearchProps = {}) {
  const [auth, setAuth] = useState<AuthState>({ status: "loading" });
  const [isMounted, setIsMounted] = useState(false);
  const [query, setQuery] = useState("");
  const [starterMode, setStarterMode] = useState<StarterSearchMode>("email");
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState("");
  const [records, setRecords] = useState<FormattedRecord[]>([]);
  const [resultCount, setResultCount] = useState(0);
  const [discordResult, setDiscordResult] =
    useState<DiscordSearchResult | null>(null);
  const [combResult, setCombResult] = useState<CombSearchResult | null>(null);
  const [blurResults, setBlurResults] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [premiumModule, setPremiumModule] = useState<string | null>(null);
  const [premiumMenuOpen, setPremiumMenuOpen] = useState(false);
  const [vaultId, setVaultId] = useState<string | null>(null);
  const [claimToken, setClaimToken] = useState<string | null>(null);
  const [unlockMeta, setUnlockMeta] = useState<{
    reasons?: string[];
    creditCost?: number;
    planRequired?: string | null;
    allowCreditUnlock?: boolean;
    resultCount?: number;
  } | null>(null);
  const [instagramResult, setInstagramResult] =
    useState<InstagramSearchPayload | null>(null);
  const [hingeResult, setHingeResult] = useState<HingeLiveSearchResult | null>(
    null,
  );
  const [stealerResult, setStealerResult] = useState<{
    credentials: StealerCredentialRow[];
    archives: StealerArchiveEntry[];
    count: number;
  } | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const scrolledForResultsRef = useRef(false);
  const premiumControlRef = useRef<HTMLDivElement>(null);
  const searchAbortRef = useRef<AbortController | null>(null);
  const [streamStatus, setStreamStatus] = useState<string | null>(null);
  const [streamProgress, setStreamProgress] = useState<number | null>(null);

  const activePremiumOption = useMemo(
    () =>
      HOME_PREMIUM_MODULE_OPTIONS.find((opt) => opt.id === premiumModule) ??
      null,
    [premiumModule],
  );

  const visibleLockedModules =
    lockedModules ?? (isMounted ? LOCKED_MODULES : []);
  const visibleLockedModuleCount = visibleLockedModules.length;
  const hasStableLockedModules = lockedModules != null || isMounted;
  const hasPanelAccess =
    auth.status === "authenticated" &&
    hasWorkspaceDashboardAccess({
      ...auth.user,
      canManageWorkspace: auth.canManageWorkspace,
    });
  // Upsell chip only for guests / plans without panel — not for Professional+
  const showPremiumLocked = !hasPanelAccess && auth.status !== "loading";
  const hasResultsSurface =
    Boolean(discordResult) ||
    Boolean(combResult) ||
    Boolean(instagramResult) ||
    Boolean(hingeResult) ||
    Boolean(stealerResult) ||
    records.length > 0;

  const balance =
    auth.status === "authenticated" ? (auth.user.balance ?? 0) : 0;

  const premiumCostLabel = useMemo(() => {
    if (!premiumModule) return null;
    if (premiumModule === "stealer-logs") return `${PAY_PER_USE_COST} credits`;
    return `${RESIDENTIAL_PROXY_CREDIT_COST} credit`;
  }, [premiumModule]);

  const clearResults = () => {
    setRecords([]);
    setDiscordResult(null);
    setCombResult(null);
    setInstagramResult(null);
    setHingeResult(null);
    setStealerResult(null);
    setResultCount(0);
    setVaultId(null);
    setClaimToken(null);
    setUnlockMeta(null);
    setStreamStatus(null);
    setStreamProgress(null);
  };

  const captureVaultFromData = (
    data: Record<string, unknown>,
    opts: { mode: string; query: string; moduleSlug: string },
  ) => {
    if (typeof data.vaultId === "string" && typeof data.claimToken === "string") {
      setVaultId(data.vaultId);
      setClaimToken(data.claimToken);
      setUnlockMeta(
        data.unlock && typeof data.unlock === "object"
          ? (data.unlock as {
              reasons?: string[];
              creditCost?: number;
              planRequired?: string | null;
              allowCreditUnlock?: boolean;
              resultCount?: number;
            })
          : null,
      );
      saveSearchResume({
        vaultId: data.vaultId,
        claimToken: data.claimToken,
        mode: opts.mode,
        query: opts.query,
        premiumModule,
        blurReason: auth.status === "guest" ? "guest" : "free",
        moduleSlug: opts.moduleSlug,
      });
    }
  };

  const applyUnlockedPayload = (payload: unknown) => {
    clearSearchResume();
    setBlurResults(false);
    setVaultId(null);
    setClaimToken(null);
    setUnlockMeta(null);

    if (!payload || typeof payload !== "object") return;

    const data = payload as Record<string, unknown>;

    if (data.profile && typeof data.profile === "object") {
      setDiscordResult(data as unknown as DiscordSearchResult);
      setCombResult(null);
      setRecords([]);
      setInstagramResult(null);
      setHingeResult(null);
      setStealerResult(null);

      return;
    }

    if (Array.isArray(data.credentials)) {
      const credentials = data.credentials as CombSearchResult["credentials"];
      setCombResult({
        ...(data as unknown as CombSearchResult),
        credentials,
        returned: credentials.length,
        totalMatches: credentials.length,
      });
      setResultCount(credentials.length);
      setDiscordResult(null);
      setRecords([]);

      return;
    }

    if (Array.isArray(data.results)) {
      const formatted = formatSearchRecords(data.results as unknown[]);
      setRecords(formatted);
      setResultCount(
        typeof data.count === "number" ? data.count : formatted.length,
      );
      setDiscordResult(null);
      setCombResult(null);
    }
  };

  const activeStarterMode =
    STARTER_SEARCH_MODES.find((mode) => mode.id === starterMode) ??
    STARTER_SEARCH_MODES[0];

  const typingPlaceholder = useTypingPlaceholder(
    activeStarterMode.placeholder,
    {
      enabled: !query.trim() && !inputFocused,
    },
  );

  useEffect(() => {
    setIsMounted(true);

    return () => {
      searchAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!premiumMenuOpen) return;

    const onPointerDown = (event: MouseEvent) => {
      if (
        premiumControlRef.current &&
        !premiumControlRef.current.contains(event.target as Node)
      ) {
        setPremiumMenuOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPremiumMenuOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [premiumMenuOpen]);

  // Resume vault after auth / checkout return.
  useEffect(() => {
    if (auth.status === "loading") return;

    const resume = readSearchResume();

    if (!resume) return;

    if (resume.query) setQuery(resume.query);
    if (resume.mode) {
      const mode = STARTER_SEARCH_MODES.find((m) => m.id === resume.mode);
      if (mode) setStarterMode(mode.id);
    }
    if (resume.premiumModule) setPremiumModule(resume.premiumModule);

    setVaultId(resume.vaultId);
    setClaimToken(resume.claimToken);

    if (auth.status !== "authenticated") return;

    let cancelled = false;

    void (async () => {
      try {
        const res = await apiFetch("/api/search/vault/claim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            vaultId: resume.vaultId,
            claimToken: resume.claimToken,
            preferCreditUnlock: false,
          }),
        });
        const data = await res.json().catch(() => ({}));

        if (cancelled) return;

        if (res.ok && data.payload) {
          applyUnlockedPayload(data.payload);

          return;
        }

        // Keep teaser chrome; user can unlock manually (credits/plan).
        setBlurResults(true);
      } catch {
        if (!cancelled) setBlurResults(true);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resume once auth settles
  }, [auth.status]);

  useEffect(() => {
    if (window.location.hash === "#search") {
      document.getElementById("search")?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, []);

  // When results first appear, scroll so the results block dominates the viewport.
  useEffect(() => {
    if (!hasResultsSurface) {
      scrolledForResultsRef.current = false;

      return;
    }

    if (scrolledForResultsRef.current) return;

    scrolledForResultsRef.current = true;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const scrollToResults = () => {
      resultsRef.current?.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "start",
      });
    };

    // Double rAF so results-first layout can settle before scrolling.
    requestAnimationFrame(() => {
      requestAnimationFrame(scrollToResults);
    });
  }, [hasResultsSurface]);

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/me", { cache: "no-store" }).then((response) =>
        response.json(),
      ),
      fetch("/api/user/stats", { cache: "no-store" })
        .then((response) => response.json())
        .catch(() => null),
    ])
      .then(([meData, statsData]) => {
        if (!meData?.authenticated || !meData.user?.username) {
          setAuth({ status: "guest" });

          return;
        }

        setAuth({
          status: "authenticated",
          user: meData.user,
          canManageWorkspace: Boolean(meData.canManageWorkspace),
          searchesLast24h: statsData?.usage?.last24h ?? 0,
          intelxUsedToday: statsData?.intelxUsedToday ?? 0,
        });
      })
      .catch(() => setAuth({ status: "guest" }));
  }, []);

  const handleSearch = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmed = query.trim();

    if (!trimmed) return;

    if (auth.status === "loading") return;

    const isGuest = auth.status === "guest";
    const route = resolveStarterSearchRoute(starterMode, trimmed);
    const searchQuery = route.searchQuery ?? trimmed;

    setError("");
    clearResults();
    setBlurResults(false);

    // Class C premium module from homepage.
    if (premiumModule) {
      if (auth.status !== "authenticated") {
        setError("Sign in to run premium credit modules.");

        return;
      }

      const userPlan = resolveUserPlan(auth.user);
      const accessCheck = checkModuleAccess(userPlan, premiumModule, {
        balance: auth.user.balance ?? 0,
        intelxUsedToday: auth.intelxUsedToday,
      });

      if (!accessCheck.allowed) {
        setError(
          accessCheck.reason ??
            "This premium module needs credits or a higher plan.",
        );

        return;
      }

      setIsSearching(true);

      try {
        const apiPath =
          premiumModule === "instagram-live"
            ? `/api/osint/instagram?query=${encodeURIComponent(trimmed)}&moduleSlug=instagram-live&maxUsers=100&includeActivity=0&enrichBios=0`
            : premiumModule === "hinge-live"
              ? `/api/osint/hinge-live?query=${encodeURIComponent(trimmed)}&moduleSlug=hinge-live`
              : `/api/osint/stealer?query=${encodeURIComponent(trimmed)}&moduleSlug=stealer-logs`;

        const response = await fetch(apiPath, { credentials: "include" });
        const data = await response.json();

        if (!response.ok) {
          setError(sanitizePublicText(data.error || "Premium search failed."));

          return;
        }

        if (premiumModule === "instagram-live") {
          setInstagramResult(data as InstagramSearchPayload);
        } else if (premiumModule === "hinge-live") {
          setHingeResult(data as HingeLiveSearchResult);
        } else {
          const credentials = extractStealerCredentialRows(
            Array.isArray(data.credentials)
              ? data.credentials
              : Array.isArray(data.results)
                ? data.results
                : [],
          );
          setStealerResult({
            credentials,
            archives: Array.isArray(data.archives) ? data.archives : [],
            count:
              typeof data.count === "number"
                ? data.count
                : credentials.length,
          });
        }

        // Charge via stats when balanceCost applies.
        if (accessCheck.requiresBalance && accessCheck.balanceCost) {
          void apiFetch("/api/user/stats", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              query: trimmed,
              type: premiumModule,
              moduleSlug: premiumModule,
              resultData: JSON.stringify({ ok: true }),
            }),
          }).catch(() => null);
        }
      } catch {
        setError("Could not complete the premium search.");
      } finally {
        setIsSearching(false);
      }

      return;
    }

    if (auth.status === "authenticated") {
      const userPlan = resolveUserPlan(auth.user);
      const quotaCheck = checkDailySearchQuota(userPlan, auth.searchesLast24h);
      const accessCheck = checkModuleAccess(userPlan, route.moduleSlug, {
        balance: auth.user.balance ?? 0,
        intelxUsedToday: auth.intelxUsedToday,
      });

      if (!quotaCheck.allowed) {
        setError(quotaCheck.reason ?? "Daily search limit reached.");

        return;
      }

      if (!accessCheck.allowed) {
        setError(
          accessCheck.reason ?? "This lookup is not available on your plan.",
        );

        return;
      }

      setBlurResults(
        Boolean(accessCheck.blurResults) || shouldBlurResults(userPlan),
      );
    } else {
      setBlurResults(true);
    }

    setIsSearching(true);
    setStreamStatus(null);
    setStreamProgress(null);
    searchAbortRef.current?.abort();
    const abort = new AbortController();
    searchAbortRef.current = abort;

    const scopeParam = route.scope
      ? `&scope=${encodeURIComponent(route.scope)}`
      : "";
    const moduleParam = `&moduleSlug=${encodeURIComponent(route.moduleSlug)}`;
    // Match dashboard Breaches: pass field-type hint so email fan-out runs.
    const breachType =
      route.apiType === "breaches"
        ? starterMode === "email" || normalizeEmail(searchQuery)
          ? "email"
          : null
        : null;
    const breachesTypeParam = breachType
      ? `&type=${encodeURIComponent(breachType)}`
      : "";

    const applyBreachesPayload = (
      breachData: CombSearchResult & {
        error?: string;
        message?: string;
        hasGodsEyeReport?: boolean;
        hasBreachVipResults?: boolean;
        csintCount?: number;
        breachHubCount?: number;
        osintCatCount?: number;
        godseyeSearchCount?: number;
        blurResults?: boolean;
        premiumSectionsLocked?: boolean;
        vaultId?: string;
        claimToken?: string;
      },
      opts?: { allowShrink?: boolean },
    ) => {
      const credentials = Array.isArray(breachData.credentials)
        ? breachData.credentials
        : [];
      const matchCount = credentials.length;

      setCombResult((prev) => {
        const prevCount = prev?.credentials?.length ?? 0;

        if (!opts?.allowShrink && prev && matchCount < prevCount) {
          return {
            ...breachData,
            credentials: prev.credentials,
            returned: prevCount,
            totalMatches: prevCount,
          };
        }

        return {
          ...breachData,
          credentials,
          returned: matchCount,
          totalMatches: matchCount,
        };
      });
      setResultCount((prev) => Math.max(prev, matchCount));

      if (breachData.blurResults || breachData.premiumSectionsLocked) {
        if (breachData.blurResults) setBlurResults(true);
        captureVaultFromData(breachData as Record<string, unknown>, {
          mode: starterMode,
          query: searchQuery,
          moduleSlug: route.moduleSlug,
        });
      }
    };

    const isBreachesEmpty = (
      breachData: CombSearchResult & {
        hasGodsEyeReport?: boolean;
        hasBreachVipResults?: boolean;
        csintCount?: number;
        breachHubCount?: number;
        osintCatCount?: number;
        godseyeSearchCount?: number;
      },
    ) =>
      (breachData.credentials?.length ?? 0) === 0 &&
      !breachData.hasGodsEyeReport &&
      !breachData.hasBreachVipResults &&
      !(breachData.csintCount && breachData.csintCount > 0) &&
      !(breachData.breachHubCount && breachData.breachHubCount > 0) &&
      !(breachData.osintCatCount && breachData.osintCatCount > 0) &&
      !(breachData.godseyeSearchCount && breachData.godseyeSearchCount > 0);

    try {
      const wantsProgressive =
        route.apiType === "breaches" || route.apiType === "discord";
      const streamParam = wantsProgressive ? "&stream=1" : "";
      const response = await fetch(
        `/api/osint/${route.apiType}?query=${encodeURIComponent(searchQuery)}${scopeParam}${moduleParam}${breachesTypeParam}${streamParam}`,
        {
          credentials: "include",
          signal: abort.signal,
          headers: wantsProgressive
            ? { Accept: "application/x-ndjson" }
            : undefined,
        },
      );

      if (abort.signal.aborted) return;

      const contentType = response.headers.get("content-type") ?? "";
      const isNdjson =
        wantsProgressive &&
        contentType.includes("ndjson") &&
        Boolean(response.body);

      if (!response.ok && !isNdjson) {
        const data = await response.json().catch(() => ({}));
        setError(
          sanitizePublicText(
            (data as { error?: string }).error || "Search failed.",
          ),
        );

        return;
      }

      if (isNdjson && route.apiType === "breaches") {
        setStreamStatus("Fetching sources…");
        let sawUseful = false;
        let streamError: string | null = null;

        await consumeOsintNdjsonStream(response, {
          signal: abort.signal,
          onPartial: (event) => {
            const payload = event.result as CombSearchResult & {
              blurResults?: boolean;
              premiumSectionsLocked?: boolean;
            };
            if (!payload || typeof payload !== "object") return;

            if (event.module) {
              setStreamStatus(
                `Adding ${event.module}${
                  typeof event.done === "number" && typeof event.total === "number"
                    ? ` (${event.done}/${event.total})`
                    : ""
                }…`,
              );
            }
            if (
              typeof event.done === "number" &&
              typeof event.total === "number" &&
              event.total > 0
            ) {
              setStreamProgress(event.done / event.total);
            }

            if (!isBreachesEmpty(payload)) {
              sawUseful = true;
              setError("");
              applyBreachesPayload(payload);
            }
          },
          onDone: (event) => {
            const payload = event.result as CombSearchResult & {
              error?: string;
              message?: string;
              blurResults?: boolean;
              premiumSectionsLocked?: boolean;
            };
            if (!payload || typeof payload !== "object") return;

            setStreamProgress(1);
            applyBreachesPayload(payload, { allowShrink: false });

            if (isBreachesEmpty(payload) && !sawUseful) {
              setError(
                payload.message ||
                  payload.error ||
                  "No results were found.",
              );
              setCombResult(null);
            }
          },
          onError: (event) => {
            streamError =
              typeof event.error === "string"
                ? event.error
                : "Search failed.";
          },
        });

        if (streamError && !sawUseful) {
          setError(sanitizePublicText(streamError));
        }

        setStreamStatus(null);
        setStreamProgress(null);

        return;
      }

      if (isNdjson && route.apiType === "discord") {
        setStreamStatus("Fetching Discord sources…");
        let sawProfile = false;
        let streamError: string | null = null;

        await consumeOsintNdjsonStream(response, {
          signal: abort.signal,
          onPartial: (event) => {
            const payload = event.result as DiscordSearchResult & {
              blurResults?: boolean;
              premiumSectionsLocked?: boolean;
              teaser?: boolean;
            };
            if (!payload || typeof payload !== "object") return;

            if (event.module) {
              const progress =
                typeof event.done === "number" &&
                typeof event.total === "number"
                  ? ` (${event.done}/${event.total})`
                  : "";
              setStreamStatus(`Adding ${event.module}${progress}…`);
            }
            if (
              typeof event.done === "number" &&
              typeof event.total === "number" &&
              event.total > 0
            ) {
              setStreamProgress(event.done / event.total);
            }

            if (payload.profile || payload.teaser) {
              sawProfile = true;
              setError("");
              setDiscordResult(payload);
              if (payload.blurResults || payload.premiumSectionsLocked) {
                if (payload.blurResults) setBlurResults(true);
                captureVaultFromData(payload as Record<string, unknown>, {
                  mode: starterMode,
                  query: searchQuery,
                  moduleSlug: route.moduleSlug,
                });
              }
            }
          },
          onDone: (event) => {
            const payload = event.result as DiscordSearchResult & {
              error?: string;
              blurResults?: boolean;
              premiumSectionsLocked?: boolean;
              teaser?: boolean;
            };
            if (!payload || typeof payload !== "object") return;

            setStreamProgress(1);

            if (!payload.profile && !payload.teaser && !sawProfile) {
              setError(payload.error || "Could not load Discord profile.");
              setDiscordResult(null);

              return;
            }

            setDiscordResult(payload);
            if (payload.blurResults || payload.premiumSectionsLocked) {
              if (payload.blurResults) setBlurResults(true);
              captureVaultFromData(payload as Record<string, unknown>, {
                mode: starterMode,
                query: searchQuery,
                moduleSlug: route.moduleSlug,
              });
            }
          },
          onError: (event) => {
            streamError =
              typeof event.error === "string"
                ? event.error
                : "Search failed.";
          },
        });

        if (streamError && !sawProfile) {
          setError(sanitizePublicText(streamError));
        }

        setStreamStatus(null);
        setStreamProgress(null);

        return;
      }

      const data = await response.json();

      if (!response.ok) {
        setError(sanitizePublicText(data.error || "Search failed."));

        return;
      }

      if (data?.blurResults || data?.premiumSectionsLocked) {
        if (data.blurResults) setBlurResults(true);
        captureVaultFromData(data as Record<string, unknown>, {
          mode: starterMode,
          query: searchQuery,
          moduleSlug: route.moduleSlug,
        });
      }

      if (route.apiType === "discord") {
        const discordData = data as DiscordSearchResult & { error?: string };

        if (!discordData.profile && !data?.teaser) {
          setError(discordData.error || "Could not load Discord profile.");

          return;
        }

        setDiscordResult(discordData);

        return;
      }

      if (route.apiType === "breaches") {
        // API returns CombSearchResult ({ credentials, returned }), not { results }.
        const breachData = data as CombSearchResult & {
          error?: string;
          message?: string;
          hasGodsEyeReport?: boolean;
          hasBreachVipResults?: boolean;
          csintCount?: number;
          breachHubCount?: number;
          osintCatCount?: number;
          godseyeSearchCount?: number;
        };

        if (isBreachesEmpty(breachData)) {
          setError(
            breachData.message || breachData.error || "No results were found.",
          );

          return;
        }

        applyBreachesPayload(breachData, { allowShrink: true });

        return;
      }

      if (Array.isArray(data.results)) {
        const results = data.results as unknown[];

        if (results.length === 0) {
          setError("No results were found.");

          return;
        }

        const formatted = formatSearchRecords(results);

        setRecords(formatted);
        setResultCount(
          typeof data.count === "number" ? data.count : results.length,
        );

        return;
      }

      const formatted = formatStructuredSearchData(data);

      if (formatted.length === 0) {
        setError("No results were found.");

        return;
      }

      setRecords(formatted);
      setResultCount(
        typeof (data as { count?: number }).count === "number"
          ? (data as { count: number }).count
          : formatted.length,
      );
    } catch (err) {
      if (abort.signal.aborted) return;
      setError("Could not complete the search.");
    } finally {
      if (!abort.signal.aborted) {
        setIsSearching(false);
        setStreamStatus(null);
        setStreamProgress(null);
      }
    }
  };

  const searchBar = (
    <div
      className="home-search-input-wrap relative"
      data-tour="home-search-input"
    >
      <AutofillDecoyFields />
      <Search className="home-search-icon" />
      <input
        {...SEARCH_AUTOFILL_SHIELD}
        readOnly
        className="home-search-input"
        name="home-osint-query"
        placeholder={typingPlaceholder}
        type="text"
        value={query}
        onBlur={() => setInputFocused(false)}
        onChange={(event) => setQuery(event.target.value)}
        onFocus={(event) => {
          setInputFocused(true);
          unlockAutofillShield(event);
        }}
      />
      <div
        ref={premiumControlRef}
        className={clsx(
          "home-search-premium-control",
          premiumMenuOpen && "home-search-premium-control--open",
          Boolean(premiumModule) && "home-search-premium-control--active",
        )}
      >
        <button
          aria-expanded={premiumMenuOpen}
          aria-haspopup="menu"
          aria-label={
            showPremiumLocked
              ? hasStableLockedModules
                ? `${visibleLockedModuleCount} premium modules locked`
                : "Premium modules locked"
              : premiumModule
                ? `Premium module: ${activePremiumOption?.label ?? "active"}`
                : "Activate premium modules"
          }
          className={clsx(
            "home-search-premium-trigger",
            showPremiumLocked && "home-search-premium-trigger--locked",
            Boolean(premiumModule) && "home-search-premium-trigger--active",
          )}
          type="button"
          onClick={() => setPremiumMenuOpen((open) => !open)}
        >
          {showPremiumLocked ? (
            <LockKeyhole className="size-4 shrink-0" />
          ) : (
            <Sparkles className="size-4 shrink-0" />
          )}
          <span className="home-search-premium-trigger-label">
            {showPremiumLocked
              ? "Premium"
              : activePremiumOption?.label ?? "Premium"}
          </span>
          {showPremiumLocked && hasStableLockedModules ? (
            <strong className="home-search-premium-trigger-count">
              {visibleLockedModuleCount}
            </strong>
          ) : null}
          <ChevronDown
            className={clsx(
              "home-search-premium-chevron size-3.5 shrink-0",
              premiumMenuOpen && "home-search-premium-chevron--open",
            )}
          />
        </button>

        {premiumMenuOpen ? (
          <div
            className={clsx(
              "home-search-premium-menu",
              showPremiumLocked && "home-search-premium-menu--locked",
            )}
            role={showPremiumLocked ? "dialog" : "menu"}
          >
            {showPremiumLocked ? (
              <div className="home-search-locked-popover-card">
                <div className="home-search-locked-heading">
                  <span>Premium module directory</span>
                  <strong>{visibleLockedModuleCount} locked</strong>
                </div>
                <ul className="home-search-locked-grid">
                  {visibleLockedModules.map((module) => (
                    <li key={module.slug}>{module.name}</li>
                  ))}
                </ul>
                <Link
                  className="home-search-locked-cta"
                  href="/pricing"
                  onClick={() => setPremiumMenuOpen(false)}
                >
                  Buy Premium
                </Link>
              </div>
            ) : (
              <div className="home-search-premium-menu-card">
                <p className="home-search-premium-menu-heading">
                  Activate premium modules
                </p>
                <button
                  aria-pressed={!premiumModule}
                  className={clsx(
                    "home-search-premium-option",
                    !premiumModule && "home-search-premium-option--active",
                  )}
                  role="menuitemradio"
                  type="button"
                  onClick={() => {
                    setPremiumModule(null);
                    setError("");
                    setPremiumMenuOpen(false);
                  }}
                >
                  <span>Included</span>
                  <small>Email · Phone · Username · Discord · Breaches</small>
                </button>
                {HOME_PREMIUM_MODULE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    aria-pressed={premiumModule === opt.id}
                    className={clsx(
                      "home-search-premium-option",
                      premiumModule === opt.id &&
                        "home-search-premium-option--active",
                    )}
                    role="menuitemradio"
                    title={opt.hint}
                    type="button"
                    onClick={() => {
                      setPremiumModule(opt.id);
                      setError("");
                      setPremiumMenuOpen(false);
                    }}
                  >
                    <span>{opt.label}</span>
                    <small>{opt.hint}</small>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </div>
      <LiquidButton
        className="home-search-submit liquid-glass-button--accent"
        data-tour="home-search-submit"
        disabled={!query.trim() || isSearching || auth.status === "loading"}
        type="submit"
      >
        {isSearching ? (
          hasResultsSurface ? (
            "Loading more…"
          ) : (
            "Running…"
          )
        ) : (
          <>
            <span>
              {premiumCostLabel ? `Search · ${premiumCostLabel}` : "Search"}
            </span>
            <ArrowRight className="size-5" />
          </>
        )}
      </LiquidButton>
    </div>
  );

  return (
    <div
      className={clsx(
        "home-search",
        hasResultsSurface && "home-search--has-results",
      )}
      data-tour="home-search"
      id="search"
    >
      <LiquidGlassCard
        blurIntensity="lg"
        borderRadius="1.25rem"
        className="home-search-glass px-4 py-4 md:px-5 md:py-5"
        draggable={false}
        glowIntensity="none"
        shadowIntensity="sm"
      >
        <form
          autoComplete="off"
          className="home-search-form"
          onSubmit={handleSearch}
        >
          <div className="home-search-module-row">
            <div
              aria-label="Search type"
              className="starter-search-modes"
              data-tour="home-search-modes"
              role="tablist"
            >
              {STARTER_SEARCH_MODES.map((mode) => {
                const Icon = MODE_ICONS[mode.id];

                return (
                  <button
                    key={mode.id}
                    aria-selected={starterMode === mode.id && !premiumModule}
                    className={clsx(
                      "starter-search-mode",
                      starterMode === mode.id &&
                        !premiumModule &&
                        "starter-search-mode--active",
                    )}
                    role="tab"
                    type="button"
                    onClick={() => {
                      setStarterMode(mode.id);
                      setPremiumModule(null);
                      setError("");
                    }}
                  >
                    <Icon className="size-4" />
                    {mode.label}
                  </button>
                );
              })}
            </div>
          </div>

          {premiumModule ? (
            <p className="home-search-premium-hint">
              {activePremiumOption?.hint}
              {auth.status === "guest"
                ? " · Sign in required before Search."
                : null}
            </p>
          ) : null}

          {searchBar}

          <SearchProgressBar
            active={isSearching}
            progress={streamProgress}
            status={streamStatus}
          />
        </form>
      </LiquidGlassCard>

      {error ? <p className="home-search-error">{error}</p> : null}

      {discordResult ? (
        <div
          ref={resultsRef}
          className="home-search-results home-search-results--enter"
          data-tour="home-search-results"
        >
          <DiscordSearchResults
            balance={balance}
            blurNoticeIsGuest={auth.status === "guest"}
            blurResults={blurResults}
            claimToken={claimToken}
            result={discordResult}
            unlock={unlockMeta}
            vaultId={vaultId}
            onUnlocked={applyUnlockedPayload}
          />
        </div>
      ) : null}

      {combResult ? (
        <div
          ref={resultsRef}
          className="home-search-results home-search-results--enter"
          data-tour="home-search-results"
        >
          <BreachesSearchResults
            balance={balance}
            blurNoticeIsGuest={auth.status === "guest"}
            blurResults={blurResults}
            claimToken={claimToken}
            result={combResult}
            unlock={unlockMeta}
            vaultId={vaultId}
            onUnlocked={applyUnlockedPayload}
          />
        </div>
      ) : null}

      {instagramResult ? (
        <div
          ref={resultsRef}
          className="home-search-results home-search-results--enter"
        >
          <InstagramSearchResults result={instagramResult} />
        </div>
      ) : null}

      {hingeResult ? (
        <div
          ref={resultsRef}
          className="home-search-results home-search-results--enter"
        >
          <HingeLiveResults data={hingeResult} />
        </div>
      ) : null}

      {stealerResult ? (
        <div
          ref={resultsRef}
          className="home-search-results home-search-results--enter"
        >
          <StealerLogsSearchResults
            archives={stealerResult.archives}
            credentials={stealerResult.credentials}
            totalCredentialCount={stealerResult.count}
          />
        </div>
      ) : null}

      {records.length > 0 ? (
        <div
          ref={resultsRef}
          className="home-search-results home-search-results--enter"
          data-tour="home-search-results"
        >
          <SearchResultCards
            balance={balance}
            blurNoticeIsGuest={auth.status === "guest"}
            blurResults={blurResults}
            claimToken={claimToken}
            defaultExpanded="first"
            dense
            moduleSlug="breaches"
            pageSize={10}
            records={records}
            totalCount={resultCount}
            unlock={unlockMeta}
            vaultId={vaultId}
            onUnlocked={applyUnlockedPayload}
          />
        </div>
      ) : null}
    </div>
  );
}
