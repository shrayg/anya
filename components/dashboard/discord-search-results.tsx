"use client";

import { useMemo, useState } from "react";
import {
  Calendar,
  ChevronDown,
  Copy,
  Download,
  EyeOff,
  ExternalLink,
  Gamepad2,
  Hash,
  Scale,
  Shield,
  TriangleAlert,
} from "lucide-react";
import clsx from "clsx";

import { ResultsBlurNotice } from "@/components/results-blur-notice";
import { BlurredValue } from "@/components/dashboard/blurred-value";
import { SearchEmptyState } from "@/components/dashboard/search-empty-state";
import { resolveDiscordBadges } from "@/lib/discord-badges";
import {
  formatDiscordCreatedAtExact,
  formatDsaDate,
  profileAccent,
  type DiscordDsaSanction,
  type DiscordSearchResult,
} from "@/lib/discord-profile";
import { formatSearchRecords, type FormattedRecord } from "@/lib/search-utils";

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
    expanded === null ||
    visibleRecords.some((record) => expanded.has(record.index));

  return (
    <div className="discord-leak-wrap">
      <div className="discord-leak-toolbar">
        <p className="discord-leak-meta">
          <span className="discord-leak-meta-pill">
            {shown} record{shown === 1 ? "" : "s"}
          </span>
          <span className="discord-leak-meta-detail">
            {total > shown
              ? `${total} total in index`
              : "Breach & stealer matches"}
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

function SummaryCard({
  label,
  count,
  tone,
  icon,
}: {
  label: string;
  count: number;
  tone: "breach" | "fivem" | "dsa";
  icon: React.ReactNode;
}) {
  return (
    <div className={clsx("discord-id-stat", `discord-id-stat--${tone}`)}>
      <span className="discord-id-stat-icon" aria-hidden>
        {icon}
      </span>
      <div className="discord-id-stat-copy">
        <p className="discord-id-stat-label">{label}</p>
        <p className="discord-id-stat-count">{count}</p>
      </div>
    </div>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      aria-label={copied ? "Copied" : "Copy Discord ID"}
      className="discord-id-copy"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1400);
        } catch {
          /* ignore */
        }
      }}
      type="button"
    >
      <Copy className="size-3.5" />
    </button>
  );
}

function DownloadButton({
  href,
  label,
  disabled,
}: {
  href: string | null | undefined;
  label: string;
  disabled?: boolean;
}) {
  if (!href || disabled) {
    return (
      <span className="discord-id-dl discord-id-dl--disabled" aria-disabled>
        <Download className="size-3.5" />
        {label}
      </span>
    );
  }

  return (
    <a
      className="discord-id-dl"
      download
      href={href}
      rel="noreferrer"
      target="_blank"
    >
      <Download className="size-3.5" />
      {label}
    </a>
  );
}

function DsaSanctionRow({
  sanction,
  blurResults,
}: {
  sanction: DiscordDsaSanction;
  blurResults: boolean;
}) {
  const [open, setOpen] = useState(true);

  return (
    <article className={clsx("discord-id-dsa-row", open && "discord-id-dsa-row--open")}>
      <button
        aria-expanded={open}
        className="discord-id-dsa-row-toggle"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <span className="discord-id-dsa-warn" aria-hidden>
          <TriangleAlert className="size-4" />
        </span>
        <span className="discord-id-dsa-row-main">
          <span className="discord-id-dsa-severity">
            <BlurredValue forceBlur={blurResults} text={sanction.severity} />
          </span>
          <span className="discord-id-dsa-status">{sanction.status}</span>
          {open ? (
            <>
              <span className="discord-id-dsa-desc">
                <BlurredValue forceBlur={blurResults} text={sanction.description} />
              </span>
              <span className="discord-id-dsa-date">{formatDsaDate(sanction.date)}</span>
            </>
          ) : null}
        </span>
        <ChevronDown
          className={clsx(
            "discord-id-dsa-chevron size-4",
            open && "discord-id-dsa-chevron--open",
          )}
        />
      </button>
    </article>
  );
}

