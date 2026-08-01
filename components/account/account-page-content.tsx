"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CreditCard,
  KeyRound,
  LifeBuoy,
  Shield,
  UserRound,
} from "lucide-react";

import { AccountSecurityPanel } from "@/components/dashboard/account-security-panel";
import { AccountPlanBillingPanel } from "@/components/dashboard/account-plan-billing-panel";
import { StaffBadge } from "@/components/dashboard/staff-badge";
import { Reveal } from "@/components/craft/reveal";
import {
  formatAvailableSearches,
  formatCountdown,
  formatCredits,
  formatPlanEndDate,
  getPlanDisplayLabel,
  isUnlimitedSearchQuota,
  normalizeUserStats,
  type UserProfile,
  type UserStats,
} from "@/lib/account-plan";
import { getPlanDefinition, hasWorkspaceDashboardAccess, resolveUserPlan } from "@/lib/plans";
import { siteConfig } from "@/config/site";

type MeResponse = {
  authenticated?: boolean;
  blocked?: boolean;
  canManageWorkspace?: boolean;
  canAccessHelperDashboard?: boolean;
  user?: UserProfile & {
    canManageWorkspace?: boolean;
    canAccessHelperDashboard?: boolean;
  };
};

function useLiveCountdown(targetIso: string | null | undefined) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!targetIso) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);

    return () => window.clearInterval(id);
  }, [targetIso]);

  if (!targetIso) return null;
  const target = new Date(targetIso).getTime();

  if (!Number.isFinite(target)) return null;

  return Math.max(0, target - now);
}

function QuotaLabel({ stats }: { stats: UserStats | null }) {
  const remainingMs = useLiveCountdown(stats?.quotaRefreshAt);

  if (!stats) return "—";
  if (isUnlimitedSearchQuota(stats.quota)) return "Unlimited";
  if (!stats.quotaRefreshAt || remainingMs == null || remainingMs <= 0) {
    return "Ready";
  }

  return formatCountdown(remainingMs);
}

function PlanEndsLabel({ stats }: { stats: UserStats | null }) {
  const remainingMs = useLiveCountdown(stats?.planEndsAt);

  if (!stats || stats.plan === "free" || !stats.planEndsAt) return "—";
  if (remainingMs != null && remainingMs <= 0) return "Expired";
  if (remainingMs != null && remainingMs < 72 * 60 * 60 * 1000) {
    return formatCountdown(remainingMs);
  }

  return formatPlanEndDate(stats.planEndsAt);
}

