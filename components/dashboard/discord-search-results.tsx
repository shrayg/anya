"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ExternalLink, Shield } from "lucide-react";
import clsx from "clsx";

import { ResultsBlurNotice } from "@/components/results-blur-notice";
import { BlurredValue } from "@/components/dashboard/blurred-value";
import { SearchEmptyState } from "@/components/dashboard/search-empty-state";
import { resolveDiscordBadges } from "@/lib/discord-badges";
import {
  formatDiscordCreatedAtExact,
  formatDiscordMemberSince,
  profileAccent,
  type DiscordSearchResult,
} from "@/lib/discord-profile";
import { formatSearchRecords, type FormattedRecord } from "@/lib/search-utils";

type DiscordTab = "intel" | "leaks" | "fivem";

const LEAK_PAGE_SIZE = 5;
const LEAK_VALUE_PREVIEW = 72;

function DiscordLeakRecords({
  records,
  blurResults = false,
  totalCount,
}: {
  records: FormattedRecord[];
  blurResults?: boolean;
  totalCount?: number;
}) {
  const [expanded, setExpanded] = useState<Set<number> | null>(null);
  const [visibleCount, setVisibleCount] = useState(LEAK_PAGE_SIZE);

  if (records.length === 0) {
    return (
      <SearchEmptyState
        className="anya-search-empty--inset"
        detail="No leak records found for this Discord ID."
      />
    );
  }

  const shown = records.length;
  const total = totalCount ?? shown;
  const visibleRecords = records.slice(0, visibleCount);
  const hiddenCount = Math.max(0, records.length - visibleCount);

  const isRowExpanded = (index: number) =>
    expanded === null || expanded.has(index);

  const toggleExpanded = (index: number) => {
    setExpanded((current) => {
      if (current === null) {
        const next = new Set(visibleRecords.map((record) => record.index));
        next.delete(index);
        return next;
      }

      const next = new Set(current);

      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }

      return next;
    });
  };

  const anyExpanded =
    expanded === null || visibleRecords.some((record) => expanded.has(record.index));

  return (
    <div className="discord-leak-wrap">
      <div className="discord-leak-toolbar">
        <p className="discord-leak-meta">
          <span className="discord-leak-meta-pill">
            {shown} record{shown === 1 ? "" : "s"}
          </span>
          <span className="discord-leak-meta-detail">
            {total > shown ? `${total} total in index` : "Breach & stealer matches"}
          </span>
        </p>
        {anyExpanded ? (
          <button
            className="discord-leak-action"
            onClick={() => setExpanded(new Set())}
            type="button"
          >
            Collapse all
          </button>
        ) : (
          <button
            className="discord-leak-action"
            onClick={() => setExpanded(null)}
            type="button"
          >
            Expand all
          </button>
        )}
      </div>

      <div className="discord-leak-list">
        {visibleRecords.map((record) => {
          const isExpanded = isRowExpanded(record.index);
          const fields = record.fields;

          return (
            <article
              key={`${record.index}-${record.badge ?? record.title}`}
              className={clsx(
                "discord-leak-row",
                isExpanded && "discord-leak-row--expanded",
              )}
            >
              <header className="discord-leak-row-head">
                <span className="discord-leak-source">
                  {record.badge ?? record.subtitle ?? record.title}
                </span>
                <div className="flex items-center gap-2">
                  <span className="discord-leak-index">#{record.index}</span>
                  <button
                    aria-expanded={isExpanded}
                    aria-label={isExpanded ? "Collapse record" : "Expand record"}
                    className={clsx(
                      "discord-leak-expand",
                      isExpanded && "discord-leak-expand--open",
                    )}
                    onClick={() => toggleExpanded(record.index)}
                    type="button"
                  >
                    <ChevronDown className="size-3.5" />
                  </button>
                </div>
              </header>

              {!isExpanded ? null : (
                <div className="discord-leak-fields">
                  {fields.map((field) => (
                    <div
                      key={`${record.index}-${field.key}`}
                      className={clsx(
                        "discord-leak-field",
                        field.sensitive && "discord-leak-field--sensitive",
                      )}
                    >
                      <span className="discord-leak-label">{field.label}</span>
                      <span
                        className={clsx(
                          "discord-leak-value",
                          field.highlight && "discord-leak-value--accent",
                        )}
                        title={
                          field.value.length > LEAK_VALUE_PREVIEW
                            ? field.value
                            : undefined
                        }
                      >
                        <BlurredValue forceBlur={blurResults} text={field.value} />
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </div>

      {hiddenCount > 0 ? (
        <button
          className="discord-leak-action discord-leak-action--center"
          onClick={() => setVisibleCount((count) => count + LEAK_PAGE_SIZE)}
          type="button"
        >
          Show {Math.min(LEAK_PAGE_SIZE, hiddenCount)} more record
          {Math.min(LEAK_PAGE_SIZE, hiddenCount) === 1 ? "" : "s"}
        </button>
      ) : null}
    </div>
  );
}

function IntelStat({
  label,
  value,
  accent,
  blurResults = false,
}: {
  label: string;
  value: string;
  accent: string;
  blurResults?: boolean;
}) {
  return (
    <div className="discord-intel-stat" style={{ "--discord-accent": accent } as React.CSSProperties}>
      <p className="discord-intel-stat-label">{label}</p>
      <p className="discord-intel-stat-value">
        <BlurredValue forceBlur={blurResults} text={value} />
      </p>
    </div>
  );
}

export function DiscordSearchResults({
  result,
  blurResults = false,
}: {
  result: DiscordSearchResult;
  blurResults?: boolean;
}) {
  const { profile, leaks, fivem } = result;
  const hasFivem = Boolean(fivem?.accounts || fivem?.bans);
  const [tab, setTab] = useState<DiscordTab>("intel");
  const accent = profileAccent(profile);
  const badges = useMemo(
    () => resolveDiscordBadges(profile.badges),
    [profile.badges],
  );
  const leakRecords = useMemo(
    () => formatSearchRecords(leaks.results),
    [leaks.results],
  );

  const handleTag =
    profile.discriminator !== "0"
      ? `${profile.username}#${profile.discriminator}`
      : profile.username;

  return (
    <div className="discord-profile-shell">
      {profile.bannerUrl ? (
        <div
          className="discord-profile-banner"
          style={{ backgroundImage: `url(${profile.bannerUrl})` }}
        />
      ) : (
        <div
          className="discord-profile-banner discord-profile-banner--solid"
          style={{ backgroundColor: accent }}
        />
      )}

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
              <img
                alt={`${profile.displayName} avatar`}
                className="discord-profile-avatar"
                src={profile.avatarUrl}
              />
              {profile.avatarDecorationUrl ? (
                <img
                  alt=""
                  aria-hidden
                  className="discord-profile-avatar-decoration"
                  src={profile.avatarDecorationUrl}
                />
              ) : null}
            </div>
          </div>

          <div className="discord-profile-identity">
            <h3 className="discord-profile-name">
              <BlurredValue forceBlur={blurResults} text={profile.displayName} />
              {profile.clanTag ? (
                <span className="discord-profile-clan">
                  [
                  <BlurredValue forceBlur={blurResults} text={profile.clanTag} />
                  ]
                </span>
              ) : null}
            </h3>
            <p className="discord-profile-handle">
              <BlurredValue
                forceBlur={blurResults}
                text={
                  profile.globalName && profile.globalName !== profile.username
                    ? `${profile.globalName} · @${profile.username}`
                    : `@${handleTag}`
                }
              />
            </p>
          </div>

          {badges.length > 0 ? (
            <div className="discord-profile-badges" aria-label="Badges">
              {badges.map((badge) => (
                <span
                  key={badge.key}
                  className="discord-profile-badge"
                  style={
                    {
                      "--badge-color": badge.color,
                      "--badge-glow": badge.glow,
                    } as React.CSSProperties
                  }
                  title={badge.label}
                >
                  {badge.short}
                </span>
              ))}
            </div>
          ) : null}

          <div className="discord-profile-meta">
            <div>
              <p className="discord-profile-meta-label">Created (exact)</p>
              <p className="discord-profile-meta-value">
                <BlurredValue
                  forceBlur={blurResults}
                  text={formatDiscordCreatedAtExact(profile.createdAt)}
                />
              </p>
            </div>
            <div>
              <p className="discord-profile-meta-label">Member since</p>
              <p className="discord-profile-meta-value">
                <BlurredValue
                  forceBlur={blurResults}
                  text={formatDiscordMemberSince(profile.createdAt)}
                />
              </p>
            </div>
            <div>
              <p className="discord-profile-meta-label">Nitro</p>
              <p className="discord-profile-meta-value">
                <BlurredValue
                  forceBlur={blurResults}
                  text={profile.nitro ? "Yes" : "No"}
                />
              </p>
            </div>
            <div>
              <p className="discord-profile-meta-label">Clan tag</p>
              <p className="discord-profile-meta-value">
                <BlurredValue
                  forceBlur={blurResults}
                  text={profile.clanTag ? `[${profile.clanTag}]` : "—"}
                />
              </p>
            </div>
            <div>
              <p className="discord-profile-meta-label">User ID</p>
              <p className="discord-profile-meta-value discord-profile-meta-value--mono">
                <BlurredValue forceBlur={blurResults} text={profile.id} />
              </p>
            </div>
            {profile.accentColor ? (
              <div>
                <p className="discord-profile-meta-label">Accent</p>
                <p className="discord-profile-meta-value discord-profile-accent-row">
                  <span
                    className="discord-profile-accent-swatch"
                    style={{ backgroundColor: profile.accentColor }}
                  />
                  <BlurredValue forceBlur={blurResults} text={profile.accentColor} />
                </p>
              </div>
            ) : null}
          </div>

          {profile.bio ? (
            <div className="discord-profile-note">
              <p className="discord-profile-meta-label">About Me</p>
              <p className="discord-profile-note-text">
                <BlurredValue forceBlur={blurResults} text={profile.bio} />
              </p>
            </div>
          ) : null}

          <div className="discord-profile-actions">
            <a
              className="discord-profile-link"
              href={`https://discord.com/users/${profile.id}`}
              rel="noreferrer"
              target="_blank"
            >
              <ExternalLink className="size-3.5" />
              Open on Discord
            </a>
            <a
              className="discord-profile-link"
              href={profile.profilePreviewUrl}
              rel="noreferrer"
              target="_blank"
            >
              <ExternalLink className="size-3.5" />
              Profile preview
            </a>
          </div>
        </aside>

        <section className="discord-profile-main">
          <div className="discord-profile-tabs">
            <button
              className={`discord-profile-tab ${tab === "intel" ? "discord-profile-tab--active" : ""}`}
              onClick={() => setTab("intel")}
              type="button"
            >
              Intel
            </button>
            <button
              className={`discord-profile-tab ${tab === "leaks" ? "discord-profile-tab--active" : ""}`}
              onClick={() => setTab("leaks")}
              type="button"
            >
              Leaks
              {leaks.count > 0 ? (
                <span className="discord-profile-tab-count">{leaks.count}</span>
              ) : null}
            </button>
            {hasFivem ? (
              <button
                className={`discord-profile-tab ${tab === "fivem" ? "discord-profile-tab--active" : ""}`}
                onClick={() => setTab("fivem")}
                type="button"
              >
                FiveM
              </button>
            ) : null}
          </div>

          {tab === "intel" ? (
            <div className="discord-profile-panel">
              <div
                className="discord-profile-highlight"
                style={{ "--discord-accent": accent } as React.CSSProperties}
              >
                <div className="discord-profile-highlight-icon">
                  <Shield className="size-5" />
                </div>
                <div>
                  <p className="discord-profile-highlight-title">Live profile resolved</p>
                  <p className="discord-profile-highlight-sub">
                    Avatar, banner, badges, Nitro, clan tag, and exact snowflake creation time.
                  </p>
                </div>
              </div>

              <div className="discord-intel-grid">
                <IntelStat accent={accent} blurResults={blurResults} label="Display name" value={profile.displayName} />
                <IntelStat accent={accent} blurResults={blurResults} label="Username" value={handleTag} />
                <IntelStat
                  accent={accent}
                  blurResults={blurResults}
                  label="Global name"
                  value={profile.globalName ?? "—"}
                />
                <IntelStat accent={accent} blurResults={blurResults} label="Snowflake ID" value={profile.id} />
                <IntelStat
                  accent={accent}
                  blurResults={blurResults}
                  label="Account created"
                  value={formatDiscordCreatedAtExact(profile.createdAt)}
                />
                <IntelStat
                  accent={accent}
                  blurResults={blurResults}
                  label="Nitro"
                  value={profile.nitro ? "Yes" : "No"}
                />
                <IntelStat
                  accent={accent}
                  blurResults={blurResults}
                  label="Clan tag"
                  value={profile.clanTag ? `[${profile.clanTag}]` : "—"}
                />
                <IntelStat
                  accent={accent}
                  blurResults={blurResults}
                  label="Badges"
                  value={
                    badges.length > 0
                      ? badges.map((badge) => badge.label).join(", ")
                      : "None"
                  }
                />
                <IntelStat
                  accent={accent}
                  blurResults={blurResults}
                  label="Indexed leaks"
                  value={leaks.count > 0 ? `${leaks.count} record(s)` : "None found"}
                />
              </div>
            </div>
          ) : tab === "fivem" ? (
            <div className="discord-profile-panel">
              <div className="discord-profile-panel-head">
                <h4 className="discord-profile-panel-title">FiveM intelligence</h4>
                <p className="discord-profile-panel-sub">
                  Linked accounts and ban records
                </p>
              </div>
              <pre className="discord-profile-empty overflow-x-auto whitespace-pre-wrap text-left text-xs text-zinc-300">
                <BlurredValue forceBlur={blurResults} text={JSON.stringify(fivem, null, 2)} />
              </pre>
            </div>
          ) : (
            <div className="discord-profile-panel">
              <div className="discord-profile-panel-head discord-profile-panel-head--compact">
                <h4 className="discord-profile-panel-title">Leak database</h4>
                {leaks.count > 0 ? (
                  <span className="discord-profile-panel-count">
                    {leaks.count} hit{leaks.count === 1 ? "" : "s"}
                  </span>
                ) : null}
              </div>

              <DiscordLeakRecords
                blurResults={blurResults}
                records={leakRecords}
                totalCount={leaks.count}
              />
            </div>
          )}
        </section>
      </div>

      {blurResults ? <ResultsBlurNotice /> : null}
    </div>
  );
}
