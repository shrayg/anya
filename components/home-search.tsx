"use client";

import type { UserProfile } from "@/lib/account-plan";
import type { DiscordSearchResult } from "@/lib/discord-profile";

import Link from "next/link";
import clsx from "clsx";
import {
  ArrowRight,
  AtSign,
  Hash,
  LockKeyhole,
  Phone,
  Search,
  User,
} from "lucide-react";
import { useEffect, useState, type ElementType } from "react";

import { DiscordSearchResults } from "@/components/dashboard/discord-search-results";
import { SearchResultCards } from "@/components/dashboard/search-result-cards";
import { getHubSections } from "@/lib/search-modules";
import {
  STARTER_SEARCH_MODES,
  resolveStarterSearchRoute,
  type StarterSearchMode,
} from "@/lib/starter-search";
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
};

const LOCKED_MODULES = getHubSections().flatMap((section) =>
  section.items.filter((module) => !STARTER_MODULE_SLUGS.has(module.slug)),
);

const LOCKED_MODULE_COUNT = LOCKED_MODULES.length;

export function HomeSearch() {
  const [auth, setAuth] = useState<AuthState>({ status: "loading" });
  const [query, setQuery] = useState("");
  const [starterMode, setStarterMode] = useState<StarterSearchMode>("email");
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState("");
  const [records, setRecords] = useState<FormattedRecord[]>([]);
  const [resultCount, setResultCount] = useState(0);
  const [discordResult, setDiscordResult] =
    useState<DiscordSearchResult | null>(null);
  const [blurResults, setBlurResults] = useState(false);

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
        const results = Array.isArray(breachData.results)
          ? breachData.results
          : [];

        if (results.length === 0) {
          setError(
            breachData.message || breachData.error || "No results were found.",
          );

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

  const hasWorkspace =
    auth.status === "authenticated" &&
    hasWorkspaceDashboardAccess({
      ...auth.user,
      canManageWorkspace: auth.canManageWorkspace,
    });

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
            <span>Search</span>
            <ArrowRight className="size-4" />
          </>
        )}
      </button>
    </div>
  );

  return (
    <div className="home-search" data-tour="home-search" id="search">
      <form
        autoComplete="off"
        className="home-search-form"
        onSubmit={handleSearch}
      >
        <div className="home-search-module-row">
          <div className="home-search-locked-module">
            <button
              aria-label={`${LOCKED_MODULE_COUNT} premium modules locked`}
              className="home-search-locked-trigger"
              type="button"
            >
              <LockKeyhole className="size-3.5" />
              <strong>{LOCKED_MODULE_COUNT}</strong>
              <span>Premium locked</span>
            </button>

            <div className="home-search-locked-popover" role="tooltip">
              <div className="home-search-locked-heading">
                <span>Premium module directory</span>
                <strong>{LOCKED_MODULE_COUNT} locked</strong>
              </div>
              <ul className="home-search-locked-grid">
                {LOCKED_MODULES.map((module) => (
                  <li key={module.slug}>{module.name}</li>
                ))}
              </ul>
              <Link href="/pricing">Compare plans and unlock the panel</Link>
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
                  <Icon className="size-3.5" />
                  {mode.label}
                </button>
              );
            })}
          </div>
        </div>

        {searchBar}
      </form>

      <div className="home-search-foot">
        <span>ENTRY MODULES / EMAIL / USERNAME / PHONE / DISCORD</span>
        <span>
          {auth.status === "guest" ? (
            <Link href="/auth?action=login">SIGN IN TO SEARCH</Link>
          ) : null}
          {auth.status === "authenticated" && !hasWorkspace ? (
            <Link href="/pricing">EXPAND ACCESS</Link>
          ) : null}
          {auth.status === "authenticated" && hasWorkspace ? (
            <Link href="/dashboard/search/ai-search">OPEN WORKSPACE</Link>
          ) : null}
          {auth.status === "loading" ? "CHECKING ACCESS" : null}
        </span>
        <span>
          <Link href="/acceptable-use">LAWFUL USE ONLY</Link>
        </span>
      </div>

      {error ? <p className="home-search-error">{error}</p> : null}

      {discordResult ? (
        <div className="home-search-results" data-tour="home-search-results">
          <DiscordSearchResults
            blurResults={blurResults}
            result={discordResult}
          />
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
    </div>
  );
}
