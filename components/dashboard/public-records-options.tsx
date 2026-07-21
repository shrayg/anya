"use client";

import {
  DEFAULT_PUBLIC_RECORDS_SOURCES,
  PUBLIC_RECORDS_SOURCE_OPTIONS,
  type PublicRecordsSourceOptionId,
} from "@/lib/public-records/source-options";

export function PublicRecordsOptionsPanel({
  open,
  selected,
  onChange,
  onClose,
}: {
  open: boolean;
  selected: PublicRecordsSourceOptionId[];
  onChange: (next: PublicRecordsSourceOptionId[]) => void;
  onClose: () => void;
}) {
  if (!open) return null;

  const selectedSet = new Set(selected);
  const allOn =
    selected.length === DEFAULT_PUBLIC_RECORDS_SOURCES.length &&
    DEFAULT_PUBLIC_RECORDS_SOURCES.every((id) => selectedSet.has(id));

  const toggle = (id: PublicRecordsSourceOptionId) => {
    if (selectedSet.has(id)) {
      const next = selected.filter((row) => row !== id);

      onChange(next.length > 0 ? next : [id]);
      return;
    }

    onChange([...selected, id]);
  };

  return (
    <div className="mt-3 rounded-xl border border-white/10 bg-black/40 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
          Sources to search
        </p>
        <div className="flex items-center gap-2">
          <button
            className="text-xs text-zinc-400 hover:text-zinc-200"
            type="button"
            onClick={() =>
              onChange(
                allOn
                  ? [DEFAULT_PUBLIC_RECORDS_SOURCES[0]]
                  : [...DEFAULT_PUBLIC_RECORDS_SOURCES],
              )
            }
          >
            {allOn ? "Clear to one" : "Select all"}
          </button>
          <button
            className="text-xs text-zinc-500 hover:text-zinc-300"
            type="button"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {PUBLIC_RECORDS_SOURCE_OPTIONS.map((option) => {
          const checked = selectedSet.has(option.id);

          return (
            <label
              key={option.id}
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2.5 hover:border-white/15"
            >
              <input
                checked={checked}
                className="mt-0.5 size-3.5 accent-sky-400"
                type="checkbox"
                onChange={() => toggle(option.id)}
              />
              <span className="min-w-0">
                <span className="block text-sm text-zinc-100">
                  {option.label}
                </span>
                <span className="mt-0.5 block text-[11px] leading-snug text-zinc-500">
                  {option.description}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
