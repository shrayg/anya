"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import clsx from "clsx";

import { PLAN_DEFINITIONS, type PlanId } from "@/lib/plans";

type PlanPickerProps = {
  value: PlanId;
  onChange: (plan: PlanId) => void;
  disabled?: boolean;
};

export function PlanPicker({ value, onChange, disabled }: PlanPickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selected = PLAN_DEFINITIONS.find((plan) => plan.id === value);

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

  return (
    <div ref={containerRef} className="relative min-w-[11rem]">
      <button
        className={clsx(
          "flex w-full items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-left text-sm text-white transition",
          "hover:border-white/20 hover:bg-white/[0.07]",
          open && "border-white/25 bg-white/[0.08]",
          disabled && "cursor-not-allowed opacity-50",
        )}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span className="font-medium">{selected?.name ?? value}</span>
        <ChevronDown
          className={clsx(
            "size-4 shrink-0 text-zinc-400 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-50 mt-1.5 overflow-hidden rounded-lg border border-white/10 bg-zinc-950/95 p-1 shadow-2xl shadow-black/40 backdrop-blur-xl">
          {PLAN_DEFINITIONS.map((plan) => {
            const active = plan.id === value;

            return (
              <button
                key={plan.id}
                className={clsx(
                  "flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition",
                  active
                    ? "bg-white/10 text-white"
                    : "text-zinc-300 hover:bg-white/[0.06] hover:text-white",
                )}
                onClick={() => {
                  onChange(plan.id);
                  setOpen(false);
                }}
                type="button"
              >
                <span>{plan.name}</span>
                {active && <Check className="size-4 text-emerald-300" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
