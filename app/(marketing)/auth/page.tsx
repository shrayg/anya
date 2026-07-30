"use client";

import { Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import NextLink from "next/link";
import Image from "next/image";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  Clock,
  Copy,
  LogIn,
  RefreshCw,
  UserPlus,
} from "lucide-react";

import { HomeBackground } from "@/components/home-background";
import {
  isTurnstileEnabledOnClient,
  TurnstileWidget,
} from "@/components/turnstile-widget";
import { LiquidButton } from "@/components/ui/liquid-glass-button";
import { siteLogoClassName, siteLogoSrc } from "@/config/branding";
import { siteConfig } from "@/config/site";
import { apiFetch } from "@/lib/csrf-client";
import {
  generateStrongPassword,
  MIN_PASSWORD_LENGTH,
  MIN_USERNAME_LENGTH,
  passwordRequirementsHint,
  validatePassword,
  validateUsernameForRegistration,
} from "@/lib/password-policy";
import { getAppLandingPath, normalizePlanId } from "@/lib/plans";

async function startPlanCheckout(
  plan: string,
  interval: string,
  method: string | null = null,
) {
  const planId = normalizePlanId(plan);

  if (!planId || planId === "free") {
    return { ok: false as const, reason: "invalid_plan" };
  }

  const provider =
    method === "crypto" || method === "oxapay" ? "oxapay" : "square";

  const checkoutRes = await apiFetch("/api/billing/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "subscription",
      planId,
      interval: interval === "annual" ? "annual" : "monthly",
      provider,
    }),
  }).catch(() => null);

  if (!checkoutRes) {
    return { ok: false as const, reason: "network" };
  }

  const checkoutData = await checkoutRes.json().catch(() => ({}));

  if (!checkoutRes.ok) {
    return {
      ok: false as const,
      reason:
        typeof checkoutData.error === "string"
          ? checkoutData.error
          : "checkout_failed",
    };
  }

  if (typeof checkoutData.url === "string" && checkoutData.url) {
    return { ok: true as const, url: checkoutData.url as string };
  }

  return { ok: false as const, reason: "missing_url" };
}

