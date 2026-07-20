"use client";

import clsx from "clsx";
import { Check, Copy } from "lucide-react";
import { useState, type MouseEvent } from "react";

type ResultCopyButtonProps = {
  text: string;
  label?: string;
  className?: string;
  /** Compact icon-only control for dense card headers. */
  compact?: boolean;
};

export function ResultCopyButton({
  text,
  label = "Copy",
  className,
  compact = false,
}: ResultCopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const payload = text.trim();

    if (!payload) return;

    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button
      aria-label={copied ? "Copied" : label}
      className={clsx(
        "anya-result-copy",
        compact && "anya-result-copy--compact",
        copied && "anya-result-copy--done",
        className,
      )}
      type="button"
      onClick={handleCopy}
    >
      {copied ? (
        <>
          <Check className="size-3.5" />
          {compact ? null : <span>Copied</span>}
        </>
      ) : (
        <>
          <Copy className="size-3.5" />
          {compact ? null : <span>{label}</span>}
        </>
      )}
    </button>
  );
}
