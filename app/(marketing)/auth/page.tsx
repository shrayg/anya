"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import NextLink from "next/link";
import Image from "next/image";
import clsx from "clsx";
import { ArrowLeft, Clock, LogIn, UserPlus } from "lucide-react";

import { HomeBackground } from "@/components/home-background";
import { siteLogoClassName, siteLogoSrc } from "@/config/branding";
import { siteConfig } from "@/config/site";
import { MIN_PASSWORD_LENGTH, MIN_USERNAME_LENGTH } from "@/lib/password-policy";

function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialAction = searchParams.get("action") === "register" ? "register" : "login";
  const [mode, setMode] = useState<"login" | "register">(initialAction);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setMode(searchParams.get("action") === "register" ? "register" : "login");
  }, [searchParams]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Something went wrong.");
        return;
      }

      router.push(siteConfig.defaultWorkspacePath);
      router.refresh();
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
              onChange={(event) => setUsername(event.target.value)}
              placeholder="your handle"
              required
              value={username}
            />
          </div>

          <div>
            <label className="ui-label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              className="ui-input ui-input--lg"
              minLength={MIN_PASSWORD_LENGTH}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              required
              type="password"
              value={password}
            />
            {mode === "register" && (
              <p className="mt-2 text-xs text-zinc-500">
                At least {MIN_PASSWORD_LENGTH} characters.
              </p>
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