export function AccountPageContent() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [canManageWorkspace, setCanManageWorkspace] = useState(false);
  const [canAccessHelperDashboard, setCanAccessHelperDashboard] =
    useState(false);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshStats = useCallback(() => {
    fetch("/api/user/stats")
      .then((response) => response.json())
      .then((data) => {
        if (!data.error) setStats(normalizeUserStats(data));
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/auth/me");
        const data = (await res.json().catch(() => ({}))) as MeResponse;

        if (cancelled) return;

        if (!data.authenticated || !data.user?.username || data.blocked) {
          router.replace("/auth?action=login");

          return;
        }

        setProfile(data.user);
        setCanManageWorkspace(
          Boolean(data.canManageWorkspace ?? data.user.canManageWorkspace),
        );
        setCanAccessHelperDashboard(
          Boolean(
            data.canAccessHelperDashboard ?? data.user.canAccessHelperDashboard,
          ),
        );
        setLoading(false);
        refreshStats();
      } catch {
        if (!cancelled) router.replace("/auth?action=login");
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [refreshStats, router]);

  const planName = useMemo(
    () => (profile ? getPlanDefinition(resolveUserPlan(profile)).name : "—"),
    [profile],
  );

  const showPanel =
    profile != null && hasWorkspaceDashboardAccess(profile);
  const showStaffLink = canManageWorkspace || canAccessHelperDashboard;

  if (loading || !profile) {
    return (
      <div className="account-page brutal-page relative z-20 mx-auto w-full max-w-5xl px-4 pb-24 pt-4 md:px-6 md:pt-6">
        <div className="account-loading">Loading account…</div>
      </div>
    );
  }

  const overview = [
    { label: "Plan", value: getPlanDisplayLabel(profile) },
    { label: "Searches left", value: formatAvailableSearches(stats) },
    {
      label: "Credits",
      value: stats ? formatCredits(stats.balance) : formatCredits(profile.balance),
    },
    { label: "Quota refreshes", value: <QuotaLabel stats={stats} /> },
    { label: "Plan ends", value: <PlanEndsLabel stats={stats} /> },
  ] as const;

  return (
    <div className="account-page brutal-page relative z-20 mx-auto w-full max-w-5xl px-4 pb-24 pt-4 md:px-6 md:pt-6">
      <Reveal mode="mount">
        <header className="brutal-page-header mb-10 space-y-5 md:mb-12">
          <p className="craft-kicker">
            <UserRound className="size-3.5" />
            Your account
          </p>
          <h1 className="craft-display text-4xl md:text-6xl">Account</h1>
          <p className="craft-lede">
            Profile, security, and billing for{" "}
            <em className="text-white not-italic">{profile.username}</em>
            {profile.staffRole ? (
              <>
                {" "}
                <StaffBadge role={profile.staffRole} size="sm" />
              </>
            ) : null}
            .
          </p>
          <div className="account-hero-actions">
            <span className="account-pill">
              <Shield className="size-3.5" />
              {planName} plan
            </span>
            <Link className="account-btn-ghost" href="/pricing">
              <CreditCard className="size-3.5" />
              View plans
            </Link>
            {showPanel ? (
              <Link
                className="account-btn-primary"
                href={siteConfig.defaultWorkspacePath}
              >
                Open Panel
                <ArrowRight className="size-3.5" />
              </Link>
            ) : null}
            {showStaffLink ? (
              <Link
                className="account-btn-ghost"
                href={
                  canManageWorkspace
                    ? "/dashboard/admin"
                    : "/dashboard/settings#helper"
                }
              >
                Staff workspace
              </Link>
            ) : null}
          </div>
        </header>
      </Reveal>

      <Reveal delay={0.04} mode="mount">
        <section aria-label="Account overview" className="account-overview">
          {overview.map((item) => (
            <div key={item.label} className="account-overview-cell">
              <span className="account-overview-label">{item.label}</span>
              <strong className="account-overview-value">{item.value}</strong>
            </div>
          ))}
        </section>
      </Reveal>

      <div className="account-stack">
        <Reveal delay={0.06} mode="mount">
          <section className="account-card" id="security">
            <header className="account-card-head">
              <h2>Security</h2>
              <p>Username is fixed. Update recovery email and password here.</p>
            </header>
            <AccountSecurityPanel
              embedded
              initialRecoveryEmail={profile.recoveryEmail}
              username={profile.username}
            />
          </section>
        </Reveal>

        <Reveal delay={0.08} mode="mount">
          <AccountPlanBillingPanel
            profile={profile}
            stats={stats}
            onUpdated={refreshStats}
          />
        </Reveal>

        <Reveal delay={0.1} mode="mount">
          <section className="account-card" id="api">
            <header className="account-card-head">
              <h2>
                <KeyRound className="size-4" />
                API access
              </h2>
              <p>Keys for programmatic search when your plan includes API.</p>
            </header>
            {profile.apiAccess && profile.apiKey ? (
              <div className="account-api-key">
                <span>API key</span>
                <code>{profile.apiKey}</code>
              </div>
            ) : (
              <p className="account-muted">
                No API access on this account yet. See{" "}
                <Link href="/pricing">pricing</Link> for API products.
              </p>
            )}
          </section>
        </Reveal>

        {stats ? (
          <Reveal delay={0.12} mode="mount">
            <section className="account-card" id="usage">
              <header className="account-card-head">
                <h2>Search activity</h2>
                <p>
                  Daily limits use a rolling 24-hour window. Quota refreshes when
                  the oldest search ages out.
                </p>
              </header>
              <div className="account-usage-grid">
                <div>
                  <span>Last 24 hours</span>
                  <strong>{stats.usage.last24h}</strong>
                </div>
                <div>
                  <span>Last 7 days</span>
                  <strong>{stats.usage.last1w}</strong>
                </div>
                <div>
                  <span>Last 30 days</span>
                  <strong>{stats.usage.last1m}</strong>
                </div>
              </div>
            </section>
          </Reveal>
        ) : null}
      </div>

      <p className="account-footer-note">
        <LifeBuoy className="size-3.5" />
        Need help with billing or access? Visit{" "}
        <Link href="/support">Support</Link> for email and Telegram.
      </p>
    </div>
  );
}
