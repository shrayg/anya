"use client";

import type { UserProfile } from "@/lib/account-plan";
import type { DiscordSearchResult } from "@/lib/discord-profile";
import Link from "next/link";
import clsx from "clsx";
import {
  ArrowRight,
  AtSign,
  Database,
  Hash,
  LockKeyhole,
  Phone,
  Search,
  User,
} from "lucide-react";
import { useEffect, useState, type ElementType } from "react";

import { BreachesSearchResults } from "@/components/dashboard/breaches-search-results";
import { DiscordSearchResults } from "@/components/dashboard/discord-search-results";
import { SearchResultCards } from "@/components/dashboard/search-result-cards";
import { LiquidButton } from "@/components/ui/liquid-glass-button";
import { LiquidGlassCard } from "@/components/ui/liquid-glass";
import { getHubSections } from "@/lib/search-modules";
import {
  STARTER_SEARCH_MODES,
  resolveStarterSearchRoute,
  type StarterSearchMode,
} from "@/lib/starter-search";
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
  resolveUserPlan,
  shouldBlurResults,
  STARTER_MODULE_SLUGS,
} from "@/lib/plans";
import {
  formatSearchRecords,
  formatStructuredSearchData,
  type FormattedRecord,
} from "@/lib/search-utils";

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

  const visibleLockedModules =
    lockedModules ?? (isMounted ? LOCKED_MODULES : []);
  const visibleLockedModuleCount = visibleLockedModules.length;
  const hasStableLockedModules = lockedModules != null || isMounted;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (window.location.hash === "#search") {
      document.getElementById("search")?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, []);

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

  const activeStarterMode =
    STARTER_SEARCH_MODES.find((mode) => mode.id === starterMode) ??
    STARTER_SEARCH_MODES[0];

  const handleSearch = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmed = query.trim();

    if (!trimmed) return;

    if (auth.status === "guest") {
      window.location.href = "/auth?action=login";

      return;
    }

    if (auth.status === "loading") return;

    const userPlan = resolveUserPlan(auth.user);
    const route = resolveStarterSearchRoute(starterMode, trimmed);
    const searchQuery = route.searchQuery ?? trimmed;
    const quotaCheck = checkDailySearchQuota(userPlan, auth.searchesLast24h);
    const accessCheck = checkModuleAccess(userPlan, route.moduleSlug, {
      balance: auth.user.balance ?? 0,
      intelxUsedToday: auth.intelxUsedToday,
    });

    setError("");
    setRecords([]);
    setDiscordResult(null);
    setCombResult(null);
    setResultCount(0);
    setBlurResults(false);

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

    setIsSearching(true);
    setBlurResults(
      Boolean(accessCheck.blurResults) || shouldBlurResults(userPlan),
    );

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

    try {
      const response = await fetch(
        `/api/osint/${route.apiType}?query=${encodeURIComponent(searchQuery)}${scopeParam}${moduleParam}${breachesTypeParam}`,
        { credentials: "include" },
      );
      const data = await response.json();

      if (!response.ok) {
        setError(sanitizePublicText(data.error || "Search failed."));

        return;
      }

      if (route.apiType === "discord") {
        const discordData = data as DiscordSearchResult & { error?: string };

        if (!discordData.profile) {
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
        const credentials = Array.isArray(breachData.credentials)
          ? breachData.credentials
          : [];
        const returned =
          typeof breachData.returned === "number"
            ? breachData.returned
            : credentials.length;
        const empty =
          returned === 0 &&
          credentials.length === 0 &&
          !breachData.hasGodsEyeReport &&
          !breachData.hasBreachVipResults &&
          !(breachData.csintCount && breachData.csintCount > 0) &&
          !(breachData.breachHubCount && breachData.breachHubCount > 0) &&
          !(breachData.osintCatCount && breachData.osintCatCount > 0) &&
          !(breachData.godseyeSearchCount && breachData.godseyeSearchCount > 0);

        if (empty) {
          setError(
            breachData.message || breachData.error || "No results were found.",
          );

          return;
        }

        setCombResult({
          ...breachData,
          credentials,
          returned,
        });
        setResultCount(
          typeof breachData.totalMatches === "number"
            ? breachData.totalMatches
            : returned,
        );

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
    } catch {
      setError("Could not complete the search.");
    } finally {
      setIsSearching(false);
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
        placeholder={activeStarterMode.placeholder}
        type="text"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onFocus={unlockAutofillShield}
      />
      <LiquidButton
        className="home-search-submit"
        data-tour="home-search-submit"
        disabled={!query.trim() || isSearching || auth.status === "loading"}
        type="submit"
      >
        {isSearching ? (
          "Running…"
        ) : (
          <>
            <span>Search</span>
            <ArrowRight className="size-5" />
          </>
        )}
      </LiquidButton>
    </div>
  );

  return (
    <div className="home-search" data-tour="home-search" id="search">
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
            <div className="home-search-locked-module">
              <button
                aria-label={
                  hasStableLockedModules
                    ? `${visibleLockedModuleCount} premium modules locked`
                    : "Premium modules locked"
                }
                className="home-search-locked-trigger"
                type="button"
              >
                <LockKeyhole className="size-4" />
                <strong>
                  {hasStableLockedModules ? visibleLockedModuleCount : "—"}
                </strong>
                <span>Premium locked</span>
              </button>

              <div className="home-search-locked-popover" role="tooltip">
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
                  <Link className="home-search-locked-cta" href="/pricing">
                    Purchase Access to Premium Modules and unlock the full Panel
                    Suite
                  </Link>
                </div>
              </div>
            </div>

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
                    aria-selected={starterMode === mode.id}
                    className={clsx(
                      "starter-search-mode",
                      starterMode === mode.id && "starter-search-mode--active",
                    )}
                    role="tab"
                    type="button"
                    onClick={() => {
                      setStarterMode(mode.id);
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

          {searchBar}
        </form>
      </LiquidGlassCard>

      {error ? <p className="home-search-error">{error}</p> : null}

      {discordResult ? (
        <div className="home-search-results" data-tour="home-search-results">
          <DiscordSearchResults
            blurResults={blurResults}
            result={discordResult}
          />
        </div>
      ) : null}

      {combResult ? (
        <div className="home-search-results" data-tour="home-search-results">
          <BreachesSearchResults
            blurResults={blurResults}
            result={combResult}
          />
        </div>
      ) : null}

      {records.length > 0 ? (
        <div className="home-search-results" data-tour="home-search-results">
          <SearchResultCards
            blurResults={blurResults}
            defaultExpanded="first"
            dense
            moduleSlug="breaches"
            records={records}
            totalCount={resultCount}
          />
        </div>
      ) : null}
    </div>
  );
}
