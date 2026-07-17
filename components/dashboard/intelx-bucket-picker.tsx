"use client";

import clsx from "clsx";
import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  INTELX_BUCKET_LABELS,
  INTELX_BUCKETS,
  type IntelxBucket,
} from "@/lib/intelx-buckets";

export function IntelxBucketPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: IntelxBucket;
  onChange: (bucket: IntelxBucket) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="intelx-bucket" ref={rootRef}>
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        className="intelx-bucket-trigger"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span className="min-w-0 truncate">
          <span className="text-zinc-500">Bucket · </span>
          {INTELX_BUCKET_LABELS[value]}
        </span>
        <ChevronDown
          className={clsx(
            "size-3.5 shrink-0 text-zinc-500 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open ? (
        <ul className="intelx-bucket-menu" role="listbox">
          {INTELX_BUCKETS.map((bucket) => {
            const selected = bucket === value;
            return (
              <li key={bucket}>
                <button
                  aria-selected={selected}
                  className={clsx(
                    "intelx-bucket-option",
                    selected && "intelx-bucket-option--selected",
                  )}
                  onClick={() => {
                    onChange(bucket);
                    setOpen(false);
                  }}
                  role="option"
                  type="button"
                >
                  <span>{INTELX_BUCKET_LABELS[bucket]}</span>
                  <span className="font-mono text-[0.65rem] text-zinc-500">
                    {bucket}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
