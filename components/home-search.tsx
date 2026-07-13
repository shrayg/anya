"use client";

import Link from "next/link";
import clsx from "clsx";
import { ArrowUp, AtSign, Hash, Phone, Search, User } from "lucide-react";
import { useEffect, useState, type ElementType } from "react";

import { SearchBarTour, resetSearchBarTour } from "@/components/search-bar-tour";
import { DiscordSearchResults } from "@/components/dashboard/discord-search-results";
import { SearchResultCards } from "@/components/dashboard/search-result-cards";
import type { UserProfile } from "@/lib/account-plan";
import { getUserPlan } from "@/lib/account-plan";
import { resolveHomeSearchRoute } from "@/lib/home-search-route";
import { HOME_SEARCH_TOUR_STEPS, HOME_SEARCH_TOUR_STORAGE_KEY } from "@/lib/search-tour";
import {
  STARTER_SEARCH_MODES,
  resolveStarterSearchRoute,
  type StarterSearchMode,
} from "@/lib/starter-search";
import {
  checkDailySearchQuota,
  checkModuleAccess,
  getPlanDefinition,
  hasWorkspaceDashboardAccess,
  resolveUserPlan,
  shouldBlurResults,
} from "@/lib/plans";
import {
  formatSearchRecords,
  formatStructuredSearchData,
  type FormattedRecord,
} from "@/lib/search-utils";
import type { DiscordSearchResult } from "@/lib/discord-profile";

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

function sanitizePublicText(value: string) {
  return value.replace(/osintcat/gi, "provider").replace(/godseye/gi, "source");
}

const MODE_ICONS: Record<StarterSearchMode, ElementType> = {
  email: AtSign,
  phone: Phone,
  username: User,
  discord: Hash,
};