function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialAction =
    searchParams.get("action") === "register" ? "register" : "login";
  const [mode, setMode] = useState<"login" | "register">(initialAction);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileRequired = isTurnstileEnabledOnClient();
  const modeTabsRef = useRef<HTMLDivElement>(null);
  const loginTabRef = useRef<HTMLButtonElement>(null);
  const registerTabRef = useRef<HTMLButtonElement>(null);
  const modePillRef = useRef<HTMLSpanElement>(null);
  const modePillPlacedRef = useRef(false);
  const modeRef = useRef(mode);
  modeRef.current = mode;

  const measureModePill = useCallback(() => {
    const tabs = modeTabsRef.current;
    const el = modePillRef.current;
    const tab =
      modeRef.current === "login"
        ? loginTabRef.current
        : registerTabRef.current;

    if (!el) return;

    // Keep last geometry if a tab is briefly missing — never unmount.
    if (!tabs || !tab) {
      el.style.opacity = "0";
      return;
    }

    const tabsRect = tabs.getBoundingClientRect();
    const tabRect = tab.getBoundingClientRect();
    const left = tabRect.left - tabsRect.left;
    const top = tabRect.top - tabsRect.top;
    const width = tabRect.width;
    const height = tabRect.height;

    if (!modePillPlacedRef.current) {
      el.style.transition = "none";
      el.style.transform = `translate3d(${left}px,${top}px,0)`;
      el.style.width = `${width}px`;
      el.style.height = `${height}px`;
      el.style.opacity = "1";
      void el.offsetWidth;
      el.style.transition = "";
      modePillPlacedRef.current = true;
      return;
    }

    el.style.transform = `translate3d(${left}px,${top}px,0)`;
    el.style.width = `${width}px`;
    el.style.height = `${height}px`;
    el.style.opacity = "1";
  }, []);

  useLayoutEffect(() => {
    measureModePill();
    const raf = requestAnimationFrame(() => measureModePill());
    return () => cancelAnimationFrame(raf);
  }, [measureModePill, mode]);

  useEffect(() => {
    const tabs = modeTabsRef.current;
    if (!tabs || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => measureModePill());
    observer.observe(tabs);
    window.addEventListener("resize", measureModePill);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measureModePill);
    };
  }, [measureModePill]);

  useEffect(() => {
    setMode(searchParams.get("action") === "register" ? "register" : "login");
  }, [searchParams]);

  useEffect(() => {
    // Mint CSRF cookie early so login/register POSTs succeed.
    void apiFetch("/api/auth/csrf", { method: "GET", cache: "no-store" }).catch(
      () => null,
    );
  }, []);

  const switchMode = (next: "login" | "register") => {
    setMode(next);
    setError("");
    setInfo("");
    setTurnstileToken("");
    const params = new URLSearchParams(searchParams.toString());

    params.set("action", next);
    router.replace(`/auth?${params.toString()}`, { scroll: false });
  };

  const handleGeneratePassword = async () => {
    const next = generateStrongPassword(16);

    setPassword(next);
    setShowPassword(true);
    setCopied(false);
    setError("");

    try {
      await navigator.clipboard.writeText(next);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard may be blocked; password is still filled and visible.
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
    setInfo("");
    setIsSubmitting(true);

    try {
      if (mode === "register") {
        if (!acceptedLegal) {
          setError(
            "Please agree to the Terms, Privacy Policy, and Acceptable Use Policy.",
          );

          return;
        }
        const usernameError = validateUsernameForRegistration(username);

        if (usernameError) {
          setError(usernameError);

          return;
        }
        const passwordError = validatePassword(password);

        if (passwordError) {
          setError(passwordError);

          return;
        }
      }

      if (turnstileRequired && !turnstileToken) {
        setError("Complete the security check and try again.");

        return;
      }

      const endpoint =
        mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const response = await apiFetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          password,
          turnstileToken: turnstileToken || undefined,
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error || "Something went wrong.");
        setTurnstileToken("");

        return;
      }

      // Brief delay so the browser commits Set-Cookie before the next fetch.
      await new Promise((resolve) => window.setTimeout(resolve, 50));

      const meResponse = await fetch("/api/auth/me", {
        cache: "no-store",
        credentials: "include",
      });
      const meData = await meResponse.json().catch(() => ({}));

      if (!meResponse.ok || !meData?.authenticated) {
        if (meResponse.status >= 500) {
          setError(
            "Signed in, but session verification failed on the server. Your database may be out of sync — run `npx prisma db push` and restart the dev server.",
          );
        } else {
          setError(
            "Signed in, but your session cookie was not saved. Check that third-party cookies aren’t blocked, then refresh and try again.",
          );
        }

        return;
      }

      const landingPath = getAppLandingPath({
        ...(meData.user ?? data.user ?? {}),
        canManageWorkspace: meData.canManageWorkspace,
      });

      const plan = searchParams.get("plan");
      const interval = searchParams.get("interval") ?? "monthly";
      const method = searchParams.get("method");

      if (plan && plan !== "free") {
        setInfo("Account ready — opening secure checkout…");
        const checkout = await startPlanCheckout(plan, interval, method);

        if (checkout.ok) {
          window.location.assign(checkout.url);

          return;
        }

        setError(
          typeof checkout.reason === "string" && checkout.reason.length > 8
            ? `${checkout.reason} Your account was created — open Pricing to finish checkout.`
            : "Account ready, but checkout could not start. Opening Pricing…",
        );
        window.setTimeout(() => {
          window.location.assign("/pricing");
        }, 1400);

        return;
      }

      window.location.assign(landingPath);
    } catch {
      setError(
        "Could not reach the server. Check your connection and try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.section
      animate={{ opacity: 1 }}
      className="brutal-page brutal-auth-page relative z-20 flex w-full flex-1 items-center justify-center px-4"
      initial={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        layout
        animate={{
          opacity: 1,
          scale: 1,
          y: 0,
        }}
        className="ui-panel ui-panel--auth"
        initial={{
          opacity: 0,
          scale: 0.985,
          y: 28,
        }}
        transition={{ duration: 0.58, ease: [0.22, 1, 0.36, 1] }}
      >
        <motion.div
          animate={{ opacity: 1, x: 0 }}
          className="mb-8 flex items-center gap-4"
          initial={{ opacity: 0, x: -18 }}
          transition={{ delay: 0.24, duration: 0.4 }}
        >
          <Image
            unoptimized
            alt={`${siteConfig.name} logo`}
            className={clsx(siteLogoClassName, "size-14 md:size-16")}
            height={64}
            src={siteLogoSrc}
            width={64}
          />
          <div>
            <p className="font-semibold tracking-tight text-white text-[1.35rem] md:text-[1.65rem]">
              {siteConfig.name}
            </p>
            <p className="mt-0.5 text-sm text-zinc-400 md:text-base">
              {mode === "login" ? "Welcome back" : "Create your account"}
            </p>
          </div>
        </motion.div>

        <motion.div
          ref={modeTabsRef}
          animate={{ opacity: 1, y: 0 }}
          className="ui-tabs ui-tabs--auth relative mb-8"
          initial={{ opacity: 0, y: 10 }}
          transition={{ delay: 0.32, duration: 0.38 }}
        >
          <span
            ref={modePillRef}
            aria-hidden
            className="auth-mode-pill"
            style={{
              transform: "translate3d(0,0,0)",
              width: 0,
              height: 0,
              opacity: 0,
            }}
          />
          <button
            ref={loginTabRef}
            className={clsx(
              "ui-tab ui-tab--lg ui-tab--auth",
              mode === "login" && "ui-tab--active",
            )}
            type="button"
            onClick={() => switchMode("login")}
          >
            <span className="relative z-10">Login</span>
          </button>
          <button
            ref={registerTabRef}
            className={clsx(
              "ui-tab ui-tab--lg ui-tab--auth",
              mode === "register" && "ui-tab--active",
            )}
            type="button"
            onClick={() => switchMode("register")}
          >
            <span className="relative z-10">Register</span>
          </button>
        </motion.div>

        <AnimatePresence initial mode="wait">
          <motion.form
            key={mode}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-5"
            exit={{ opacity: 0, x: -12 }}
            initial={{ opacity: 0, x: 12 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            onSubmit={handleSubmit}
          >
            <div>
              <label className="ui-label" htmlFor="username">
                Username
              </label>
              <input
                required
                autoCapitalize="none"
                autoComplete="username"
                autoCorrect="off"
                className="ui-input ui-input--lg"
                id="username"
                maxLength={32}
                minLength={mode === "register" ? MIN_USERNAME_LENGTH : 1}
                pattern="[A-Za-z0-9_]+"
                placeholder="JohnDoe"
                spellCheck={false}
                title="Letters, numbers, and underscores only"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
              />
              {mode === "register" && (
                <p className="mt-2 text-xs text-zinc-500">
                  At least {MIN_USERNAME_LENGTH} characters. Letters, numbers,
                  and underscores only. Usernames are case-insensitive.
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
                      type="button"
                      onClick={handleGeneratePassword}
                    >
                      <RefreshCw className="size-3.5" />
                      Generate
                    </button>
                    <button
                      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-zinc-400 transition hover:bg-white/5 hover:text-white disabled:opacity-40"
                      disabled={!password}
                      type="button"
                      onClick={handleCopyPassword}
                    >
                      {copied ? (
                        <Check className="size-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                )}
              </div>
              <input
                required
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                className="ui-input ui-input--lg font-mono"
                id="password"
                minLength={mode === "register" ? MIN_PASSWORD_LENGTH : 1}
                placeholder="••••••••••••"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <div className="mt-2 flex items-center justify-between gap-3">
                {mode === "register" ? (
                  <p className="text-xs text-zinc-500">
                    {passwordRequirementsHint()}
                  </p>
                ) : (
                  <span />
                )}
                <button
                  className="shrink-0 text-xs text-zinc-400 underline-offset-2 hover:text-white hover:underline"
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {turnstileRequired && (
              <TurnstileWidget
                key={mode}
                className="flex justify-center"
                onExpire={() => setTurnstileToken("")}
                onToken={setTurnstileToken}
              />
            )}

            {info && (
              <p className="rounded-lg border border-emerald-400/20 bg-emerald-400/8 px-4 py-3 text-sm text-emerald-100 md:text-base">
                {info}
              </p>
            )}

            {error && (
              <p className="rounded-lg border border-red-400/20 bg-red-400/8 px-4 py-3 text-sm text-red-200 md:text-base">
                {error}
              </p>
            )}

            {mode === "register" && (
              <label className="flex items-start gap-3 text-left text-xs leading-5 text-zinc-400">
                <input
                  required
                  checked={acceptedLegal}
                  className="mt-0.5 size-4 shrink-0 rounded border-white/20 bg-black accent-[var(--anya-blush)]"
                  type="checkbox"
                  onChange={(event) => setAcceptedLegal(event.target.checked)}
                />
                <span>
                  I agree to the{" "}
                  <NextLink
                    className="text-zinc-200 underline-offset-2 hover:underline"
                    href="/terms"
                  >
                    Terms of Service
                  </NextLink>
                  ,{" "}
                  <NextLink
                    className="text-zinc-200 underline-offset-2 hover:underline"
                    href="/privacy"
                  >
                    Privacy Policy
                  </NextLink>
                  , and{" "}
                  <NextLink
                    className="text-zinc-200 underline-offset-2 hover:underline"
                    href="/acceptable-use"
                  >
                    Acceptable Use Policy
                  </NextLink>
                  . I confirm I am 18+ and will use Anya only for lawful
                  purposes.
                </span>
              </label>
            )}

            <LiquidButton
              className="liquid-glass-button--accent ui-btn-primary--lg h-12 w-full text-[0.95rem]"
              disabled={
                isSubmitting ||
                (mode === "register" && !acceptedLegal) ||
                (turnstileRequired && !turnstileToken)
              }
              type="submit"
            >
              {mode === "login" ? (
                <LogIn className="size-5" />
              ) : (
                <UserPlus className="size-5" />
              )}
              {isSubmitting
                ? "Please wait…"
                : mode === "login"
                  ? "Log in"
                  : "Create account"}
            </LiquidButton>
          </motion.form>
        </AnimatePresence>

        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="mt-8 text-center"
          initial={{ opacity: 0, y: 8 }}
          transition={{ delay: 0.48, duration: 0.34 }}
        >
          <NextLink className="ui-link inline-flex items-center gap-2" href="/">
            <ArrowLeft className="size-4" />
            Back to home
          </NextLink>
        </motion.div>
      </motion.div>
    </motion.section>
  );
}

export default function AuthPage() {
  return (
    <>
      <HomeBackground />
      <Suspense
        fallback={
          <div className="brutal-auth-page relative z-20 flex w-full flex-1 items-center justify-center text-sm text-zinc-500">
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
