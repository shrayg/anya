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
    <div className="rounded-[0.85rem] border border-white/[0.07] bg-[#141417] p-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <div>
          <div className="mb-2 flex items-center gap-1.5">
            <Shield className="size-3.5 text-zinc-400" />
            <h3 className="text-xs font-semibold text-zinc-200">Profile</h3>
          </div>
          <label className="text-[10px] uppercase tracking-wide text-zinc-600">
            Username
          </label>
          <p className="mt-1 rounded-md border border-white/10 bg-[#0c0c0e] px-2.5 py-1.5 text-sm text-white">
            {username}
          </p>
        </div>

        <div>
          <div className="mb-2 flex items-center gap-1.5">
            <Mail className="size-3.5 text-zinc-400" />
            <h3 className="text-xs font-semibold text-zinc-200">
              Recovery email
            </h3>
          </div>
          <div className="flex gap-2">
            <input
              className="h-8 min-w-0 flex-1 rounded-md border border-white/10 bg-[#0c0c0e] px-2.5 text-xs text-white outline-none placeholder:text-zinc-600 focus:border-white/20"
              placeholder="you@example.com"
              type="email"
              value={recoveryEmail}
              onChange={(e) => setRecoveryEmail(e.target.value)}
            />
            <button
              className="h-8 shrink-0 rounded-md border border-white/10 bg-white/[0.04] px-2.5 text-[11px] font-medium text-zinc-200 transition hover:bg-white/[0.08] disabled:opacity-50"
              disabled={emailBusy}
              type="button"
              onClick={() => void saveRecoveryEmail()}
            >
              {emailBusy ? "…" : "Save"}
            </button>
          </div>
          {emailMsg ? (
            <p className="mt-1 text-[10px] text-emerald-300">{emailMsg}</p>
          ) : null}
          {emailErr ? (
            <p className="mt-1 text-[10px] text-red-300">{emailErr}</p>
          ) : null}
        </div>

        <div>
          <div className="mb-2 flex items-center gap-1.5">
            <KeyRound className="size-3.5 text-zinc-400" />
            <h3 className="text-xs font-semibold text-zinc-200">Password</h3>
          </div>
          <p className="mb-2 text-[10px] text-zinc-600">
            {passwordRequirementsHint()}
          </p>
          <div className="grid gap-1.5">
            <input
              autoComplete="current-password"
              className="h-8 rounded-md border border-white/10 bg-[#0c0c0e] px-2.5 text-xs text-white outline-none placeholder:text-zinc-600 focus:border-white/20"
              placeholder="Current"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-1.5">
              <input
                autoComplete="new-password"
                className="h-8 rounded-md border border-white/10 bg-[#0c0c0e] px-2.5 text-xs text-white outline-none placeholder:text-zinc-600 focus:border-white/20"
                placeholder="New"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <input
                autoComplete="new-password"
                className="h-8 rounded-md border border-white/10 bg-[#0c0c0e] px-2.5 text-xs text-white outline-none placeholder:text-zinc-600 focus:border-white/20"
                placeholder="Confirm"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <button
              className="h-8 w-fit rounded-md border border-white/10 bg-white/[0.04] px-2.5 text-[11px] font-medium text-zinc-200 transition hover:bg-white/[0.08] disabled:opacity-50"
              disabled={passwordBusy}
              type="button"
              onClick={() => void changePassword()}
            >
              {passwordBusy ? "…" : "Update password"}
            </button>
          </div>
          {passwordMsg ? (
            <p className="mt-1 text-[10px] text-emerald-300">{passwordMsg}</p>
          ) : null}
          {passwordErr ? (
            <p className="mt-1 text-[10px] text-red-300">{passwordErr}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
