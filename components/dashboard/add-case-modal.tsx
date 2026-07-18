"use client";

import { apiFetch } from "@/lib/csrf-client";

import { useEffect, useState } from "react";
import { Check, Plus, Search, X } from "lucide-react";

import { DashButton, DashInput, DashPanel } from "@/components/dashboard/dashboard-ui";
import { formatDate, formatTime } from "@/lib/format-datetime";
import type { SearchHistoryItem } from "@/lib/case-mind-map";

type AddCaseModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (caseId: number) => void;
};

function parseSearchLabel(query: string, searchType: string) {
  const match = query.match(/^\[([^\]]+)\]\s*(.*)$/);
  if (match) {
    return { type: match[1], label: match[2] || query };
  }
  return { type: searchType, label: query };
}

export function AddCaseModal({ open, onClose, onCreated }: AddCaseModalProps) {
  const [caseName, setCaseName] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [searches, setSearches] = useState<SearchHistoryItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");

  useEffect(() => {
    if (!open) return;

    setCaseName("");
    setSubjectName("");
    setSelectedIds([]);
    setFilter("");
    setError("");
    setLoading(true);

    fetch("/api/searches")
      .then((response) => response.json())
      .then((data) => {
        if (Array.isArray(data.searches)) {
          setSearches(data.searches);
        }
      })
      .catch(() => setError("Could not load search history."))
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  const filtered = searches.filter((search) => {
    const { type, label } = parseSearchLabel(search.query, search.searchType);
    const haystack = `${type} ${label}`.toLowerCase();
    return haystack.includes(filter.toLowerCase());
  });

  const toggleSearch = (id: number) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const handleCreate = async () => {
    const title = caseName.trim();
    if (!title) {
      setError("Give your case a name.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await apiFetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          subjectName: subjectName.trim() || title,
          searchIds: selectedIds,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to create case.");
        return;
      }

      onCreated(data.case.id);
      onClose();
    } catch {
      setError("Could not create case.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        aria-label="Close"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        type="button"
      />
      <DashPanel className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto" glow="violet">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-white">Add case</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Name your case and attach past searches to build the mind map.
            </p>
          </div>
          <button
            className="rounded-lg p-2 text-zinc-500 transition hover:bg-white/5 hover:text-white"
            onClick={onClose}
            type="button"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="dash-field-label" htmlFor="add-case-name">
              Case name
            </label>
            <DashInput
              autoFocus
              id="add-case-name"
              onChange={(event) => setCaseName(event.target.value)}
              placeholder="e.g. Operation Nightfall"
              value={caseName}
            />
          </div>

          <div>
            <label className="dash-field-label" htmlFor="add-case-subject">
              Subject name (optional)
            </label>
            <DashInput
              id="add-case-subject"
              onChange={(event) => setSubjectName(event.target.value)}
              placeholder="Person or target alias"
              value={subjectName}
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="dash-field-label mb-0">Past searches</label>
              <span className="text-xs text-violet-300">{selectedIds.length} selected</span>
            </div>
            <div className="relative mb-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
              <DashInput
                className="dash-input--icon"
                onChange={(event) => setFilter(event.target.value)}
                placeholder="Filter searches..."
                value={filter}
              />
            </div>

            <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border border-white/8 bg-black/30 p-2">
              {loading ? (
                <p className="px-2 py-6 text-center text-sm text-zinc-500">Loading searches...</p>
              ) : filtered.length === 0 ? (
                <p className="px-2 py-6 text-center text-sm text-zinc-500">
                  No searches yet. Run lookups from the dashboard first.
                </p>
              ) : (
                filtered.map((search) => {
                  const { type, label } = parseSearchLabel(search.query, search.searchType);
                  const selected = selectedIds.includes(search.id);

                  return (
                    <button
                      key={search.id}
                      className={`flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                        selected
                          ? "border-violet-500/40 bg-violet-500/10"
                          : "border-transparent bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.04]"
                      }`}
                      onClick={() => toggleSearch(search.id)}
                      type="button"
                    >
                      <div
                        className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border ${
                          selected
                            ? "border-violet-400 bg-violet-500 text-white"
                            : "border-white/15 bg-black/40 text-transparent"
                        }`}
                      >
                        <Check className="size-3" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-indigo-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-300">
                            {type}
                          </span>
                          <span className="text-[10px] text-zinc-600">
                            {formatDate(search.createdAt)} · {formatTime(search.createdAt)}
                          </span>
                        </div>
                        <p className="mt-1 break-all text-sm text-white">{label}</p>
                        {search.resultData && (
                          <p className="mt-1 text-xs text-zinc-500">Has saved results</p>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {error && (
            <p className="rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm text-red-200">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <DashButton onClick={onClose} variant="ghost">
              Cancel
            </DashButton>
            <DashButton disabled={saving || !caseName.trim()} onClick={handleCreate} variant="primary">
              <Plus className="size-4" />
              {saving ? "Creating..." : "Create case"}
            </DashButton>
          </div>
        </div>
      </DashPanel>
    </div>
  );
}
