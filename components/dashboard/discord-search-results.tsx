"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  Copy,
  Download,
  ExternalLink,
  Gamepad2,
  Link2,
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
  formatDiscordMemberSince,
  formatDsaDate,
  profileAccent,
  type DiscordDsaSanction,
  type DiscordNameplate,
  type DiscordRobloxLink,
  type DiscordSearchResult,
} from "@/lib/discord-profile";
import { formatSearchRecords, type FormattedRecord } from "@/lib/search-utils";

const LEAK_PAGE_SIZE = 5;
const LEAK_VALUE_PREVIEW = 72;

type DataTab = "breaches" | "roblox" | "dsa" | "fivem";

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return reduced;
}

function classifyNameplateMedia(url: string): "video" | "image" {
  if (/\.(webm|mp4|ogg)(\?|$)/i.test(url)) return "video";
  return "image";
}

const NAMEPLATE_PALETTE_BG: Record<string, string> = {
  crimson: "#9e1d2e",
  berry: "#9b2f6c",
  sky: "#3a8fd4",
  teal: "#1f8a7a",
  forest: "#2f6b3a",
  bubble_gum: "#d45a8a",
  violet: "#6b4bb5",
  cobalt: "#2f5fad",
  clover: "#5a9e3c",
  lemon: "#c4a52a",
  white: "#d4d4d8",
};

function DiscordNameplateArt({
  nameplate,
  blurResults,
}: {
  nameplate: DiscordNameplate;
  blurResults: boolean;
}) {
  const reducedMotion = usePrefersReducedMotion();
  /** 0 = try webm video, 1 = APNG img.png, 2 = static still */
  const [tier, setTier] = useState<0 | 1 | 2>(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    setTier(0);
  }, [nameplate.animatedUrl, nameplate.animatedImageUrl, nameplate.url]);

  const videoSrc =
    !reducedMotion && tier === 0 ? nameplate.animatedUrl : null;
  const apngSrc =
    !reducedMotion && tier <= 1
      ? nameplate.animatedImageUrl
      : null;
  const mediaSrc = videoSrc ?? apngSrc ?? nameplate.url;
  const mediaKind = videoSrc
    ? "video"
    : classifyNameplateMedia(mediaSrc);

  useEffect(() => {
    if (mediaKind !== "video" || !videoRef.current || !videoSrc) return;
    const el = videoRef.current;
    el.muted = true;
    el.playsInline = true;
    void el.play().catch(() => {
      /* muted autoplay usually succeeds; APNG fallback is via onError only */
    });
  }, [mediaKind, videoSrc]);

  const paletteBg =
    (nameplate.palette && NAMEPLATE_PALETTE_BG[nameplate.palette]) ||
    undefined;

  return (
    <div
      className="discord-id-nameplate-art"
      style={paletteBg ? { backgroundColor: paletteBg } : undefined}
    >
      {mediaKind === "video" && videoSrc ? (
        <video
          key={videoSrc}
          ref={videoRef}
          aria-hidden
          autoPlay
          className="discord-id-nameplate-media"
          disablePictureInPicture
          disableRemotePlayback
          loop
          muted
          onError={() => setTier(1)}
          playsInline
          poster={nameplate.url}
          preload="auto"
        >
          <source src={videoSrc} type="video/webm" />
        </video>
      ) : (
        <img
          key={mediaSrc}
          alt=""
          aria-hidden
          className="discord-id-nameplate-media"
          onError={() => {
            if (tier < 2) setTier(2);
          }}
          src={mediaSrc}
        />
      )}
      {nameplate.description ? (
        <p className="discord-id-nameplate-desc">
          <BlurredValue
            forceBlur={blurResults}
            text={nameplate.description}
          />
        </p>
      ) : null}
    </div>
  );
}

