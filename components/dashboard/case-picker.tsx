"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import clsx from "clsx";

type CaseOption = {
  id: number;
  title: string;
  subjectName: string;
};

type CasePickerProps = {
  value: string;
  onChange: (caseId: string) => void;
  options: CaseOption[];
  disabled?: boolean;
  placeholder?: string;
};

export function CasePicker({
  value,
  onChange,
  options,
  disabled,
  placeholder = "Save to case…",
}: CasePickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => String(option.id) === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isDisabled = disabled || options.length === 0;

  return (
    <div ref={containerRef} className="relative min-w-[12rem]">
      <button
        className={clsx(
          "ui-btn ui-btn-ghost w-full justify-between !px-3 !py-2 text-left text-sm font-normal",
          isDisabled && "cursor-not-allowed opacity-50",
        )}
        disabled={isDisabled}
        type="button"
        onClick={() => setOpen((current) => !current)}
      >
        <span
          className={clsx(
            "truncate",
            selected ? "font-medium text-white" : "text-zinc-400",
          )}
        >
          {selected
            ? `${selected.title} — ${selected.subjectName}`
            : placeholder}
        </span>
        <ChevronDown
          className={clsx(
            "size-4 shrink-0 text-zinc-400 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && options.length > 0 && (
        <div className="absolute left-0 right-0 z-50 mt-1.5 max-h-60 overflow-y-auto rounded-lg border border-white/10 bg-zinc-950/95 p-1 shadow-2xl shadow-black/40 backdrop-blur-xl">
          {options.map((option) => {
            const optionValue = String(option.id);
            const active = optionValue === value;

            return (
              <button
                key={option.id}
                className={clsx(
                  "flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm transition",
                  active
                    ? "bg-white/10 text-white"
                    : "text-zinc-300 hover:bg-white/[0.06] hover:text-white",
                )}
                type="button"
                onClick={() => {
                  onChange(optionValue);
                  setOpen(false);
                }}
              >
                <span className="truncate">
                  {option.title} — {option.subjectName}
                </span>
                {active && (
                  <Check className="size-4 shrink-0 text-emerald-300" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