export function HomeSearch() {
  const [auth, setAuth] = useState<AuthState>({ status: "loading" });
  const [query, setQuery] = useState("");
  const [starterMode, setStarterMode] = useState<StarterSearchMode>("email");
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState("");
  const [records, setRecords] = useState<FormattedRecord[]>([]);
  const [resultCount, setResultCount] = useState(0);
  const [discordResult, setDiscordResult] = useState<DiscordSearchResult | null>(null);
  const [blurResults, setBlurResults] = useState(false);
  const [tourSession, setTourSession] = useState(0);

  const startSearchGuide = () => {
    resetSearchBarTour(HOME_SEARCH_TOUR_STORAGE_KEY);
    setTourSession((current) => current + 1);
  };

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
      fetch("/api/auth/me", { cache: "no-store" }).then((response) => response.json()),
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

  const plan =
    auth.status === "authenticated" ? resolveUserPlan(auth.user) : null;
  const useStarterSearch = plan === "starter";
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
    const route =
      userPlan === "starter"
        ? resolveStarterSearchRoute(starterMode, trimmed)
        : resolveHomeSearchRoute(trimmed);
    const searchQuery = route.searchQuery ?? trimmed;
    const quotaCheck = checkDailySearchQuota(userPlan, auth.searchesLast24h);
    const accessCheck = checkModuleAccess(userPlan, route.moduleSlug, {
      balance: auth.user.balance ?? 0,
      intelxUsedToday: auth.intelxUsedToday,
    });

    setError("");
    setRecords([]);
    setDiscordResult(null);
    setResultCount(0);
    setBlurResults(false);

    if (!quotaCheck.allowed) {
      setError(quotaCheck.reason ?? "Daily search limit reached.");
      return;
    }

    if (!accessCheck.allowed) {
      setError(accessCheck.reason ?? "This lookup is not available on your plan.");
      return;
    }

    setIsSearching(true);
    setBlurResults(Boolean(accessCheck.blurResults) || shouldBlurResults(userPlan));

    const scopeParam = route.scope
      ? `&scope=${encodeURIComponent(route.scope)}`
      : "";
    const moduleParam = `&moduleSlug=${encodeURIComponent(route.moduleSlug)}`;

    try {
      const response = await fetch(
        `/api/osint/${route.apiType}?query=${encodeURIComponent(searchQuery)}${scopeParam}${moduleParam}`,
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
        const breachData = data as {
          results?: unknown[];
          count?: number;
          returned?: number;
          message?: string;
          error?: string;
        };
        const results = Array.isArray(breachData.results) ? breachData.results : [];

        if (results.length === 0) {
          setError(breachData.message || breachData.error || "No results were found.");
          return;
        }

        const formatted = formatSearchRecords(results);
        setRecords(formatted);
        setResultCount(
          typeof breachData.count === "number"
            ? breachData.count
            : typeof breachData.returned === "number"
              ? breachData.returned
              : results.length,
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
        setResultCount(typeof data.count === "number" ? data.count : results.length);
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

  const planLabel =
    auth.status === "authenticated"
      ? getPlanDefinition(getUserPlan(auth.user)).name
      : null;

  const hasWorkspace =
    auth.status === "authenticated" &&
    hasWorkspaceDashboardAccess({
      ...auth.user,
      canManageWorkspace: auth.canManageWorkspace,
    });

  const searchBar = (
    <div className="home-search-input-wrap" data-tour="home-search-input">
      <Search className="home-search-icon" />
      <input
        className="home-search-input"
        onChange={(event) => setQuery(event.target.value)}
        placeholder={
          useStarterSearch
            ? activeStarterMode.placeholder
            : "Email, username, phone, Discord ID, or dating profile link…"
        }
        value={query}
      />
      <button
        className="home-search-submit"
        data-tour="home-search-submit"
        disabled={!query.trim() || isSearching || auth.status === "loading"}
        type="submit"
      >
        {isSearching ? (
          "Running…"
        ) : (
          <>
            <span className="hidden sm:inline">Search</span>
            <ArrowUp className="size-4" />
          </>
        )}
      </button>
    </div>
  );

  return (
    <div className="home-search w-full max-w-5xl px-2" data-tour="home-search" id="search">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-zinc-400">What would you like to investigate?</p>
        <button
          className="home-search-guide-btn"
          onClick={startSearchGuide}
          type="button"
        >
          Step-by-step guide
        </button>
      </div>

      <form className="home-search-form" onSubmit={handleSearch}>
        {useStarterSearch ? (
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
                  onClick={() => {
                    setStarterMode(mode.id);
                    setError("");
                  }}
                  role="tab"
                  type="button"
                >
                  <Icon className="size-3.5" />
                  {mode.label}
                </button>
              );
            })}
          </div>
        ) : null}

        {searchBar}
      </form>

      {auth.status === "guest" && (
        <p className="mt-3 text-xs text-zinc-500">
          <Link className="text-anya-accent underline hover:text-anya-accent-hover" href="/auth?action=login">
            Sign in
          </Link>{" "}
          to run lookups. Free and Starter search from the homepage — Professional unlocks the full panel.
        </p>
      )}

      {auth.status === "authenticated" && planLabel && !hasWorkspace && (
        <p className="mt-3 text-xs text-zinc-500">
          {planLabel} plan · homepage search
          {useStarterSearch ? " · Email, Phone, Username, Discord." : "."}{" "}
          <Link className="text-anya-accent underline hover:text-anya-accent-hover" href="/pricing">
            Upgrade to Professional
          </Link>{" "}
          for more modules.
        </p>
      )}

      {auth.status === "authenticated" && hasWorkspace && (
        <p className="mt-3 text-xs text-zinc-500">
          Quick lookup here, or open your{" "}
          <Link className="text-anya-accent underline hover:text-anya-accent-hover" href="/dashboard/search/ai-search">
            full workspace
          </Link>{" "}
          for every module.
        </p>
      )}

      {error ? (
        <p className="home-search-error">{error}</p>
      ) : null}

      {discordResult ? (
        <div className="home-search-results" data-tour="home-search-results">
          <DiscordSearchResults blurResults={blurResults} result={discordResult} />
        </div>
      ) : null}

      {records.length > 0 ? (
        <div className="home-search-results" data-tour="home-search-results">
          <SearchResultCards
            blurResults={blurResults}
            records={records}
            totalCount={resultCount}
          />
        </div>
      ) : null}

      <SearchBarTour
        key={tourSession}
        ariaLabel="Homepage search guide"
        steps={HOME_SEARCH_TOUR_STEPS}
        storageKey={HOME_SEARCH_TOUR_STORAGE_KEY}
      />
    </div>
  );
}
