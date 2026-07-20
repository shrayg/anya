"use client";

import { useCallback, useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";

import { apiFetch } from "@/lib/csrf-client";

type SafetyNotice = {
  id: number;
  publicId: string;
  helperMessage: string | null;
  notifiedAt: string | null;
  flaggedByUsername: string | null;
  assignedHelperUsername: string | null;
  reasonCode: string;
  createdAt: string;
};

/**
 * Prominent modal for staff messages on THIS member's safety flags.
 * Recipient is always the flagged user (session), never admin inbox.
 */
export function SafetyNoticeOverlay() {
  const [notices, setNotices] = useState<SafetyNotice[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const loadNotices = useCallback(async () => {
    try {
      const response = await fetch("/api/user/safety-notices", {
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok) return;
      setNotices(Array.isArray(data.notices) ? data.notices : []);
    } catch {
      // non-blocking
    }
  }, []);

  useEffect(() => {
    loadNotices();
    const interval = window.setInterval(loadNotices, 60_000);

    return () => window.clearInterval(interval);
  }, [loadNotices]);

  const active = notices[0];

  if (!active?.helperMessage) return null;

  const from =
    active.assignedHelperUsername ||
    active.flaggedByUsername ||
    "Support staff";

  const acknowledge = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await apiFetch("/api/user/safety-notices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flagId: active.id }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Could not acknowledge notice.");

        return;
      }
      setNotices((current) => current.filter((n) => n.id !== active.id));
    } catch {
      setError("Could not acknowledge notice.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
    >
      <div className="w-full max-w-lg rounded-2xl border border-amber-400/30 bg-zinc-950 p-6 shadow-2xl shadow-amber-950/40">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex size-11 items-center justify-center rounded-full border border-amber-400/30 bg-amber-500/15 text-amber-200">
            <ShieldAlert className="size-5" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-amber-200/80">
              Account notice
            </p>
            <h2 className="text-lg font-semibold text-white">
              Message from {from}
            </h2>
          </div>
        </div>

        <p className="mb-5 whitespace-pre-wrap rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 text-sm leading-relaxed text-zinc-100">
          {active.helperMessage}
        </p>

        {error && <p className="mb-3 text-sm text-rose-300">{error}</p>}

        <button
          className="w-full rounded-md border border-amber-400/40 bg-amber-500/20 px-4 py-2.5 text-sm font-semibold text-amber-50 transition hover:bg-amber-500/30 disabled:opacity-50"
          disabled={busy}
          type="button"
          onClick={acknowledge}
        >
          {busy ? "Saving..." : "I understand"}
        </button>
      </div>
    </div>
  );
}
