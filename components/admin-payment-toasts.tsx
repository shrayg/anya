"use client";

import { useEffect, useRef } from "react";

import { toast } from "@/lib/toast";

type PaymentFeedRow = {
  id: number;
  amount: number;
  currency: string;
  type: string;
  plan: string | null;
  interval: string | null;
  description: string;
  createdAt: string;
  username: string;
};

function paymentTitle(type: string) {
  if (type === "subscription") return "New subscription";
  if (type === "api_access") return "API access purchase";
  if (type === "balance_topup" || type === "credits") return "Credit pack purchase";

  return "Payment received";
}

/**
 * Polls recent completed payments and surfaces Sonner toasts for admins.
 */
export function AdminPaymentToasts() {
  const cursorRef = useRef<string | null>(null);
  const seenRef = useRef<Set<number>>(new Set());
  const enabledRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const schedule = (ms: number) => {
      if (cancelled) return;
      timer = setTimeout(() => {
        void tick();
      }, ms);
    };

    const tick = async () => {
      if (cancelled || document.visibilityState === "hidden") {
        schedule(20_000);

        return;
      }

      try {
        const meRes = await fetch("/api/auth/me", {
          cache: "no-store",
          credentials: "include",
        });
        const me = await meRes.json().catch(() => ({}));
        const isAdmin = Boolean(
          me?.authenticated &&
            (me?.canManageWorkspace ||
              me?.user?.isAdmin ||
              me?.user?.canManageWorkspace),
        );

        if (!isAdmin) {
          enabledRef.current = false;
          schedule(45_000);

          return;
        }

        if (!enabledRef.current) {
          enabledRef.current = true;
          cursorRef.current = new Date().toISOString();
          schedule(12_000);

          return;
        }

        const after = encodeURIComponent(
          cursorRef.current ?? new Date(Date.now() - 60_000).toISOString(),
        );
        const res = await fetch(`/api/admin/payments/feed?after=${after}`, {
          cache: "no-store",
          credentials: "include",
        });

        if (res.status === 401 || res.status === 403) {
          enabledRef.current = false;
          schedule(45_000);

          return;
        }

        if (!res.ok) {
          schedule(20_000);

          return;
        }

        const data = (await res.json()) as {
          payments?: PaymentFeedRow[];
          serverTime?: string;
        };
        const rows = data.payments ?? [];

        for (const row of rows) {
          if (seenRef.current.has(row.id)) continue;
          seenRef.current.add(row.id);

          const money = `$${row.amount.toFixed(2)} ${(row.currency || "USD").toUpperCase()}`;
          const detail = [
            row.username,
            row.plan ? row.plan : null,
            row.interval ? row.interval : null,
          ]
            .filter(Boolean)
            .join(" · ");

          toast.success(paymentTitle(row.type), {
            description: `${money}${detail ? ` — ${detail}` : ""}`,
            duration: 8_000,
          });

          cursorRef.current = row.createdAt;
        }

        if (data.serverTime && rows.length === 0) {
          // Keep cursor moving so we don't re-scan ancient rows after idle.
          cursorRef.current = data.serverTime;
        }
      } catch {
        /* ignore network blips */
      }

      schedule(12_000);
    };

    void tick();

    const onVisible = () => {
      if (document.visibilityState === "visible") void tick();
    };

    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}
