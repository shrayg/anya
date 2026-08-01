"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Bell, X } from "lucide-react";
import { SiDiscord } from "react-icons/si";
import clsx from "clsx";

import { AnnouncementFeed } from "@/components/announcement-feed";
import { siteConfig } from "@/config/site";
import {
  hasUnreadAnnouncements,
  markAnnouncementsSeen,
} from "@/lib/announcements-seen";

const LEGACY_DISCORD_SEEN_KEY = "anya:discord-notify-seen";

export function HomeDiscordNotify() {
  const titleId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(false);

  useEffect(() => {
    try {
      const legacyUnread =
        window.localStorage.getItem(LEGACY_DISCORD_SEEN_KEY) !== "1";
      setUnread(hasUnreadAnnouncements() || legacyUnread);
    } catch {
      setUnread(true);
    }
  }, []);

  const markSeen = useCallback(() => {
    setUnread(false);
    markAnnouncementsSeen();
    try {
      window.localStorage.setItem(LEGACY_DISCORD_SEEN_KEY, "1");
    } catch {
      /* ignore */
    }
  }, []);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  const openPanel = useCallback(() => {
    setOpen(true);
    markSeen();
  }, [markSeen]);

  const toggle = useCallback(() => {
    if (open) close();
    else openPanel();
  }, [close, open, openPanel]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [close, open]);

  const discordUrl = siteConfig.links.discord;

  return (
    <div ref={rootRef} className="home-discord-notify">
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={
          unread ? "Open updates — new announcement" : "Open updates"
        }
        className={clsx(
          "home-discord-notify__bell",
          open && "is-open",
          unread && "has-unread",
        )}
        type="button"
        onClick={toggle}
      >
        <Bell aria-hidden className="size-[1.15rem]" strokeWidth={1.75} />
        {unread ? (
          <span aria-hidden className="home-discord-notify__badge" />
        ) : null}
      </button>

      {open ? (
        <>
          <button
            aria-label="Close updates"
            className="home-discord-notify__backdrop"
            type="button"
            onClick={close}
          />
          <div
            aria-labelledby={titleId}
            aria-modal="true"
            className="home-discord-notify__panel home-discord-notify__panel--feed"
            role="dialog"
          >
            <div className="home-discord-notify__panel-head">
              <div className="home-discord-notify__panel-heading">
                <span aria-hidden className="home-discord-notify__panel-icon">
                  <Bell className="size-4" strokeWidth={1.75} />
                </span>
                <div>
                  <h2 className="home-discord-notify__title" id={titleId}>
                    Updates
                  </h2>
                  <p className="home-discord-notify__eyebrow">
                    From the Anya team
                  </p>
                </div>
              </div>
              <button
                aria-label="Close"
                className="home-discord-notify__close"
                type="button"
                onClick={close}
              >
                <X aria-hidden className="size-4" strokeWidth={2} />
              </button>
            </div>

            <AnnouncementFeed className="home-discord-notify__feed" />

            <div className="home-discord-notify__discord">
              <p className="home-discord-notify__discord-copy">
                Want product updates and support live? Join the official Discord.
              </p>
              <a
                className="home-discord-notify__cta"
                href={discordUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                <SiDiscord aria-hidden className="size-4 shrink-0" />
                Join Discord
              </a>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
