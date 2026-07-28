"use client";

import type { CaseWithSearches } from "@/lib/case-mind-map";

import { useCallback, useEffect, useState } from "react";
import {
  FolderOpen,
  GitBranch,
  Network,
  Plus,
  Save,
  Trash2,
  User,
} from "lucide-react";
import clsx from "clsx";

import { apiFetch } from "@/lib/csrf-client";
import { AddCaseModal } from "@/components/dashboard/add-case-modal";
import { CaseMindMap } from "@/components/dashboard/case-mind-map";
import {
  DashButton,
  DashInput,
  DashPanel,
  DashSelect,
  DashTextarea,
  PageHeader,
  StatCard,
} from "@/components/dashboard/dashboard-ui";
import { formatDate } from "@/lib/format-datetime";
import { PanelDemo } from "@/components/panel-demo";

type CaseListItem = {
  id: number;
  title: string;
  subjectName: string;
  email: string | null;
  phone: string | null;
  username: string | null;
  location: string | null;
  notes: string;
  intelData: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  _count?: { searches: number };
};

const EMPTY_FORM = {
  title: "",
  subjectName: "",
  email: "",
  phone: "",
  username: "",
  location: "",
  notes: "",
  intelData: "",
  status: "active",
};

type ViewMode = "mindmap" | "details";

