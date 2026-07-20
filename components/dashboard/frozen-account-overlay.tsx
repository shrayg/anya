"use client";

import { Snowflake } from "lucide-react";
import { SiTelegram } from "react-icons/si";

import { apiFetch } from "@/lib/csrf-client";
import { siteConfig } from "@/config/site";

export function FrozenAccountOverlay({ username }: { username: string }) {
  const telegramUrl = siteConfig.links.telegram;

  const handleLogout = async () => {
    await apiFetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/auth?action=login";
  };

  return (
    <div
      aria-labelledby="frozen-account-title"
      aria-live="assertive"
      className="frozen-account-overlay"
      role="alertdialog"
    >
      <div className="frozen-account-overlay__backdrop" />
      <div className="frozen-account-overlay__card">
        <div className="frozen-account-overlay__icon-wrap">
          <Snowflake aria-hidden className="size-8 text-sky-200" />
        </div>
        <p className="frozen-account-overlay__eyebrow">Account restricted</p>
        <h2 className="frozen-account-overlay__title" id="frozen-account-title">
          Your account has been frozen
        </h2>
        <p className="frozen-account-overlay__text">
          Access to {siteConfig.name} is paused for <strong>{username}</strong>.
          Open a support ticket on Telegram and our team will review your
          account.
        </p>
        <div className="frozen-account-overlay__actions">
          <a
            className="frozen-account-overlay__btn frozen-account-overlay__btn--primary"
            href={telegramUrl}
            rel="noreferrer"
            target="_blank"
          >
            <SiTelegram aria-hidden className="size-5" />
            Open Telegram support
          </a>
          <a
            className="frozen-account-overlay__btn frozen-account-overlay__btn--secondary"
            href="/dashboard/support"
          >
            Support page
          </a>
          <button
            className="frozen-account-overlay__btn frozen-account-overlay__btn--ghost"
            type="button"
            onClick={handleLogout}
          >
            Sign out
          </button>
        </div>
        <p className="frozen-account-overlay__footnote">
          Include your username when you contact support so we can restore
          access faster.
        </p>
      </div>
    </div>
  );
}
