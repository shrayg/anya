"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  ChevronDown,
  Copy,
  Download,
  ExternalLink,
  Gamepad2,
  Link2,
  Scale,
  Server,
  Shield,
  TriangleAlert,
} from "lucide-react";
import clsx from "clsx";

import { ResultsBlurNotice } from "@/components/results-blur-notice";
import { BlurredValue } from "@/components/dashboard/blurred-value";
import { IntelSignalLoader } from "@/components/dashboard/intel-signal-loader";
import { SearchResultCards } from "@/components/dashboard/search-result-cards";
import { resolveDiscordBadges } from "@/lib/discord-badges";
import type {
  DiscordConnectedAccount,
  DiscordGuildMembership,
  DiscordOsintContacts,
  DiscordUsernameHistoryEntry,
} from "@/lib/discord-enrichment";
import {
  formatDiscordMemberSince,
  formatDsaDate,
  NAMEPLATE_PALETTE_COLORS,
  profileAccent,
  profileBannerFill,
  profileThemeColor,
  type DiscordDsaSanction,
  type DiscordNameplate,
  type DiscordRobloxLink,
  type DiscordSearchResult,
} from "@/lib/discord-profile";
import { formatSearchRecords } from "@/lib/search-utils";

type DataTab =
  | "breaches"
  | "servers"
  | "connections"
  | "roblox"
  | "dsa"
  | "fivem";

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

  const videoSrc = !reducedMotion && tier === 0 ? nameplate.animatedUrl : null;
  const apngSrc =
    !reducedMotion && tier <= 1 ? nameplate.animatedImageUrl : null;
  const mediaSrc = videoSrc ?? apngSrc ?? nameplate.url;
  const mediaKind = videoSrc ? "video" : classifyNameplateMedia(mediaSrc);

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
    (nameplate.palette && NAMEPLATE_PALETTE_COLORS[nameplate.palette]) ||
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
          disablePictureInPicture
          disableRemotePlayback
          loop
          muted
          playsInline
          className="discord-id-nameplate-media"
          poster={nameplate.url}
          preload="auto"
          onError={() => setTier(1)}
        >
          <source src={videoSrc} type="video/webm" />
        </video>
      ) : (
        <img
          key={mediaSrc}
          aria-hidden
          alt=""
          className="discord-id-nameplate-media"
          src={mediaSrc}
          onError={() => {
            if (tier < 2) setTier(2);
          }}
        />
      )}
      {nameplate.description ? (
        <p className="discord-id-nameplate-desc">
          <BlurredValue forceBlur={blurResults} text={nameplate.description} />
        </p>
      ) : null}
    </div>
  );
}

