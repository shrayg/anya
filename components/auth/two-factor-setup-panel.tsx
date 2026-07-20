"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, Check, ShieldCheck, Smartphone } from "lucide-react";

import { TwoFactorQr } from "@/components/auth/two-factor-qr";
import { apiFetch } from "@/lib/csrf-client";

type Status = {
  twoFactorEnabled: boolean;
  backupCodesRemaining: number;
};

export function TwoFactorSetupPanel({
  autoStart = false,
}: {
  autoStart?: boolean;
}) {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [otpauthUrl, setOtpauthUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [copied, setCopied] = useState(false);

  const [disablePassword, setDisablePassword] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [showDisable, setShowDisable] = useState(false);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/auth/2fa/status", {
        method: "GET",
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) throw new Error(data.error ?? "Could not load 2FA status");
      setStatus({
        twoFactorEnabled: Boolean(data.twoFactorEnabled),
        backupCodesRemaining: Number(data.backupCodesRemaining) || 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load 2FA status");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const startSetup = useCallback(async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    setBackupCodes(null);
    try {
      const res = await apiFetch("/api/auth/2fa/setup", { method: "POST" });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) throw new Error(data.error ?? "Could not start 2FA setup");
      setPendingToken(typeof data.pendingToken === "string" ? data.pendingToken : null);
      setOtpauthUrl(typeof data.otpauthUrl === "string" ? data.otpauthUrl : null);
      setSecret(typeof data.secret === "string" ? data.secret : null);
      setCode("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start 2FA setup");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (autoStart && status && !status.twoFactorEnabled && !pendingToken && !loading) {
      void startSetup();
    }
  }, [autoStart, status, pendingToken, loading, startSetup]);

  async function confirmSetup() {
    if (!pendingToken) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await apiFetch("/api/auth/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pendingToken, code }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) throw new Error(data.error ?? "Could not verify code");
      setMessage(data.message ?? "Two-factor authentication enabled");
      setBackupCodes(
        Array.isArray(data.backupCodes)
          ? data.backupCodes.filter((c: unknown): c is string => typeof c === "string")
          : null,
      );
      setPendingToken(null);
      setOtpauthUrl(null);
      setSecret(null);
      setCode("");
      await loadStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not verify code");
    } finally {
      setBusy(false);
    }
  }

  async function disable2fa() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await apiFetch("/api/auth/2fa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: disablePassword,
          code: disableCode,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) throw new Error(data.error ?? "Could not disable 2FA");
      setMessage(data.message ?? "Two-factor authentication disabled");
      setDisablePassword("");
      setDisableCode("");
      setShowDisable(false);
      await loadStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not disable 2FA");
    } finally {
      setBusy(false);
    }
  }

  async function copySecret() {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy secret. Select and copy it manually.");
    }
  }

  async function copyBackupCodes() {
    if (!backupCodes?.length) return;
    try {
      await navigator.clipboard.writeText(backupCodes.join("\n"));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy backup codes.");
    }
  }

  if (loading) {
    return (
      <p className="text-xs text-zinc-500">Loading authenticator status…</p>
    );
  }

  return (
    <div className="space-y-4">
      {status?.twoFactorEnabled ? (
        <>
          <div className="flex items-start gap-3 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2.5">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-300" />
            <div>
              <p className="text-sm text-emerald-100">
                Authenticator app is enabled
              </p>
              <p className="mt-0.5 text-xs text-emerald-200/70">
                {status.backupCodesRemaining} backup code
                {status.backupCodesRemaining === 1 ? "" : "s"} remaining
              </p>
            </div>
          </div>

          {!showDisable ? (
            <button
              className="h-10 rounded-xl border border-white/10 px-4 text-sm text-zinc-300 transition hover:border-red-400/40 hover:text-red-200 disabled:opacity-50"
              disabled={busy}
              type="button"
              onClick={() => setShowDisable(true)}
            >
              Disable two-factor authentication
            </button>
          ) : (
            <div className="grid gap-3 rounded-xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs text-zinc-400">
                Confirm with your password and a current authenticator or backup
                code.
              </p>
              <input
                autoComplete="current-password"
                className="h-10 rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-pink-400/40"
                placeholder="Password"
                type="password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
              />
              <input
                autoComplete="one-time-code"
                className="h-10 rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-pink-400/40"
                inputMode="numeric"
                placeholder="6-digit code or backup code"
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  className="anya-link-btn h-10 px-4 disabled:opacity-50"
                  disabled={busy || !disablePassword || !disableCode}
                  type="button"
                  onClick={() => void disable2fa()}
                >
                  {busy ? "Disabling…" : "Confirm disable"}
                </button>
                <button
                  className="h-10 rounded-xl border border-white/10 px-4 text-sm text-zinc-400"
                  disabled={busy}
                  type="button"
                  onClick={() => setShowDisable(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </>
      ) : pendingToken && otpauthUrl && secret ? (
        <div className="space-y-4">
          <p className="text-xs text-zinc-400">
            Scan this QR with Google Authenticator, Authy, or any TOTP app.
            Or enter the secret key manually.
          </p>
          <TwoFactorQr otpauthUrl={otpauthUrl} />
          <div>
            <label className="text-[10px] uppercase tracking-wider text-zinc-500">
              Manual secret key
            </label>
            <div className="mt-1 flex gap-2">
              <code className="flex-1 break-all rounded-xl border border-white/10 bg-black/30 px-3 py-2 font-mono text-xs text-zinc-200">
                {secret}
              </code>
              <button
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 text-zinc-300 hover:border-white/25"
                type="button"
                onClick={() => void copySecret()}
              >
                {copied ? (
                  <Check className="size-4 text-emerald-300" />
                ) : (
                  <Copy className="size-4" />
                )}
              </button>
            </div>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-zinc-500">
              Verification code
            </label>
            <input
              autoComplete="one-time-code"
              className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-pink-400/40"
              inputMode="numeric"
              maxLength={8}
              placeholder="6-digit code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="anya-link-btn h-10 px-4 disabled:opacity-50"
              disabled={busy || code.replace(/\s/g, "").length < 6}
              type="button"
              onClick={() => void confirmSetup()}
            >
              {busy ? "Verifying…" : "Enable authenticator"}
            </button>
            <button
              className="h-10 rounded-xl border border-white/10 px-4 text-sm text-zinc-400"
              disabled={busy}
              type="button"
              onClick={() => {
                setPendingToken(null);
                setOtpauthUrl(null);
                setSecret(null);
                setCode("");
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-zinc-400">
            Protect your account with an authenticator app (Google Authenticator,
            Authy, 1Password, etc.). Recommended after registration.
          </p>
          <button
            className="anya-link-btn inline-flex h-10 items-center gap-2 px-4 disabled:opacity-50"
            disabled={busy}
            type="button"
            onClick={() => void startSetup()}
          >
            <Smartphone className="size-4" />
            {busy ? "Preparing…" : "Set up authenticator"}
          </button>
        </div>
      )}

      {backupCodes?.length ? (
        <div className="rounded-xl border border-amber-400/25 bg-amber-500/10 p-4">
          <p className="text-sm font-medium text-amber-100">
            Save these backup codes
          </p>
          <p className="mt-1 text-xs text-amber-200/70">
            Each code works once if you lose your authenticator. Store them
            offline — they won&apos;t be shown again.
          </p>
          <ul className="mt-3 grid grid-cols-2 gap-1.5 font-mono text-xs text-amber-50">
            {backupCodes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <button
            className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-lg border border-amber-400/30 px-3 text-xs text-amber-100"
            type="button"
            onClick={() => void copyBackupCodes()}
          >
            {copied ? (
              <Check className="size-3.5" />
            ) : (
              <Copy className="size-3.5" />
            )}
            Copy codes
          </button>
        </div>
      ) : null}

      {message ? (
        <p className="text-xs text-emerald-300">{message}</p>
      ) : null}
      {error ? <p className="text-xs text-red-300">{error}</p> : null}
    </div>
  );
}
