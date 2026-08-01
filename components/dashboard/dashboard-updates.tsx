"use client";

import clsx from "clsx";
import { Megaphone, X } from "lucide-react";
import { useCallback, useEffect, useId, useState } from "react";

import { AnnouncementFeed } from "@/components/announcement-feed";
import { useSearchJobs } from "@/components/dashboard/search-jobs-context";
import {
  hasUnreadAnnouncements,
  markAnnouncementsSeen,
} from "@/lib/announcements-seen";

type DashboardUpdatesProps = {
  collapsed?: boolean;
};

export function DashboardUpdatesButton({ collapsed }: DashboardUpdatesProps) {
  const titleId = useId();
  const { setPanelOpen: setJobsPanelOpen } = useSearchJobs();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(false);

  useEffect(() => {
    setUnread(hasUnreadAnnouncements());
  }, []);

  const close = useCallback(() => setOpen(false), []);

  const openPanel = useCallback(() => {
    setJobsPanelOpen(false);
    setOpen(true);
    markAnnouncementsSeen();
    setUnread(false);
  }, [setJobsPanelOpen]);

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

  return (
    <>
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={
          unread ? "Open updates — new announcement" : "Open updates"
        }
        className={clsx(
          "search-jobs-sidebar-btn",
          "dash-updates-sidebar-btn",
          collapsed && "search-jobs-sidebar-btn--collapsed",
          unread && "dash-updates-sidebar-btn--unread",
        )}
        title="Updates"
        type="button"
        onClick={toggle}
      >
        <Megaphone className="size-4 shrink-0" />
        {!collapsed ? (
          <span className="dash-sidebar-label">Updates</span>
        ) : null}
        {unread ? (
          <span aria-hidden className="dash-updates-sidebar-dot" />
        ) : null}
      </button>

      {open ? (
        <>
          <button
            aria-label="Close updates"
            className="dash-updates-backdrop"
            type="button"
            onClick={close}
          />
          <div
            aria-labelledby={titleId}
            aria-modal="true"
            className="dash-updates-panel"
            role="dialog"
          >
            <div className="dash-updates-panel-header">
              <div>
                <p className="dash-updates-panel-title" id={titleId}>
                  Updates
                </p>
                <p className="dash-updates-panel-subtitle">
                  Announcements from the Anya team
                </p>
              </div>
              <button
                aria-label="Close"
                className="dash-updates-panel-close"
                type="button"
                onClick={close}
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="dash-updates-panel-body">
              <AnnouncementFeed />
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