function ServersBlock({
  guilds,
  count,
  blurResults,
}: {
  guilds: DiscordGuildMembership[];
  count: number;
  blurResults: boolean;
}) {
  if (guilds.length === 0 && count <= 0) {
    return (
      <p className="discord-id-dsa-empty">
        No server memberships returned for this Discord ID. Upstream indexes
        only expose mutual guilds when their stalker coverage includes this
        user.
      </p>
    );
  }

  if (guilds.length === 0) {
    return (
      <div className="discord-id-servers-empty-count">
        <p className="discord-id-dsa-empty" style={{ margin: 0 }}>
          Upstream reports {count} mutual server{count === 1 ? "" : "s"}, but
          did not return server names or IDs for this lookup.
        </p>
      </div>
    );
  }

  return (
    <div className="discord-id-servers-list">
      <p className="discord-leak-meta" style={{ marginBottom: "0.65rem" }}>
        <span className="discord-leak-meta-pill">
          {guilds.length} server{guilds.length === 1 ? "" : "s"}
        </span>
        <span className="discord-leak-meta-detail">
          {count > guilds.length
            ? `${count} reported · ${guilds.length} with details`
            : "Memberships from Discord OSINT indexes"}
        </span>
      </p>
      {guilds.map((guild, index) => (
        <article
          key={guild.id}
          className="discord-id-server-row anya-pop-in"
          style={{ "--pop-i": Math.min(index, 8) } as CSSProperties}
        >
          {guild.iconUrl ? (
            <img
              alt=""
              className="discord-id-server-icon"
              src={guild.iconUrl}
            />
          ) : (
            <span aria-hidden className="discord-id-server-icon-fallback">
              {(guild.name ?? guild.id).slice(0, 1).toUpperCase()}
            </span>
          )}
          <div className="discord-id-server-copy">
            <p className="discord-id-server-name">
              <BlurredValue
                forceBlur={blurResults}
                text={guild.name ?? "Unknown server"}
              />
            </p>
            <p className="discord-id-server-id">
              <BlurredValue forceBlur={blurResults} text={guild.id} />
            </p>
            {guild.nick ? (
              <p className="discord-id-server-nick">
                Nick:{" "}
                <BlurredValue forceBlur={blurResults} text={guild.nick} />
              </p>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}

function ConnectionsBlock({
  connections,
  history,
  blurResults,
}: {
  connections: DiscordConnectedAccount[];
  history: DiscordUsernameHistoryEntry[];
  blurResults: boolean;
}) {
  if (connections.length === 0 && history.length === 0) {
    return (
      <p className="discord-id-dsa-empty">
        No linked accounts or username history returned for this Discord ID.
      </p>
    );
  }

  return (
    <div className="discord-id-connections-wrap">
      {connections.length > 0 ? (
        <div className="discord-id-connections-list">
          {connections.map((account, index) => (
            <article
              key={`${account.type}-${account.name}-${account.id ?? ""}`}
              className="discord-id-connection-row anya-pop-in"
              style={{ "--pop-i": Math.min(index, 8) } as CSSProperties}
            >
              <span className="discord-id-connection-type">
                {account.type}
              </span>
              <div className="discord-id-connection-copy">
                <p className="discord-id-connection-name">
                  <BlurredValue forceBlur={blurResults} text={account.name} />
                </p>
                {account.id ? (
                  <p className="discord-id-connection-id">
                    <BlurredValue forceBlur={blurResults} text={account.id} />
                  </p>
                ) : null}
              </div>
              {account.verified != null ? (
                <span
                  className={clsx(
                    "discord-id-connection-verified",
                    account.verified &&
                      "discord-id-connection-verified--yes",
                  )}
                >
                  {account.verified ? "Verified" : "Unverified"}
                </span>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}

      {history.length > 0 ? (
        <div className="discord-id-history-block">
          <p className="discord-id-meta-label">Username history</p>
          <ul className="discord-id-history-list">
            {history.map((entry) => (
              <li
                key={`${entry.username}-${entry.changedAt ?? ""}`}
                className="discord-id-history-item"
              >
                <BlurredValue forceBlur={blurResults} text={entry.username} />
                {entry.changedAt ? (
                  <span className="discord-id-history-date">
                    {entry.changedAt}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function ContactsRow({
  contacts,
  blurResults,
}: {
  contacts: DiscordOsintContacts;
  blurResults: boolean;
}) {
  const fields = [
    contacts.email ? { label: "Email", value: contacts.email } : null,
    contacts.phone ? { label: "Phone", value: contacts.phone } : null,
    contacts.ip ? { label: "IP", value: contacts.ip } : null,
  ].filter(Boolean) as { label: string; value: string }[];

  if (fields.length === 0) return null;

  return (
    <div className="discord-id-meta-grid discord-id-meta-grid--contacts">
      {fields.map((field) => (
        <div key={field.label} className="discord-id-meta-block">
          <p className="discord-id-meta-label">{field.label}</p>
          <p
            className={clsx(
              "discord-id-meta-value",
              field.label !== "Email" && "discord-id-meta-value--mono",
            )}
          >
            <BlurredValue forceBlur={blurResults} text={field.value} />
          </p>
        </div>
      ))}
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
  tone: "breach" | "fivem" | "dsa" | "roblox" | "servers" | "connections";
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
      <span aria-hidden className="discord-id-stat-icon">
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
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1400);
        } catch {
          /* ignore */
        }
      }}
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
      <span aria-disabled className="discord-id-dl discord-id-dl--disabled">
        <Download className="size-3.5" />
        {label}
      </span>
    );
  }

  return (
    <a
      download
      className="discord-id-dl"
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
  index = 0,
}: {
  sanction: DiscordDsaSanction;
  blurResults: boolean;
  index?: number;
}) {
  const [open, setOpen] = useState(true);

  return (
    <article
      className={clsx(
        "discord-id-dsa-row anya-pop-in",
        open && "discord-id-dsa-row--open",
      )}
      style={{ "--pop-i": Math.min(index, 8) } as CSSProperties}
    >
      <button
        aria-expanded={open}
        className="discord-id-dsa-row-toggle"
        type="button"
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden className="discord-id-dsa-warn">
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
                <BlurredValue
                  forceBlur={blurResults}
                  text={sanction.description}
                />
              </span>
              <span className="discord-id-dsa-date">
                {formatDsaDate(sanction.date)}
              </span>
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
      <p className="discord-id-dsa-empty">
        No Roblox account linked to this Discord ID.
      </p>
    );
  }

  return (
    <div
      className="discord-id-roblox-card anya-pop-in"
      style={{ "--pop-i": 0 } as CSSProperties}
    >
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
      {sanctions.map((sanction, index) => (
        <DsaSanctionRow
          key={sanction.id}
          blurResults={blurResults}
          index={index}
          sanction={sanction}
        />
      ))}
    </div>
  );
}

export function DiscordSearchResults({
  result,
  blurResults = false,
  loadingMore = false,
  progressLabel = "",
}: {
  result: DiscordSearchResult;
  blurResults?: boolean;
  /** True while more Discord fan-out modules are still settling. */
  loadingMore?: boolean;
  progressLabel?: string;
}) {
  const {
    profile,
    leaks,
    fivem,
    dsa,
    robloxLink,
    guilds,
    connections,
    contacts,
    usernameHistory,
  } = result;
  const accent = profileAccent(profile);
  const bannerFill = profileBannerFill(profile);
  const themeColor = profileThemeColor(profile);
  const guildItems = guilds?.items ?? [];
  const guildCount = Math.max(guilds?.count ?? 0, guildItems.length);
  const linkedAccounts = connections ?? [];
  const history = usernameHistory ?? [];
  const connectionsCount = linkedAccounts.length + history.length;
  const reducedMotion = usePrefersReducedMotion();

  const [dataTab, setDataTab] = useState<DataTab>(() =>
    leaks.count > 0
      ? "breaches"
      : guildCount > 0
        ? "servers"
        : connectionsCount > 0
          ? "connections"
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
  const hasLiveProfile =
    Boolean(profile.username) && profile.username !== "Unknown";
  const popClass = reducedMotion ? undefined : "anya-pop-in";

  return (
    <div className="discord-id-shell">
      {loadingMore ? (
        <IntelSignalLoader
          active
          stage={progressLabel || "Assembling Discord fan-out"}
          title="Discord ID"
          variant="compact"
        />
      ) : null}
      <div
        className={clsx("discord-id-stats", popClass)}
        style={{ "--pop-i": 0 } as CSSProperties}
      >
        <button
          aria-pressed={dataTab === "breaches"}
          className="discord-id-stat-btn"
          type="button"
          onClick={() => setDataTab("breaches")}
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
          aria-pressed={dataTab === "servers"}
          className="discord-id-stat-btn"
          type="button"
          onClick={() => setDataTab("servers")}
        >
          <SummaryCard
            active={dataTab === "servers"}
            count={guildCount}
            icon={<Server className="size-4" />}
            label="Servers"
            tone="servers"
          />
        </button>
        <button
          aria-pressed={dataTab === "connections"}
          className="discord-id-stat-btn"
          type="button"
          onClick={() => setDataTab("connections")}
        >
          <SummaryCard
            active={dataTab === "connections"}
            count={connectionsCount}
            icon={<Link2 className="size-4" />}
            label="Linked"
            tone="connections"
          />
        </button>
        <button
          aria-pressed={dataTab === "roblox"}
          className="discord-id-stat-btn"
          type="button"
          onClick={() => setDataTab("roblox")}
        >
          <SummaryCard
            active={dataTab === "roblox"}
            count={robloxLinked ? 1 : 0}
            icon={<Gamepad2 className="size-4" />}
            label="Roblox"
            tone="roblox"
          />
        </button>
        <button
          aria-pressed={dataTab === "dsa"}
          className="discord-id-stat-btn"
          type="button"
          onClick={() => setDataTab("dsa")}
        >
          <SummaryCard
            active={dataTab === "dsa"}
            count={dsaCount}
            icon={<Scale className="size-4" />}
            label="DSA"
            tone="dsa"
          />
        </button>
        <button
          aria-pressed={dataTab === "fivem"}
          className="discord-id-stat-btn"
          type="button"
          onClick={() => setDataTab("fivem")}
        >
          <SummaryCard
            active={dataTab === "fivem"}
            count={fivemCount}
            icon={<Gamepad2 className="size-4" />}
            label="FiveM"
            tone="fivem"
          />
        </button>
      </div>

      <div className="discord-id-layout">
        <div className="discord-id-col-left">
          <article
            key={
              hasLiveProfile
                ? `profile-${profile.id}-${profile.username}`
                : `profile-${profile.id}`
            }
            className={clsx(
              "discord-id-profile discord-id-profile--popout",
              popClass,
            )}
            style={
              {
                "--discord-accent": accent,
                "--pop-i": 1,
                ...(themeColor ? { "--discord-theme": themeColor } : {}),
              } as CSSProperties
            }
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
                  style={{ backgroundColor: bannerFill }}
                />
              )}
              <div className="discord-id-banner-actions">
                {profile.bannerUrl ? (
                  <a
                    download
                    aria-label="Download banner"
                    className="discord-id-banner-btn"
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
                    aria-hidden
                    alt=""
                    className="discord-id-avatar-decoration"
                    src={profile.avatarDecorationUrl}
                  />
                ) : null}
              </div>
            </div>

            <div className="discord-id-popout-body">
              <div className="discord-id-popout-card">
                <h3 className="discord-id-name">
                  <BlurredValue
                    forceBlur={blurResults}
                    text={profile.displayName}
                  />
                </h3>

                <div className="discord-id-handle-row">
                  <p className="discord-id-handle">
                    <BlurredValue forceBlur={blurResults} text={handleLine} />
                  </p>
                  {profile.clanBadgeUrl ? (
                    <img
                      aria-hidden
                      alt=""
                      className="discord-id-clan-inline"
                      src={profile.clanBadgeUrl}
                    />
                  ) : null}
                  {profile.clanTag ? (
                    <span className="discord-id-clan-tag">
                      {profile.clanTag}
                    </span>
                  ) : null}
                  {badges.length > 0 ? (
                    <div
                      aria-label="Badges"
                      className="discord-id-badges discord-id-badges--inline"
                    >
                      {badges.map((badge) => (
                        <span
                          key={badge.key}
                          className="discord-id-badge"
                          style={
                            {
                              "--badge-color": badge.color,
                              "--badge-glow": badge.glow,
                            } as CSSProperties
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
                      <BlurredValue
                        forceBlur={blurResults}
                        text={profile.bio}
                      />
                    </p>
                  </div>
                ) : null}

                <div className="discord-id-meta-grid">
                  <div className="discord-id-meta-block">
                    <p className="discord-id-meta-label">Member Since</p>
                    <p className="discord-id-meta-value">
                      <BlurredValue
                        forceBlur={blurResults}
                        text={memberSince}
                      />
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

                {contacts ? (
                  <ContactsRow blurResults={blurResults} contacts={contacts} />
                ) : null}
              </div>

              <div className="discord-id-assets">
                <button
                  aria-expanded={assetsOpen}
                  className="discord-id-assets-toggle"
                  type="button"
                  onClick={() => setAssetsOpen((value) => !value)}
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
          <section
            className={clsx("discord-id-data-panel", popClass)}
            style={{ "--pop-i": 2 } as CSSProperties}
          >
            <header className="discord-id-data-head">
              <div>
                <h4 className="discord-id-data-title">
                  {dataTab === "servers"
                    ? "Servers"
                    : dataTab === "connections"
                      ? "Linked accounts"
                      : dataTab === "roblox"
                        ? "Roblox link"
                        : dataTab === "dsa"
                          ? "DSA sanctions"
                          : dataTab === "fivem"
                            ? "FiveM records"
                            : "Breach records"}
                </h4>
                <p className="discord-id-data-sub">
                  {dataTab === "servers"
                    ? "Guild memberships from Discord OSINT indexes"
                    : dataTab === "connections"
                      ? "Connected platforms and username history"
                      : dataTab === "roblox"
                        ? "Roblox account linked to this Discord ID"
                        : dataTab === "dsa"
                          ? "Digital Services Act sanctions"
                          : dataTab === "fivem"
                            ? "FiveM accounts linked to this Discord ID"
                            : "Leaks and linked exposure for this Discord ID"}
                </p>
              </div>
            </header>

            <div
              aria-label="Linked data"
              className="discord-id-data-tabs"
              role="tablist"
            >
              {(
                [
                  {
                    id: "breaches" as const,
                    label: "Breaches",
                    count: leaks.count,
                  },
                  {
                    id: "servers" as const,
                    label: "Servers",
                    count: guildCount,
                  },
                  {
                    id: "connections" as const,
                    label: "Linked",
                    count: connectionsCount,
                  },
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
                  role="tab"
                  type="button"
                  onClick={() => setDataTab(tab.id)}
                >
                  {tab.label}
                  <span className="discord-id-data-tab-count">{tab.count}</span>
                </button>
              ))}
            </div>

            <div className="discord-id-data-body" role="tabpanel">
              {dataTab === "breaches" ? (
                <SearchResultCards
                  blurResults={blurResults}
                  defaultExpanded="first"
                  dense
                  emptyDetail="No breach or stealer records found for this Discord ID."
                  initialVisible={8}
                  moduleSlug="discord-id"
                  records={leakRecords}
                  totalCount={leaks.count}
                />
              ) : null}
              {dataTab === "servers" ? (
                <ServersBlock
                  blurResults={blurResults}
                  count={guildCount}
                  guilds={guildItems}
                />
              ) : null}
              {dataTab === "connections" ? (
                <ConnectionsBlock
                  blurResults={blurResults}
                  connections={linkedAccounts}
                  history={history}
                />
              ) : null}
              {dataTab === "roblox" ? (
                <RobloxBlock blurResults={blurResults} link={robloxLink} />
              ) : null}
              {dataTab === "dsa" ? (
                <DsaBlock blurResults={blurResults} sanctions={sanctions} />
              ) : null}
              {dataTab === "fivem" ? (
                <SearchResultCards
                  blurResults={blurResults}
                  defaultExpanded="first"
                  dense
                  emptyDetail="No FiveM accounts linked to this Discord ID."
                  initialVisible={8}
                  moduleSlug="discord-id"
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
