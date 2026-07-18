"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Calendar,
  ChevronDown,
  Copy,
  Download,
  EyeOff,
  ExternalLink,
  Gamepad2,
  Hash,
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
  formatDiscordCreatedAtExact,
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

function SidePanel({
  title,
  subtitle,
  icon,
  countLabel,
  tone,
  children,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  countLabel: string;
  tone: "dsa" | "roblox";
  children: React.ReactNode;
}) {
  return (
    <aside className={clsx("discord-id-side-panel", `discord-id-side-panel--${tone}`)}>
      <header className="discord-id-dsa-head">
        <span
          className={clsx(
            "discord-id-dsa-head-icon",
            tone === "roblox" && "discord-id-dsa-head-icon--roblox",
          )}
          aria-hidden
        >
          {icon}
        </span>
        <div className="discord-id-dsa-head-copy">
          <h4 className="discord-id-dsa-title">{title}</h4>
          <p className="discord-id-dsa-sub">{subtitle}</p>
        </div>
        <span
          className={clsx(
            "discord-id-dsa-count",
            tone === "roblox" && "discord-id-dsa-count--roblox",
          )}
        >
          {countLabel}
        </span>
      </header>
      {children}
    </aside>
  );
}

function RobloxLinkPanel({
  link,
  blurResults,
}: {
  link: DiscordRobloxLink | null | undefined;
  blurResults: boolean;
}) {
  const hasLink = Boolean(
    link && (link.username || link.userId || link.profileUrl),
  );

  return (
    <SidePanel
      countLabel={hasLink ? "1 linked" : "None"}
      icon={<Link2 className="size-4" />}
      subtitle="OathNet Discord → Roblox"
      title="Roblox"
      tone="roblox"
    >
      {!hasLink || !link ? (
        <p className="discord-id-dsa-empty">No Roblox linked</p>
      ) : (
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
      )}
    </SidePanel>
  );
}

function ExpandableRecordsSection({
  title,
  count,
  open,
  onToggle,
  children,
}: {
  title: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="discord-id-leaks">
      <button
        className="discord-id-leaks-toggle"
        onClick={onToggle}
        type="button"
      >
        <span>
          {title}
          <span className="discord-id-leaks-count">{count}</span>
        </span>
        <ChevronDown
          className={clsx(
            "size-4 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open ? children : null}
    </section>
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
  const { profile, leaks, fivem, dsa, robloxLink } = result;
  const accent = profileAccent(profile);
  const [bannerHidden, setBannerHidden] = useState(false);
  const [showLeaks, setShowLeaks] = useState(leaks.count > 0);
  const [showFivem, setShowFivem] = useState((fivem?.count ?? 0) > 0);
  const dsaRef = useRef<HTMLElement | null>(null);

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

  const scrollToDsa = () => {
    dsaRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  return (
    <div className="discord-id-shell">
      <div className="discord-id-stats">
        <button
          aria-expanded={showLeaks}
          className="discord-id-stat-btn"
          onClick={() => setShowLeaks((value) => !value)}
          type="button"
        >
          <SummaryCard
            active={showLeaks}
            count={leaks.count}
            icon={<Shield className="size-4" />}
            label="Breaches"
            tone="breach"
          />
        </button>
        <button
          aria-expanded={showFivem}
          className="discord-id-stat-btn"
          onClick={() => setShowFivem((value) => !value)}
          type="button"
        >
          <SummaryCard
            active={showFivem}
            count={fivemCount}
            icon={<Gamepad2 className="size-4" />}
            label="FiveM records"
            tone="fivem"
          />
        </button>
        <button
          className="discord-id-stat-btn"
          onClick={scrollToDsa}
          type="button"
        >
          <SummaryCard
            count={dsaCount}
            icon={<Scale className="size-4" />}
            label="DSA sanctions"
            tone="dsa"
          />
        </button>
        <div className="discord-id-stat-btn" aria-hidden={false}>
          <SummaryCard
            count={robloxLinked ? 1 : 0}
            icon={<Link2 className="size-4" />}
            label="Roblox linked"
            tone="roblox"
          />
        </div>
      </div>

      <div className="discord-id-layout">
        <article
          className="discord-id-profile"
          style={{ "--discord-accent": accent } as React.CSSProperties}
        >
          <div className="discord-id-banner-wrap">
            {profile.bannerUrl && !bannerHidden ? (
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
              <DiscordNameplateArt
                blurResults={blurResults}
                nameplate={profile.nameplate}
              />
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
              <DownloadButton
                href={
                  profile.nameplate?.animatedUrl ??
                  profile.nameplate?.animatedImageUrl ??
                  profile.nameplate?.url
                }
                label="Nameplate"
              />
            </div>
          </div>
        </article>

        <div className="discord-id-side">
          <RobloxLinkPanel blurResults={blurResults} link={robloxLink} />

          <section className="discord-id-dsa" ref={dsaRef}>
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
          </section>
        </div>
      </div>

      <ExpandableRecordsSection
        count={leaks.count}
        onToggle={() => setShowLeaks((value) => !value)}
        open={showLeaks}
        title="Breach records"
      >
        <DiscordLeakRecords
          blurResults={blurResults}
          emptyDetail="No breach or stealer records found for this Discord ID."
          records={leakRecords}
          totalCount={leaks.count}
        />
      </ExpandableRecordsSection>

      <ExpandableRecordsSection
        count={fivemCount}
        onToggle={() => setShowFivem((value) => !value)}
        open={showFivem}
        title="FiveM records"
      >
        <DiscordLeakRecords
          blurResults={blurResults}
          emptyDetail="No FiveM accounts linked to this Discord ID."
          metaDetail="Linked FiveM accounts"
          records={fivemRecords}
          totalCount={fivemCount}
        />
      </ExpandableRecordsSection>

      {blurResults ? <ResultsBlurNotice /> : null}
    </div>
  );
}
