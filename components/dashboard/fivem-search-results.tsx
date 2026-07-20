"use client";

import type { FivemSearchResult } from "@/lib/fivem-search";

import { useMemo, useState } from "react";
import { Shield, UserRound } from "lucide-react";

import { SearchEmptyState } from "@/components/dashboard/search-empty-state";
import { SearchResultCards } from "@/components/dashboard/search-result-cards";
import { themeAccent } from "@/config/branding";
import { formatDiscordCreatedAt, profileAccent } from "@/lib/discord-profile";
import { formatSearchRecords } from "@/lib/search-utils";

type FivemTab = "accounts" | "bans" | "profile";

function SectionPanel({
  title,
  subtitle,
  records,
  blurResults,
  emptyMessage,
  error,
  selectedExportIndex,
  onSelectExportIndex,
}: {
  title: string;
  subtitle: string;
  records: unknown[];
  blurResults: boolean;
  emptyMessage: string;
  error?: string;
  selectedExportIndex?: number | null;
  onSelectExportIndex?: (index: number) => void;
}) {
  const formatted = useMemo(() => formatSearchRecords(records), [records]);

  return (
    <div className="discord-profile-panel">
      <div className="discord-profile-panel-head">
        <h4 className="discord-profile-panel-title">{title}</h4>
        <p className="discord-profile-panel-sub">{subtitle}</p>
      </div>

      {error ? (
        <p className="discord-profile-empty border-l-2 border-red-400/50 bg-red-400/8 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      {formatted.length === 0 ? (
        <SearchEmptyState
          className="anya-search-empty--inset"
          detail={emptyMessage}
        />
      ) : (
        <SearchResultCards
          blurResults={blurResults}
          emptyDetail={emptyMessage}
          records={formatted}
          selectedExportIndex={selectedExportIndex}
          totalCount={formatted.length}
          onSelectExportIndex={onSelectExportIndex}
        />
      )}
    </div>
  );
}

export function FivemSearchResults({
  result,
  blurResults = false,
  selectedExportIndex = null,
  onSelectExportIndex,
}: {
  result: FivemSearchResult;
  blurResults?: boolean;
  selectedExportIndex?: number | null;
  onSelectExportIndex?: (index: number) => void;
}) {
  const defaultTab: FivemTab =
    result.accounts.records.length > 0
      ? "accounts"
      : result.bans.records.length > 0
        ? "bans"
        : result.profile
          ? "profile"
          : "accounts";

  const [tab, setTab] = useState<FivemTab>(defaultTab);
  const accent = result.profile
    ? profileAccent(result.profile)
    : themeAccent.blush;

  return (
    <div className="discord-profile-shell">
      <div
        className="discord-profile-banner discord-profile-banner--solid"
        style={{ backgroundColor: accent }}
      />

      <div className="discord-profile-layout">
        <aside className="discord-profile-sidebar">
          <div className="discord-profile-avatar-wrap">
            <div
              className="discord-profile-avatar-ring"
              style={
                {
                  "--discord-accent": accent,
                  "--discord-glow": `${accent}66`,
                } as React.CSSProperties
              }
            >
              {result.profile ? (
                <img
                  alt={`${result.profile.displayName} avatar`}
                  className="discord-profile-avatar"
                  src={result.profile.avatarUrl}
                />
              ) : (
                <div className="discord-profile-avatar flex items-center justify-center bg-black/30">
                  <UserRound className="size-10 text-white/70" />
                </div>
              )}
            </div>
          </div>

          <div className="discord-profile-identity">
            <h3 className="discord-profile-name">
              {result.profile?.displayName ?? "FiveM lookup"}
            </h3>
            <p className="discord-profile-handle">
              Discord ID · {result.discordId}
            </p>
          </div>

          <div className="discord-profile-meta">
            <div>
              <p className="discord-profile-meta-label">Accounts</p>
              <p className="discord-profile-meta-value">
                {result.accounts.records.length} record(s)
              </p>
            </div>
            <div>
              <p className="discord-profile-meta-label">Bans</p>
              <p className="discord-profile-meta-value">
                {result.bans.records.length} record(s)
              </p>
            </div>
            {result.profile ? (
              <div>
                <p className="discord-profile-meta-label">Discord created</p>
                <p className="discord-profile-meta-value">
                  {formatDiscordCreatedAt(result.profile.createdAt)}
                </p>
              </div>
            ) : null}
          </div>
        </aside>

        <section className="discord-profile-main">
          <div className="discord-profile-tabs">
            <button
              className={`discord-profile-tab ${tab === "accounts" ? "discord-profile-tab--active" : ""}`}
              type="button"
              onClick={() => setTab("accounts")}
            >
              Accounts
              {result.accounts.records.length > 0 ? (
                <span className="discord-profile-tab-count">
                  {result.accounts.records.length}
                </span>
              ) : null}
            </button>
            <button
              className={`discord-profile-tab ${tab === "bans" ? "discord-profile-tab--active" : ""}`}
              type="button"
              onClick={() => setTab("bans")}
            >
              Bans
              {result.bans.records.length > 0 ? (
                <span className="discord-profile-tab-count">
                  {result.bans.records.length}
                </span>
              ) : null}
            </button>
            {result.profile ? (
              <button
                className={`discord-profile-tab ${tab === "profile" ? "discord-profile-tab--active" : ""}`}
                type="button"
                onClick={() => setTab("profile")}
              >
                Discord
              </button>
            ) : null}
          </div>

          {tab === "accounts" ? (
            <SectionPanel
              blurResults={blurResults}
              emptyMessage="No linked FiveM accounts returned for this Discord ID."
              error={result.accounts.error}
              records={result.accounts.records}
              selectedExportIndex={selectedExportIndex}
              subtitle="Linked FiveM accounts"
              title="FiveM accounts"
              onSelectExportIndex={onSelectExportIndex}
            />
          ) : tab === "bans" ? (
            <SectionPanel
              blurResults={blurResults}
              emptyMessage="No FiveM ban records returned for this Discord ID."
              error={result.bans.error}
              records={result.bans.records}
              selectedExportIndex={selectedExportIndex}
              subtitle="Ban history"
              title="FiveM bans"
              onSelectExportIndex={onSelectExportIndex}
            />
          ) : result.profile ? (
            <div className="discord-profile-panel">
              <div
                className="discord-profile-highlight"
                style={{ "--discord-accent": accent } as React.CSSProperties}
              >
                <div className="discord-profile-highlight-icon">
                  <Shield className="size-5" />
                </div>
                <div>
                  <p className="discord-profile-highlight-title">
                    Linked Discord profile
                  </p>
                  <p className="discord-profile-highlight-sub">
                    @{result.profile.username} · {result.profile.id}
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
