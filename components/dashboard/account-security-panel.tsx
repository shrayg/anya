"use client";

import { useEffect, useState } from "react";
import { KeyRound, Mail, Shield } from "lucide-react";

import { apiFetch } from "@/lib/csrf-client";
import { passwordRequirementsHint } from "@/lib/password-policy";

export function AccountSecurityPanel({
  username,
  initialRecoveryEmail = null,
}: {
  username: string;
  initialRecoveryEmail?: string | null;
}) {
  const [recoveryEmail, setRecoveryEmail] = useState(
    initialRecoveryEmail ?? "",
  );
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [emailMsg, setEmailMsg] = useState<string | null>(null);
  const [emailErr, setEmailErr] = useState<string | null>(null);
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);
  const [passwordErr, setPasswordErr] = useState<string | null>(null);

  useEffect(() => {
    setRecoveryEmail(initialRecoveryEmail ?? "");
  }, [initialRecoveryEmail]);

  async function saveRecoveryEmail() {
    setEmailBusy(true);
    setEmailMsg(null);
    setEmailErr(null);
    try {
      const res = await apiFetch("/api/user/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "recovery_email",
          recoveryEmail,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) throw new Error(data.error ?? "Could not save email");
      setEmailMsg(data.message ?? "Saved");
      if (
        typeof data.recoveryEmail === "string" ||
        data.recoveryEmail === null
      ) {
        setRecoveryEmail(data.recoveryEmail ?? "");
      }
    } catch (err) {
      setEmailErr(err instanceof Error ? err.message : "Could not save email");
    } finally {
      setEmailBusy(false);
    }
  }

  async function changePassword() {
    setPasswordBusy(true);
    setPasswordMsg(null);
    setPasswordErr(null);
    try {
      if (newPassword !== confirmPassword) {
        throw new Error("New passwords do not match");
      }
      const res = await apiFetch("/api/user/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "password",
          currentPassword,
          newPassword,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) throw new Error(data.error ?? "Could not update password");
      setPasswordMsg(data.message ?? "Password updated");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPasswordErr(
        err instanceof Error ? err.message : "Could not update password",
      );
    } finally {
      setPasswordBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex items-center gap-2">
          <Shield className="size-4 text-pink-300" />
          <h3 className="text-sm font-semibold text-white">Profile</h3>
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          Your login username. Contact support if you need it changed.
        </p>
        <div className="mt-4">
          <label className="text-[10px] uppercase tracking-wider text-zinc-500">
            Username
          </label>
          <p className="mt-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white">
            {username}
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex items-center gap-2">
          <Mail className="size-4 text-pink-300" />
          <h3 className="text-sm font-semibold text-white">Recovery email</h3>
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          Used for account recovery and billing notices. Not shown publicly.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            className="h-10 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-pink-400/40"
            placeholder="you@example.com"
            type="email"
            value={recoveryEmail}
            onChange={(e) => setRecoveryEmail(e.target.value)}
          />
          <button
            className="anya-link-btn h-10 shrink-0 px-4 disabled:opacity-50"
            disabled={emailBusy}
            type="button"
            onClick={() => void saveRecoveryEmail()}
          >
            {emailBusy ? "Saving…" : "Save email"}
          </button>
        </div>
        {emailMsg ? (
          <p className="mt-2 text-xs text-emerald-300">{emailMsg}</p>
        ) : null}
        {emailErr ? (
          <p className="mt-2 text-xs text-red-300">{emailErr}</p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex items-center gap-2">
          <KeyRound className="size-4 text-pink-300" />
          <h3 className="text-sm font-semibold text-white">Change password</h3>
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          {passwordRequirementsHint()}
        </p>
        <div className="mt-4 grid gap-3">
          <input
            autoComplete="current-password"
            className="h-10 rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-pink-400/40"
            placeholder="Current password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
          <input
            autoComplete="new-password"
            className="h-10 rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-pink-400/40"
            placeholder="New password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <input
            autoComplete="new-password"
            className="h-10 rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-pink-400/40"
            placeholder="Confirm new password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          <button
            className="anya-link-btn h-10 w-fit px-4 disabled:opacity-50"
            disabled={passwordBusy}
            type="button"
            onClick={() => void changePassword()}
          >
            {passwordBusy ? "Updating…" : "Update password"}
          </button>
        </div>
        {passwordMsg ? (
          <p className="mt-2 text-xs text-emerald-300">{passwordMsg}</p>
        ) : null}
        {passwordErr ? (
          <p className="mt-2 text-xs text-red-300">{passwordErr}</p>
        ) : null}
      </section>
    </div>
  );
}
