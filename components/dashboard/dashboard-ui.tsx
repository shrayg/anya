"use client";

import type { LucideIcon } from "lucide-react";

import clsx from "clsx";

import { SpecularButton } from "@/components/ui/specular-button";

export function PageHeader({
  title,
  subtitle,
  badge,
}: {
  title: string;
  subtitle?: string;
  badge?: string;
}) {
  return (
    <header className="dash-page-header">
      {badge && <span className="dash-badge">{badge}</span>}
      <h1 className="dash-title">{title}</h1>
      {subtitle && <p className="dash-subtitle">{subtitle}</p>}
    </header>
  );
}

export function DashPanel({
  children,
  className,
  glow,
}: {
  children: React.ReactNode;
  className?: string;
  glow?: "teal" | "amber" | "violet" | "pink";
}) {
  return (
    <section
      className={clsx(
        "dash-panel",
        glow === "teal" && "dash-panel-glow-teal",
        glow === "amber" && "dash-panel-glow-amber",
        glow === "violet" && "dash-panel-glow-violet",
        glow === "pink" && "dash-panel-glow-pink",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  accent = "teal",
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon: LucideIcon;
  accent?: "teal" | "amber" | "violet" | "rose";
  className?: string;
}) {
  return (
    <div className={clsx("dash-stat", `dash-stat-${accent}`, className)}>
      <div className="dash-stat-top">
        <p className="dash-stat-label">{label}</p>
        <div className="dash-stat-icon">
          <Icon className="size-4" />
        </div>
      </div>
      <p className="dash-stat-value">{value}</p>
      {hint && <p className="dash-stat-hint">{hint}</p>}
    </div>
  );
}

export function DashButton({
  children,
  variant = "primary",
  className,
  type = "button",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  const classes = clsx("dash-btn", `dash-btn-${variant}`, className);

  // Primary / secondary labeled CTAs get Specular rim; ghost/danger stay plain
  // (cancel rows, dense chrome — avoid excess WebGL contexts).
  if (variant === "primary" || variant === "secondary") {
    return (
      <SpecularButton
        accent={variant === "primary"}
        className={classes}
        size="sm"
        type={type}
        {...props}
      >
        {children}
      </SpecularButton>
    );
  }

  return (
    <button className={classes} type={type} {...props}>
      {children}
    </button>
  );
}

export function DashInput({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={clsx("dash-input", className)} {...props} />;
}

export function DashTextarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={clsx("dash-textarea", className)} {...props} />;
}

export function DashSelect({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={clsx("dash-select", className)} {...props}>
      {children}
    </select>
  );
}