function DiscordLeakRecords({
  records,
  blurResults = false,
  totalCount,
  emptyDetail = "No leak records found for this Discord ID.",
  metaDetail = "Breach & stealer matches",
}: {
  records: FormattedRecord[];
  blurResults?: boolean;
  totalCount?: number;
  emptyDetail?: string;
  metaDetail?: string;
}) {
  const [expanded, setExpanded] = useState<Set<number> | null>(null);
  const [visibleCount, setVisibleCount] = useState(LEAK_PAGE_SIZE);

  if (records.length === 0) {
    return (
      <SearchEmptyState
        className="anya-search-empty--inset"
        detail={emptyDetail}
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
            {total > shown ? `${total} total in index` : metaDetail}
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
  active,
}: {
  label: string;
  count: number;
  tone: "breach" | "fivem" | "dsa" | "roblox";
  icon: React.ReactNode;
  active?: boolean;
}) {
  return (
    <div
      className={clsx(
        "discord-id-stat",
        `discord-id-stat--${tone}`,
        active && "discord-id-stat--active",
      )}
    >
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

function RobloxBlock({
  link,
  blurResults,
}: {
  link: DiscordRobloxLink | null | undefined;
  blurResults: boolean;
}) {
  const hasLink = Boolean(
    link && (link.username || link.userId || link.profileUrl),
  );

  if (!hasLink || !link) {
    return (
      <p className="discord-id-dsa-empty">No Roblox account linked to this Discord ID.</p>
    );
  }

  return (
    <div className="discord-id-roblox-card">
      <div className="discord-id-roblox-fields">
        {link.username ? (
          <div className="discord-id-roblox-field">
            <span className="discord-id-field-label">Username</span>
            <p className="discord-id-field-value">
              <BlurredValue forceBlur={blurResults} text={link.username} />
            </p>
          </div>
        ) : null}
        {link.userId ? (
          <div className="discord-id-roblox-field">
            <span className="discord-id-field-label">User ID</span>
            <p className="discord-id-field-value discord-id-field-value--mono">
              <BlurredValue forceBlur={blurResults} text={link.userId} />
            </p>
          </div>
        ) : null}
      </div>
      {link.profileUrl && !blurResults ? (
        <a
          className="discord-id-roblox-link"
          href={link.profileUrl}
          rel="noreferrer"
          target="_blank"
        >
          Open Roblox profile
          <ExternalLink className="size-3.5" />
        </a>
      ) : null}
    </div>
  );
}

function DsaBlock({
  sanctions,
  blurResults,
}: {
  sanctions: DiscordDsaSanction[];
  blurResults: boolean;
}) {
  if (sanctions.length === 0) {
    return (
      <p className="discord-id-dsa-empty">
        No DSA sanctions found for this Discord ID.
      </p>
    );
  }

  return (
    <div className="discord-id-dsa-list">
      {sanctions.map((sanction) => (
        <DsaSanctionRow
          key={sanction.id}
          blurResults={blurResults}
          sanction={sanction}
        />
      ))}
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
  const { profile, leaks, fivem, dsa, robloxLink } = result;
  const accent = profileAccent(profile);
  const [dataTab, setDataTab] = useState<DataTab>(() =>
    leaks.count > 0
      ? "breaches"
      : robloxLink
        ? "roblox"
        : (dsa?.count ?? 0) > 0
          ? "dsa"
          : (fivem?.count ?? 0) > 0
            ? "fivem"
            : "breaches",
  );
  const [assetsOpen, setAssetsOpen] = useState(false);

  const badges = useMemo(
    () => resolveDiscordBadges(profile.badges),
    [profile.badges],
  );
  const leakRecords = useMemo(
    () => formatSearchRecords(leaks.results),
    [leaks.results],
  );
  const fivemRecords = useMemo(
    () => formatSearchRecords(fivem?.accounts ?? []),
    [fivem?.accounts],
  );

  const fivemCount = fivem?.count ?? 0;
  const dsaCount = dsa?.count ?? 0;
  const sanctions = dsa?.sanctions ?? [];
  const robloxLinked = Boolean(
    robloxLink &&
      (robloxLink.username || robloxLink.userId || robloxLink.profileUrl),
  );
  const memberSince = formatDiscordMemberSince(profile.createdAt);
  const handleLine = profile.username;

  return (
    <div className="discord-id-shell">
      <div className="discord-id-stats">
        <button
          aria-pressed={dataTab === "breaches"}
          className="discord-id-stat-btn"
          onClick={() => setDataTab("breaches")}
          type="button"
        >
          <SummaryCard
            active={dataTab === "breaches"}
            count={leaks.count}
            icon={<Shield className="size-4" />}
            label="Breaches"
            tone="breach"
          />
        </button>
        <button
          aria-pressed={dataTab === "roblox"}
          className="discord-id-stat-btn"
          onClick={() => setDataTab("roblox")}
          type="button"
        >
          <SummaryCard
            active={dataTab === "roblox"}
            count={robloxLinked ? 1 : 0}
            icon={<Link2 className="size-4" />}
            label="Roblox linked"
            tone="roblox"
          />
        </button>
        <button
          aria-pressed={dataTab === "dsa"}
          className="discord-id-stat-btn"
          onClick={() => setDataTab("dsa")}
          type="button"
        >
          <SummaryCard
            active={dataTab === "dsa"}
            count={dsaCount}
            icon={<Scale className="size-4" />}
            label="DSA sanctions"
            tone="dsa"
          />
        </button>
        <button
          aria-pressed={dataTab === "fivem"}
          className="discord-id-stat-btn"
          onClick={() => setDataTab("fivem")}
          type="button"
        >
          <SummaryCard
            active={dataTab === "fivem"}
            count={fivemCount}
            icon={<Gamepad2 className="size-4" />}
            label="FiveM records"
            tone="fivem"
          />
        </button>
      </div>

      <div className="discord-id-layout">
        <div className="discord-id-col-left">
          <article
            className="discord-id-profile discord-id-profile--popout"
            style={{ "--discord-accent": accent } as React.CSSProperties}
          >
            <div className="discord-id-banner-wrap">
              {profile.bannerUrl ? (
                <img
                  alt=""
                  className="discord-id-banner"
                  src={profile.bannerUrl}
                />
              ) : (
                <div
                  className="discord-id-banner discord-id-banner--solid"
                  style={{ backgroundColor: accent }}
                />
              )}
              <div className="discord-id-banner-actions">
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

            <div className="discord-id-popout-body">
              <div className="discord-id-popout-card">
                <h3 className="discord-id-name">
                  <BlurredValue forceBlur={blurResults} text={profile.displayName} />
                </h3>

                <div className="discord-id-handle-row">
                  <p className="discord-id-handle">
                    <BlurredValue forceBlur={blurResults} text={handleLine} />
                  </p>
                  {profile.clanBadgeUrl ? (
                    <img
                      alt=""
                      aria-hidden
                      className="discord-id-clan-inline"
                      src={profile.clanBadgeUrl}
                    />
                  ) : null}
                  {profile.clanTag ? (
                    <span className="discord-id-clan-tag">{profile.clanTag}</span>
                  ) : null}
                  {badges.length > 0 ? (
                    <div className="discord-id-badges discord-id-badges--inline" aria-label="Badges">
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
                </div>

                {profile.nameplate ? (
                  <div className="discord-id-nameplate discord-id-nameplate--inline">
                    <DiscordNameplateArt
                      blurResults={blurResults}
                      nameplate={profile.nameplate}
                    />
                  </div>
                ) : null}

                {profile.bio ? (
                  <div className="discord-id-section">
                    <p className="discord-id-meta-label">About Me</p>
                    <p className="discord-id-bio">
                      <BlurredValue forceBlur={blurResults} text={profile.bio} />
                    </p>
                  </div>
                ) : null}

                <div className="discord-id-meta-grid">
                  <div className="discord-id-meta-block">
                    <p className="discord-id-meta-label">Member Since</p>
                    <p className="discord-id-meta-value">
                      <BlurredValue forceBlur={blurResults} text={memberSince} />
                    </p>
                  </div>
                  <div className="discord-id-meta-block">
                    <p className="discord-id-meta-label">Discord ID</p>
                    <p className="discord-id-meta-value discord-id-meta-value--mono">
                      <BlurredValue forceBlur={blurResults} text={profile.id} />
                      {!blurResults ? <CopyButton value={profile.id} /> : null}
                    </p>
                  </div>
                </div>
              </div>

              <div className="discord-id-assets">
                <button
                  aria-expanded={assetsOpen}
                  className="discord-id-assets-toggle"
                  onClick={() => setAssetsOpen((value) => !value)}
                  type="button"
                >
                  Media downloads
                  <ChevronDown
                    className={clsx(
                      "size-3.5 transition-transform",
                      assetsOpen && "rotate-180",
                    )}
                  />
                </button>
                {assetsOpen ? (
                  <div className="discord-id-downloads-row">
                    <DownloadButton href={profile.avatarUrl} label="Avatar" />
                    <DownloadButton href={profile.bannerUrl} label="Banner" />
                    <DownloadButton
                      href={profile.avatarDecorationUrl}
                      label="Decoration"
                    />
                    <DownloadButton
                      href={
                        profile.nameplate?.animatedUrl ??
                        profile.nameplate?.animatedImageUrl ??
                        profile.nameplate?.url
                      }
                      label="Nameplate"
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </article>
        </div>

        <div className="discord-id-col-main">
          <section className="discord-id-data-panel">
            <header className="discord-id-data-head">
              <div>
                <h4 className="discord-id-data-title">Breach records</h4>
                <p className="discord-id-data-sub">
                  Leaks and linked exposure for this Discord ID
                </p>
              </div>
            </header>

            <div className="discord-id-data-tabs" role="tablist" aria-label="Linked data">
              {(
                [
                  { id: "breaches" as const, label: "Breaches", count: leaks.count },
                  {
                    id: "roblox" as const,
                    label: "Roblox",
                    count: robloxLinked ? 1 : 0,
                  },
                  { id: "dsa" as const, label: "DSA", count: dsaCount },
                  { id: "fivem" as const, label: "FiveM", count: fivemCount },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  aria-selected={dataTab === tab.id}
                  className={clsx(
                    "discord-id-data-tab",
                    dataTab === tab.id && "discord-id-data-tab--active",
                  )}
                  onClick={() => setDataTab(tab.id)}
                  role="tab"
                  type="button"
                >
                  {tab.label}
                  <span className="discord-id-data-tab-count">{tab.count}</span>
                </button>
              ))}
            </div>

            <div className="discord-id-data-body" role="tabpanel">
              {dataTab === "breaches" ? (
                <DiscordLeakRecords
                  blurResults={blurResults}
                  emptyDetail="No breach or stealer records found for this Discord ID."
                  records={leakRecords}
                  totalCount={leaks.count}
                />
              ) : null}
              {dataTab === "roblox" ? (
                <RobloxBlock blurResults={blurResults} link={robloxLink} />
              ) : null}
              {dataTab === "dsa" ? (
                <DsaBlock blurResults={blurResults} sanctions={sanctions} />
              ) : null}
              {dataTab === "fivem" ? (
                <DiscordLeakRecords
                  blurResults={blurResults}
                  emptyDetail="No FiveM accounts linked to this Discord ID."
                  metaDetail="Linked FiveM accounts"
                  records={fivemRecords}
                  totalCount={fivemCount}
                />
              ) : null}
            </div>
          </section>
        </div>
      </div>

      {blurResults ? <ResultsBlurNotice /> : null}
    </div>
  );
}