export function DiscordSearchResults({
  result,
  blurResults = false,
}: {
  result: DiscordSearchResult;
  blurResults?: boolean;
}) {
  const { profile, leaks, fivem, dsa } = result;
  const accent = profileAccent(profile);
  const [bannerHidden, setBannerHidden] = useState(false);
  const [showLeaks, setShowLeaks] = useState(false);

  const badges = useMemo(
    () => resolveDiscordBadges(profile.badges),
    [profile.badges],
  );
  const leakRecords = useMemo(
    () => formatSearchRecords(leaks.results),
    [leaks.results],
  );

  const fivemCount = fivem?.count ?? 0;
  const dsaCount = dsa?.count ?? 0;
  const sanctions = dsa?.sanctions ?? [];

  return (
    <div className="discord-id-shell">
      <div className="discord-id-stats">
        <button
          className="discord-id-stat-btn"
          onClick={() => setShowLeaks((value) => !value)}
          type="button"
        >
          <SummaryCard
            count={leaks.count}
            icon={<Shield className="size-4" />}
            label="Breaches"
            tone="breach"
          />
        </button>
        <SummaryCard
          count={fivemCount}
          icon={<Gamepad2 className="size-4" />}
          label="FiveM records"
          tone="fivem"
        />
        <SummaryCard
          count={dsaCount}
          icon={<Scale className="size-4" />}
          label="DSA sanctions"
          tone="dsa"
        />
      </div>

      <div className="discord-id-layout">
        <article
          className="discord-id-profile"
          style={{ "--discord-accent": accent } as React.CSSProperties}
        >
          <div className="discord-id-banner-wrap">
            {profile.bannerUrl && !bannerHidden ? (
              <div
                className="discord-id-banner"
                style={{ backgroundImage: `url(${profile.bannerUrl})` }}
              />
            ) : (
              <div
                className="discord-id-banner discord-id-banner--solid"
                style={{ backgroundColor: accent }}
              />
            )}
            <div className="discord-id-banner-actions">
              <button
                aria-label={bannerHidden ? "Show banner" : "Hide banner"}
                className="discord-id-banner-btn"
                onClick={() => setBannerHidden((value) => !value)}
                type="button"
              >
                <EyeOff className="size-3.5" />
              </button>
              {profile.bannerUrl ? (
                <a
                  aria-label="Download banner"
                  className="discord-id-banner-btn"
                  download
                  href={profile.bannerUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  <Download className="size-3.5" />
                </a>
              ) : null}
              <a
                aria-label="Open Discord profile"
                className="discord-id-banner-btn"
                href={`https://discord.com/users/${profile.id}`}
                rel="noreferrer"
                target="_blank"
              >
                <ExternalLink className="size-3.5" />
              </a>
            </div>
          </div>

          <div className="discord-id-avatar-wrap">
            <div className="discord-id-avatar-ring">
              <img
                alt={`${profile.displayName} avatar`}
                className="discord-id-avatar"
                src={profile.avatarUrl}
              />
              {profile.avatarDecorationUrl ? (
                <img
                  alt=""
                  aria-hidden
                  className="discord-id-avatar-decoration"
                  src={profile.avatarDecorationUrl}
                />
              ) : null}
            </div>
          </div>

          <div className="discord-id-identity">
            <h3 className="discord-id-name">
              <BlurredValue forceBlur={blurResults} text={profile.displayName} />
              {profile.clanTag ? (
                <span className="discord-id-clan">
                  {profile.clanBadgeUrl ? (
                    <img
                      alt=""
                      aria-hidden
                      className="discord-id-clan-badge"
                      src={profile.clanBadgeUrl}
                    />
                  ) : null}
                  <BlurredValue forceBlur={blurResults} text={profile.clanTag} />
                </span>
              ) : null}
              {profile.nitro ? (
                <span className="discord-id-nitro" title="Nitro">
                  N
                </span>
              ) : null}
            </h3>
            <p className="discord-id-handle">
              <BlurredValue
                forceBlur={blurResults}
                text={`@${profile.username}`}
              />
            </p>
          </div>

          {profile.nameplate ? (
            <div className="discord-id-nameplate">
              <span className="discord-id-nameplate-tag">Nameplate</span>
              <div
                className="discord-id-nameplate-art"
                style={{ backgroundImage: `url(${profile.nameplate.url})` }}
              >
                {profile.nameplate.description ? (
                  <p className="discord-id-nameplate-desc">
                    <BlurredValue
                      forceBlur={blurResults}
                      text={profile.nameplate.description}
                    />
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          {badges.length > 0 ? (
            <div className="discord-id-badges" aria-label="Badges">
              {badges.map((badge) => (
                <span
                  key={badge.key}
                  className="discord-id-badge"
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

          <div className="discord-id-fields">
            <div className="discord-id-field">
              <span className="discord-id-field-icon" aria-hidden>
                <Hash className="size-3.5" />
              </span>
              <div className="discord-id-field-body">
                <p className="discord-id-field-label">Discord ID</p>
                <p className="discord-id-field-value discord-id-field-value--mono">
                  <BlurredValue forceBlur={blurResults} text={profile.id} />
                </p>
              </div>
              {!blurResults ? <CopyButton value={profile.id} /> : null}
            </div>

            <div className="discord-id-field">
              <span className="discord-id-field-icon" aria-hidden>
                <Calendar className="size-3.5" />
              </span>
              <div className="discord-id-field-body">
                <p className="discord-id-field-label">Account created</p>
                <p className="discord-id-field-value">
                  <BlurredValue
                    forceBlur={blurResults}
                    text={formatDiscordCreatedAtExact(profile.createdAt)}
                  />
                </p>
              </div>
            </div>
          </div>

          <div className="discord-id-downloads">
            <p className="discord-id-downloads-label">Downloads</p>
            <div className="discord-id-downloads-row">
              <DownloadButton href={profile.avatarUrl} label="Avatar" />
              <DownloadButton href={profile.bannerUrl} label="Banner" />
              <DownloadButton
                href={profile.avatarDecorationUrl}
                label="Decoration"
              />
              <DownloadButton href={profile.nameplate?.url} label="Nameplate" />
            </div>
          </div>
        </article>

        <aside className="discord-id-dsa">
          <header className="discord-id-dsa-head">
            <span className="discord-id-dsa-head-icon" aria-hidden>
              <Scale className="size-4" />
            </span>
            <div className="discord-id-dsa-head-copy">
              <h4 className="discord-id-dsa-title">DSA Sanctions</h4>
              <p className="discord-id-dsa-sub">
                EU Digital Services Act database
              </p>
            </div>
            <span className="discord-id-dsa-count">
              {dsaCount} {dsaCount === 1 ? "entry" : "entries"}
            </span>
          </header>

          {sanctions.length === 0 ? (
            <p className="discord-id-dsa-empty">
              No DSA sanctions found for this Discord ID.
            </p>
          ) : (
            <div className="discord-id-dsa-list">
              {sanctions.map((sanction) => (
                <DsaSanctionRow
                  key={sanction.id}
                  blurResults={blurResults}
                  sanction={sanction}
                />
              ))}
            </div>
          )}
        </aside>
      </div>

      {showLeaks || leaks.count > 0 ? (
        <section className="discord-id-leaks">
          <button
            className="discord-id-leaks-toggle"
            onClick={() => setShowLeaks((value) => !value)}
            type="button"
          >
            <span>
              Breach records
              {leaks.count > 0 ? (
                <span className="discord-id-leaks-count">{leaks.count}</span>
              ) : null}
            </span>
            <ChevronDown
              className={clsx(
                "size-4 transition-transform",
                showLeaks && "rotate-180",
              )}
            />
          </button>
          {showLeaks ? (
            <DiscordLeakRecords
              blurResults={blurResults}
              records={leakRecords}
              totalCount={leaks.count}
            />
          ) : null}
        </section>
      ) : null}

      {blurResults ? <ResultsBlurNotice /> : null}
    </div>
  );
}
