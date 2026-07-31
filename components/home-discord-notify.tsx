"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Bell, X } from "lucide-react";
import { SiDiscord } from "react-icons/si";
import clsx from "clsx";

import { siteConfig } from "@/config/site";

const SEEN_KEY = "anya:discord-notify-seen";

export function HomeDiscordNotify() {
  const titleId = useId();
  const descId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(false);

  useEffect(() => {
    try {
      setUnread(window.localStorage.getItem(SEEN_KEY) !== "1");
    } catch {
      setUnread(true);
    }
  }, []);

  const markSeen = useCallback(() => {
    setUnread(false);
    try {
      window.localStorage.setItem(SEEN_KEY, "1");
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
          unread
            ? "Open notifications — new Discord invite"
            : "Open notifications"
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
            aria-label="Close notifications"
            className="home-discord-notify__backdrop"
            type="button"
            onClick={close}
          />
          <div
            aria-describedby={descId}
            aria-labelledby={titleId}
            aria-modal="true"
            className="home-discord-notify__panel"
            role="dialog"
          >
            <div className="home-discord-notify__panel-head">
              <span aria-hidden className="home-discord-notify__panel-icon">
                <SiDiscord className="size-5" />
              </span>
              <button
                aria-label="Close"
                className="home-discord-notify__close"
                type="button"
                onClick={close}
              >
                <X aria-hidden className="size-4" strokeWidth={2} />
              </button>
            </div>
            <h2 className="home-discord-notify__title" id={titleId}>
              Join the official Discord
            </h2>
            <p className="home-discord-notify__copy" id={descId}>
              Get product updates, support, and talk with the Anya community on
              our official server.
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
        </>
      ) : null}
    </div>
  );
}
