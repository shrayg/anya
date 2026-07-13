"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import NextLink from "next/link";
import Image from "next/image";
import clsx from "clsx";
import { ArrowLeft, Check, Clock, Copy, LogIn, RefreshCw, UserPlus } from "lucide-react";

import { HomeBackground } from "@/components/home-background";
import { siteLogoClassName, siteLogoSrc } from "@/config/branding";
import { siteConfig } from "@/config/site";
import {
  generateStrongPassword,
  MIN_PASSWORD_LENGTH,
  MIN_USERNAME_LENGTH,
  passwordRequirementsHint,
} from "@/lib/password-policy";
import { getAppLandingPath } from "@/lib/plans";

function AuthForm() {
  const searchParams = useSearchParams();
  const initialAction = searchParams.get("action") === "register" ? "register" : "login";
  const [mode, setMode] = useState<"login" | "register">(initialAction);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setMode(searchParams.get("action") === "register" ? "register" : "login");
  }, [searchParams]);

  const handleGeneratePassword = async () => {
    const next = generateStrongPassword(16);
    setPassword(next);
    setShowPassword(false);
    setCopied(false);

    try {
      await navigator.clipboard.writeText(next);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard may be blocked; password is still filled in.
    }
  };

  const handleCopyPassword = async () => {
    if (!password) return;

    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy password. Select and copy it manually.");
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Something went wrong.");
        return;
      }

      const meResponse = await fetch("/api/auth/me", {
        cache: "no-store",
        credentials: "include",
      });
      const meData = await meResponse.json();

      if (!meResponse.ok || !meData?.authenticated) {
        setError("Login succeeded but the session could not be created. Refresh and try again.");
        return;
      }

      const landingPath = getAppLandingPath({
        ...(meData.user ?? data.user ?? {}),
        canManageWorkspace: meData.canManageWorkspace,
      });

      const plan = searchParams.get("plan");
      const interval = searchParams.get("interval") ?? "monthly";

      if (mode === "register" && plan && plan !== "enterprise" && plan !== "free") {
        await fetch("/api/billing/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            type: "subscription",
            planId: plan,
            interval: interval === "annual" ? "annual" : "monthly",
          }),
        }).catch(() => undefined);
      }

      window.location.assign(landingPath);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="relative z-20 flex min-h-[calc(100vh-12rem)] items-center justify-center px-4 py-12">
      <div className="ui-panel ui-panel--auth">
        <div className="mb-8 flex items-center gap-4">
          <Image
            alt={`${siteConfig.name} logo`}
            className={clsx(siteLogoClassName, "size-14 md:size-16")}
            height={64}
            src={siteLogoSrc}
            unoptimized
            width={64}
          />
          <div>
            <p className="text-xl font-semibold text-white md:text-2xl">{siteConfig.name}</p>
            <p className="text-sm text-zinc-500 md:text-base">
              {mode === "login" ? "Welcome back" : "Create your account"}
            </p>
          </div>
        </div>

        <div className="ui-tabs mb-8">
          <button
            className={clsx("ui-tab ui-tab--lg", mode === "login" && "ui-tab--active")}
            onClick={() => setMode("login")}
            type="button"
          >
            Login
          </button>
          <button
            className={clsx("ui-tab ui-tab--lg", mode === "register" && "ui-tab--active")}
            onClick={() => setMode("register")}
            type="button"
          >
            Register
          </button>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div>
            <label className="ui-label" htmlFor="username">
              Username
            </label>
            <input
              id="username"
              autoComplete="username"
              className="ui-input ui-input--lg"
              minLength={MIN_USERNAME_LENGTH}
              maxLength={32}
              pattern="[A-Za-z0-9_]+"
              onChange={(event) => setUsername(event.target.value)}
              placeholder="John Doe"
              required
              value={username}
            />
            {mode === "register" && (
              <p className="mt-2 text-xs text-zinc-500">
                At least {MIN_USERNAME_LENGTH} characters. Letters, numbers, and underscores only.
              </p>
            )}
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <label className="ui-label mb-0" htmlFor="password">
                Password
              </label>
              {mode === "register" && (
                <div className="flex items-center gap-2">
                  <button
                    className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-zinc-400 transition hover:bg-white/5 hover:text-white"
                    onClick={handleGeneratePassword}
                    type="button"
                  >
                    <RefreshCw className="size-3.5" />
                    Generate
                  </button>
                  <button
                    className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-zinc-400 transition hover:bg-white/5 hover:text-white disabled:opacity-40"
                    disabled={!password}
                    onClick={handleCopyPassword}
                    type="button"
                  >
                    {copied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
              )}
            </div>
            <input
              id="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              className="ui-input ui-input--lg font-mono"
              minLength={mode === "register" ? MIN_PASSWORD_LENGTH : 1}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••••••"
              required
              type={showPassword && mode === "register" ? "text" : "password"}
              value={password}
            />
            {mode === "register" && (
              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="text-xs text-zinc-500">{passwordRequirementsHint()}</p>
                <button
                  className="shrink-0 text-xs text-zinc-400 underline-offset-2 hover:text-white hover:underline"
                  onClick={() => setShowPassword((value) => !value)}
                  type="button"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            )}
          </div>

          {error && (
            <p className="rounded-lg border border-red-400/20 bg-red-400/8 px-4 py-3 text-sm text-red-200 md:text-base">
              {error}
            </p>
          )}

          <button
            className="ui-btn ui-btn-primary ui-btn-primary--lg w-full"
            disabled={isSubmitting}
            type="submit"
          >
            {mode === "login" ? <LogIn className="size-5" /> : <UserPlus className="size-5" />}
            {isSubmitting ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
          </button>
        </form>

        <div className="mt-8 text-center">
          <NextLink className="ui-link inline-flex items-center gap-2" href="/">
            <ArrowLeft className="size-4" />
            Back to home
          </NextLink>
        </div>
      </div>
    </section>
  );
}

export default function AuthPage() {
  return (
    <>
      <HomeBackground />
      <Suspense
        fallback={
          <div className="relative z-20 flex min-h-[calc(100vh-12rem)] items-center justify-center text-sm text-zinc-500">
            <Clock className="mr-2 size-4 animate-spin text-anya-accent" />
            Loading…
          </div>
        }
      >
        <AuthForm />
      </Suspense>
    </>
  );
}
