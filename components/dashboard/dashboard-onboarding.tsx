"use client";

import clsx from "clsx";
import { ImagePlus, UserRound } from "lucide-react";
import { useRef, useState } from "react";

import {
  useDashboardAuth,
  useDashboardUser,
} from "@/components/dashboard/dashboard-auth-provider";
import Stepper, { Step } from "@/components/stepper";
import { apiFetch } from "@/lib/csrf-client";
import {
  AVATAR_PRESETS,
  DASHBOARD_ACCENT_DEFAULT,
  DASHBOARD_ACCENT_PRESETS,
} from "@/lib/dashboard-profile";

const MAX_UPLOAD_BYTES = 96_000;

async function fileToDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const maxSide = 192;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");

  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Could not process image");
  }

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  let quality = 0.84;
  let dataUrl = canvas.toDataURL("image/jpeg", quality);

  while (dataUrl.length > MAX_UPLOAD_BYTES && quality > 0.45) {
    quality -= 0.12;
    dataUrl = canvas.toDataURL("image/jpeg", quality);
  }

  if (dataUrl.length > MAX_UPLOAD_BYTES) {
    throw new Error("Image is too large — try a smaller photo");
  }

  return dataUrl;
}

export function DashboardOnboarding() {
  const user = useDashboardUser();
  const { refreshUser, patchUser } = useDashboardAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl ?? "");
  const [displayName, setDisplayName] = useState(user.displayName ?? "");
  const [accent, setAccent] = useState(
    user.dashboardAccent ?? DASHBOARD_ACCENT_DEFAULT,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(!user.onboardingCompleted);

  const applyAccentPreview = (next: string) => {
    setAccent(next);
    patchUser({ dashboardAccent: next });
  };

  if (!open || user.onboardingCompleted) {
    return null;
  }

  const saveProfile = async (opts: {
    complete?: boolean;
    skip?: boolean;
  }) => {
    setBusy(true);
    setError("");

    try {
      const response = await apiFetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim() || null,
          avatarUrl: avatarUrl || null,
          dashboardAccent: accent || null,
          completeOnboarding: opts.complete === true,
          skipOnboarding: opts.skip === true,
        }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(
          typeof data?.error === "string"
            ? data.error
            : "Could not save preferences",
        );

        return false;
      }

      if (data?.user) {
        patchUser({
          displayName: data.user.displayName ?? null,
          avatarUrl: data.user.avatarUrl ?? null,
          dashboardAccent: data.user.dashboardAccent ?? null,
          onboardingCompleted: Boolean(data.user.onboardingCompleted),
        });
      } else {
        await refreshUser();
      }

      if (opts.complete || opts.skip) {
        setOpen(false);
      }

      return true;
    } catch {
      setError("Could not save preferences");

      return false;
    } finally {
      setBusy(false);
    }
  };

  const handleSkip = () => {
    void saveProfile({ skip: true });
  };

  const handleComplete = () => {
    void saveProfile({ complete: true });
  };

  const onPickFile = async (file: File | null) => {
    if (!file) return;
    setError("");
    try {
      const dataUrl = await fileToDataUrl(file);

      setAvatarUrl(dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read image");
    }
  };

  const previewLetter = (
    displayName.trim() ||
    user.username
  )
    .charAt(0)
    .toUpperCase();

  return (
    <div
      aria-label="Welcome onboarding"
      aria-modal="true"
      className="fixed inset-0 z-[220] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
      role="dialog"
    >
      <div className="w-full max-w-md">
        <div className="mb-4 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--anya-blush)]">
            Welcome to AnyaInt
          </p>
          <h2 className="mt-1 text-xl font-semibold text-white">
            Set up your workspace
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            Optional — you can skip any step and change this later.
          </p>
        </div>

        <Stepper
          completeButtonText={busy ? "Saving…" : "Finish"}
          disableStepIndicators={busy}
          nextButtonProps={{ disabled: busy }}
          skipButtonProps={{ disabled: busy }}
          skipButtonText="Skip setup"
          onFinalStepCompleted={handleComplete}
          onSkip={handleSkip}
        >
          <Step>
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-medium text-white">
                  Profile picture
                </h3>
                <p className="mt-1 text-sm text-zinc-400">
                  Upload a photo or pick a preset avatar.
                </p>
              </div>

              <div className="flex items-center gap-4">
                <div
                  className="flex size-16 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/5 text-lg font-semibold text-white"
                  style={
                    accent
                      ? {
                          boxShadow: `0 0 0 2px color-mix(in srgb, ${accent} 45%, transparent)`,
                        }
                      : undefined
                  }
                >
                  {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      alt=""
                      className="size-full object-cover"
                      src={avatarUrl}
                    />
                  ) : (
                    previewLetter
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-200 transition hover:border-[color:var(--anya-blush)]/40 hover:text-white"
                    type="button"
                    onClick={() => fileRef.current?.click()}
                  >
                    <ImagePlus className="size-3.5" />
                    Upload
                  </button>
                  <button
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-200 transition hover:border-white/20"
                    type="button"
                    onClick={() => setAvatarUrl("")}
                  >
                    <UserRound className="size-3.5" />
                    Initials
                  </button>
                </div>
                <input
                  ref={fileRef}
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  type="file"
                  onChange={(event) => {
                    void onPickFile(event.target.files?.[0] ?? null);
                    event.target.value = "";
                  }}
                />
              </div>

              <div className="grid grid-cols-6 gap-2">
                {AVATAR_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    aria-label={preset.label}
                    className={clsx(
                      "aspect-square overflow-hidden rounded-lg border transition",
                      avatarUrl === preset.url
                        ? "border-[color:var(--anya-blush)] ring-2 ring-[color:var(--anya-blush)]/35"
                        : "border-white/10 hover:border-white/25",
                    )}
                    type="button"
                    onClick={() => setAvatarUrl(preset.url)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      alt=""
                      className="size-full object-cover"
                      src={preset.url}
                    />
                  </button>
                ))}
              </div>
            </div>
          </Step>

          <Step>
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-medium text-white">
                  Display name
                </h3>
                <p className="mt-1 text-sm text-zinc-400">
                  Shown in the sidebar. Your login username (
                  <span className="text-zinc-300">{user.username}</span>) stays
                  the same.
                </p>
              </div>
              <label className="block">
                <span className="sr-only">Display name</span>
                <input
                  autoComplete="nickname"
                  className="w-full rounded-xl border border-white/10 bg-black/35 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-[color:var(--anya-blush)]/50 focus:ring-2 focus:ring-[color:var(--anya-blush)]/20"
                  maxLength={40}
                  placeholder="How should we address you?"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                />
              </label>
            </div>
          </Step>

          <Step>
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-medium text-white">
                  Dashboard color
                </h3>
                <p className="mt-1 text-sm text-zinc-400">
                  Pick an accent for highlights and focus states.
                </p>
              </div>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                {DASHBOARD_ACCENT_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    aria-label={preset.label}
                    className={clsx(
                      "flex aspect-square items-center justify-center rounded-xl border transition",
                      accent.toLowerCase() === preset.value.toLowerCase()
                        ? "border-white ring-2 ring-white/30"
                        : "border-white/10 hover:border-white/25",
                    )}
                    style={{ backgroundColor: preset.value }}
                    title={preset.label}
                    type="button"
                    onClick={() => applyAccentPreview(preset.value)}
                  />
                ))}
              </div>
              <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/25 px-3 py-2">
                <span className="text-xs text-zinc-400">Custom</span>
                <input
                  className="size-8 cursor-pointer rounded border-0 bg-transparent p-0"
                  type="color"
                  value={accent}
                  onChange={(event) => applyAccentPreview(event.target.value)}
                />
                <span className="font-mono text-xs text-zinc-300">{accent}</span>
              </label>
              <div
                className="rounded-xl border border-white/10 px-3 py-2 text-xs text-zinc-300"
                style={{
                  borderColor: `color-mix(in srgb, ${accent} 45%, transparent)`,
                  boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${accent} 18%, transparent)`,
                }}
              >
                Preview · accent{" "}
                <span style={{ color: accent }} className="font-medium">
                  applied live
                </span>
              </div>
            </div>
          </Step>
        </Stepper>

        {error ? (
          <p className="mt-3 text-center text-sm text-rose-300">{error}</p>
        ) : null}
      </div>
    </div>
  );
}