export default function CasesPage() {
  const [cases, setCases] = useState<CaseListItem[]>([]);
  const [activeCase, setActiveCase] = useState<CaseWithSearches | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingCase, setLoadingCase] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showAddModal, setShowAddModal] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("mindmap");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadCases = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/cases");
      const data = await response.json();

      if (response.ok && Array.isArray(data.cases)) {
        setCases(data.cases);
      }
    } catch {
      setError("Could not load cases.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCaseDetail = useCallback(async (id: number) => {
    setLoadingCase(true);
    try {
      const response = await fetch(`/api/cases/${id}`);
      const data = await response.json();

      if (response.ok && data.case) {
        setActiveCase(data.case);
        setForm({
          title: data.case.title,
          subjectName: data.case.subjectName,
          email: data.case.email || "",
          phone: data.case.phone || "",
          username: data.case.username || "",
          location: data.case.location || "",
          notes: data.case.notes,
          intelData: data.case.intelData,
          status: data.case.status,
        });
      }
    } catch {
      setError("Could not load case details.");
    } finally {
      setLoadingCase(false);
    }
  }, []);

  useEffect(() => {
    loadCases();
  }, [loadCases]);

  const selectCase = async (record: CaseListItem) => {
    setSelectedId(record.id);
    setViewMode("mindmap");
    setError("");
    await loadCaseDetail(record.id);
  };

  const startNewCase = () => {
    setShowAddModal(true);
  };

  const handleCaseCreated = async (caseId: number) => {
    await loadCases();
    setSelectedId(caseId);
    setViewMode("mindmap");
    await loadCaseDetail(caseId);
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      setError("Case name is required.");

      return;
    }

    if (selectedId === null) return;

    setSaving(true);
    setError("");

    try {
      const response = await apiFetch(`/api/cases/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          subjectName: form.subjectName.trim() || form.title.trim(),
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to update case.");

        return;
      }

      await loadCases();
      if (data.case) {
        setActiveCase(data.case);
      }
    } catch {
      setError("Something went wrong while saving.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (selectedId === null) return;
    if (!window.confirm("Delete this case permanently?")) return;

    try {
      const response = await apiFetch(`/api/cases/${selectedId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        setError("Failed to delete case.");

        return;
      }

      setSelectedId(null);
      setActiveCase(null);
      setForm(EMPTY_FORM);
      await loadCases();
    } catch {
      setError("Could not delete case.");
    }
  };

  const activeCount = cases.filter((c) => c.status === "active").length;
  const showWorkspace = selectedId !== null && activeCase;

  return (
    <div className="px-6 py-6 md:px-8 md:py-8">
      <AddCaseModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onCreated={handleCaseCreated}
      />

      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <PageHeader
          badge="Case ID"
          subtitle="Name cases, attach past searches, and explore intel on an interactive mind map."
          title="Case ID"
        />
        <DashButton variant="primary" onClick={startNewCase}>
          <Plus className="size-4" />
          Add case
        </DashButton>
      </div>

      <section className="mb-8 grid gap-4 md:grid-cols-3">
        <StatCard
          accent="teal"
          hint="Total dossiers on file"
          icon={FolderOpen}
          label="All cases"
          value={loading ? "—" : cases.length}
        />
        <StatCard
          accent="violet"
          hint="Linked search nodes"
          icon={Network}
          label="Intel nodes"
          value={
            loading
              ? "—"
              : cases.reduce(
                  (sum, item) => sum + (item._count?.searches ?? 0),
                  0,
                )
          }
        />
        <StatCard
          accent="amber"
          hint="Currently being worked"
          icon={User}
          label="Active"
          value={loading ? "—" : activeCount}
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
        <DashPanel className="min-h-[32rem]" glow="teal">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Your cases</h2>
            <span className="text-xs text-zinc-500">{cases.length} saved</span>
          </div>

          {loading ? (
            <p className="text-sm text-zinc-500">Loading cases...</p>
          ) : cases.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 flex size-14 items-center justify-center rounded-lg border border-white/10 bg-white/[0.06] text-gray-300">
                <GitBranch className="size-6" />
              </div>
              <p className="font-medium text-white">No cases yet</p>
              <p className="mt-1 max-w-xs text-sm text-zinc-400">
                Click Add case to name a dossier and pull in your old searches.
              </p>
              <DashButton
                className="mt-4"
                variant="primary"
                onClick={startNewCase}
              >
                <Plus className="size-4" />
                Add case
              </DashButton>
            </div>
          ) : (
            <div className="space-y-2">
              {cases.map((record) => (
                <button
                  key={record.id}
                  className={clsx(
                    "dash-case-card w-full text-left",
                    selectedId === record.id && "dash-case-card-active",
                  )}
                  type="button"
                  onClick={() => selectCase(record)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-white">{record.title}</p>
                      <p className="mt-0.5 text-sm text-gray-300">
                        {record.subjectName}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold text-gray-300">
                      {record._count?.searches ?? 0} searches
                    </span>
                  </div>
                  <p className="mt-2 text-[10px] text-zinc-600">
                    Updated {formatDate(record.updatedAt)}
                  </p>
                </button>
              ))}
            </div>
          )}
        </DashPanel>

        <DashPanel className="min-h-[32rem] overflow-hidden !p-0" glow="violet">
          {!showWorkspace ? (
            <div className="p-3 md:p-4">
              <div className="mb-3 flex items-center justify-between gap-3 px-1">
                <div>
                  <p className="text-sm font-semibold text-white">
                    Panel demo
                  </p>
                  <p className="text-xs text-zinc-500">
                    Click modules and findings — nothing is live. Add a case to
                    use the real mind map.
                  </p>
                </div>
              </div>
              <PanelDemo compact />
            </div>
          ) : loadingCase ? (
            <p className="py-20 text-center text-sm text-zinc-500">
              Loading case intel...
            </p>
          ) : (
            <>
              <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    {activeCase.title}
                  </h2>
                  <p className="text-sm text-zinc-400">
                    {activeCase.subjectName}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex rounded-xl border border-white/8 bg-black/30 p-1">
                    <button
                      className={clsx(
                        "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                        viewMode === "mindmap"
                          ? "bg-white/10 text-white"
                          : "text-gray-400 hover:text-white",
                      )}
                      type="button"
                      onClick={() => setViewMode("mindmap")}
                    >
                      Mind map
                    </button>
                    <button
                      className={clsx(
                        "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                        viewMode === "details"
                          ? "bg-white/10 text-white"
                          : "text-gray-400 hover:text-white",
                      )}
                      type="button"
                      onClick={() => setViewMode("details")}
                    >
                      Details
                    </button>
                  </div>
                  <DashButton variant="danger" onClick={handleDelete}>
                    <Trash2 className="size-4" />
                    Delete
                  </DashButton>
                </div>
              </div>

              {viewMode === "mindmap" ? (
                <CaseMindMap caseRecord={activeCase} />
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="dash-field-label" htmlFor="case-title">
                        Case name
                      </label>
                      <DashInput
                        id="case-title"
                        value={form.title}
                        onChange={(e) =>
                          setForm({ ...form, title: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="dash-field-label" htmlFor="case-name">
                        Subject name
                      </label>
                      <DashInput
                        id="case-name"
                        value={form.subjectName}
                        onChange={(e) =>
                          setForm({ ...form, subjectName: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="dash-field-label" htmlFor="case-email">
                        Email
                      </label>
                      <DashInput
                        id="case-email"
                        value={form.email}
                        onChange={(e) =>
                          setForm({ ...form, email: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="dash-field-label" htmlFor="case-phone">
                        Phone
                      </label>
                      <DashInput
                        id="case-phone"
                        value={form.phone}
                        onChange={(e) =>
                          setForm({ ...form, phone: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label
                        className="dash-field-label"
                        htmlFor="case-username"
                      >
                        Username
                      </label>
                      <DashInput
                        id="case-username"
                        value={form.username}
                        onChange={(e) =>
                          setForm({ ...form, username: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label
                        className="dash-field-label"
                        htmlFor="case-location"
                      >
                        Location
                      </label>
                      <DashInput
                        id="case-location"
                        value={form.location}
                        onChange={(e) =>
                          setForm({ ...form, location: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  <div>
                    <label className="dash-field-label" htmlFor="case-status">
                      Status
                    </label>
                    <DashSelect
                      id="case-status"
                      value={form.status}
                      onChange={(e) =>
                        setForm({ ...form, status: e.target.value })
                      }
                    >
                      <option value="active">Active</option>
                      <option value="closed">Closed</option>
                      <option value="archived">Archived</option>
                    </DashSelect>
                  </div>

                  <div>
                    <label className="dash-field-label" htmlFor="case-notes">
                      Notes
                    </label>
                    <DashTextarea
                      id="case-notes"
                      rows={4}
                      value={form.notes}
                      onChange={(e) =>
                        setForm({ ...form, notes: e.target.value })
                      }
                    />
                  </div>

                  <div>
                    <label className="dash-field-label">Linked searches</label>
                    <div className="space-y-2 rounded-xl border border-white/8 bg-black/20 p-3">
                      {activeCase.searches.length === 0 ? (
                        <p className="text-sm text-zinc-500">
                          No searches linked yet.
                        </p>
                      ) : (
                        activeCase.searches.map((link) => (
                          <div
                            key={link.id}
                            className="rounded-lg border border-white/6 bg-black/30 px-3 py-2"
                          >
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                              {link.searchHistory.searchType}
                            </p>
                            <p className="mt-1 text-sm text-white">
                              {link.searchHistory.query}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {error && (
                    <p className="rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm text-red-200">
                      {error}
                    </p>
                  )}

                  <div className="flex justify-end">
                    <DashButton
                      disabled={saving}
                      variant="primary"
                      onClick={handleSave}
                    >
                      <Save className="size-4" />
                      {saving ? "Saving..." : "Save changes"}
                    </DashButton>
                  </div>
                </div>
              )}
            </>
          )}
        </DashPanel>
      </div>
    </div>
  );
}
