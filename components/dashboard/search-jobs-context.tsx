"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell, CheckCircle2, Loader2, X, XCircle } from "lucide-react";
import clsx from "clsx";

/** Opaque result blob restored by ModuleSearchView — kept in memory for the session only. */
export type SearchJobPayload = Record<string, unknown>;

export type SearchJobStatus = "running" | "done" | "error" | "cancelled";

export type SearchJob = {
  id: string;
  moduleId: string;
  moduleName: string;
  query: string;
  status: SearchJobStatus;
  startedAt: number;
  finishedAt?: number;
  progressLabel?: string;
  resultSummary?: string;
  error?: string;
  payload?: SearchJobPayload;
};

export type StartSearchJobInput = {
  moduleId: string;
  moduleName: string;
  query: string;
  /** Async runner; receives per-job AbortSignal. Same-module prior job is aborted first. */
  runner: (ctx: {
    signal: AbortSignal;
    jobId: string;
    setProgress: (label: string) => void;
  }) => Promise<{
    payload: SearchJobPayload;
    resultSummary?: string;
  }>;
};

type SearchNotice = {
  id: string;
  jobId: string;
  title: string;
  detail: string;
  href: string;
  tone: "done" | "error";
};

type BeginSearchJobInput = {
  moduleId: string;
  moduleName: string;
  query: string;
};

type SearchJobsContextValue = {
  jobs: SearchJob[];
  runningCount: number;
  selectedJobId: string | null;
  panelOpen: boolean;
  notices: SearchNotice[];
  /** Register a running job and get a per-job AbortSignal. Cancels prior same-module job. */
  beginJob: (input: BeginSearchJobInput) => { jobId: string; signal: AbortSignal };
  completeJob: (
    jobId: string,
    result: { payload: SearchJobPayload; resultSummary?: string },
  ) => void;
  failJob: (jobId: string, error: string) => void;
  setJobProgress: (jobId: string, label: string) => void;
  startJob: (input: StartSearchJobInput) => string;
  cancelJob: (jobId: string) => void;
  selectJob: (jobId: string | null) => void;
  openJob: (jobId: string) => void;
  dismissNotice: (noticeId: string) => void;
  clearNoticeForJob: (jobId: string) => void;
  setPanelOpen: (open: boolean) => void;
  getLatestJobForModule: (moduleId: string) => SearchJob | undefined;
  getJob: (jobId: string) => SearchJob | undefined;
};

const SearchJobsContext = createContext<SearchJobsContextValue | null>(null);

const MAX_JOBS = 40;
const MAX_NOTICES = 5;

function newId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `job-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function SearchJobsProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [jobs, setJobs] = useState<SearchJob[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [notices, setNotices] = useState<SearchNotice[]>([]);
  const controllersRef = useRef<Map<string, AbortController>>(new Map());
  const jobsRef = useRef<SearchJob[]>([]);
  const pathnameRef = useRef(pathname);

  jobsRef.current = jobs;
  pathnameRef.current = pathname;

  const patchJob = useCallback((jobId: string, patch: Partial<SearchJob>) => {
    setJobs((prev) =>
      prev.map((job) => (job.id === jobId ? { ...job, ...patch } : job)),
    );
  }, []);

  const pushNotice = useCallback((notice: Omit<SearchNotice, "id">) => {
    const id = newId();

    setNotices((prev) => [{ ...notice, id }, ...prev].slice(0, MAX_NOTICES));
  }, []);

  const dismissNotice = useCallback((noticeId: string) => {
    setNotices((prev) => prev.filter((n) => n.id !== noticeId));
  }, []);

  const clearNoticeForJob = useCallback((jobId: string) => {
    setNotices((prev) => prev.filter((n) => n.jobId !== jobId));
  }, []);

  const cancelJob = useCallback(
    (jobId: string) => {
      const controller = controllersRef.current.get(jobId);

      if (controller) {
        controller.abort();
        controllersRef.current.delete(jobId);
      }

      const existing = jobsRef.current.find((j) => j.id === jobId);

      if (!existing || existing.status !== "running") return;

      patchJob(jobId, {
        status: "cancelled",
        finishedAt: Date.now(),
        progressLabel: undefined,
      });
    },
    [patchJob],
  );

  const beginJob = useCallback(
    (input: BeginSearchJobInput) => {
      for (const existing of jobsRef.current) {
        if (
          existing.moduleId === input.moduleId &&
          existing.status === "running"
        ) {
          cancelJob(existing.id);
        }
      }

      const jobId = newId();
      const controller = new AbortController();

      controllersRef.current.set(jobId, controller);

      const job: SearchJob = {
        id: jobId,
        moduleId: input.moduleId,
        moduleName: input.moduleName,
        query: input.query,
        status: "running",
        startedAt: Date.now(),
        progressLabel: "Searching…",
      };

      setJobs((prev) => [job, ...prev].slice(0, MAX_JOBS));
      setSelectedJobId(jobId);

      return { jobId, signal: controller.signal };
    },
    [cancelJob],
  );

  const completeJob = useCallback(
    (
      jobId: string,
      result: { payload: SearchJobPayload; resultSummary?: string },
    ) => {
      const existing = jobsRef.current.find((j) => j.id === jobId);

      if (!existing || existing.status !== "running") return;

      controllersRef.current.delete(jobId);

      const summary =
        result.resultSummary?.trim() ||
        `${existing.moduleName} · ${existing.query}`;

      patchJob(jobId, {
        status: "done",
        finishedAt: Date.now(),
        payload: result.payload,
        resultSummary: summary,
        progressLabel: undefined,
        error: undefined,
      });

      const viewingModule =
        pathnameRef.current === `/dashboard/search/${existing.moduleId}`;

      if (!viewingModule) {
        pushNotice({
          jobId,
          title: `${existing.moduleName} · ${existing.query}`,
          detail: summary,
          href: `/dashboard/search/${existing.moduleId}`,
          tone: "done",
        });
      }
    },
    [patchJob, pushNotice],
  );

  const failJob = useCallback(
    (jobId: string, error: string) => {
      const existing = jobsRef.current.find((j) => j.id === jobId);

      if (!existing || existing.status !== "running") return;

      controllersRef.current.delete(jobId);

      patchJob(jobId, {
        status: "error",
        finishedAt: Date.now(),
        error,
        progressLabel: undefined,
      });

      const viewingModule =
        pathnameRef.current === `/dashboard/search/${existing.moduleId}`;

      if (!viewingModule) {
        pushNotice({
          jobId,
          title: `${existing.moduleName} · ${existing.query}`,
          detail: error,
          href: `/dashboard/search/${existing.moduleId}`,
          tone: "error",
        });
      }
    },
    [patchJob, pushNotice],
  );

  const setJobProgress = useCallback(
    (jobId: string, label: string) => {
      patchJob(jobId, { progressLabel: label });
    },
    [patchJob],
  );

  const startJob = useCallback(
    (input: StartSearchJobInput) => {
      const { jobId, signal } = beginJob(input);

      void (async () => {
        try {
          const result = await input.runner({
            signal,
            jobId,
            setProgress: (label) => setJobProgress(jobId, label),
          });

          if (signal.aborted) return;

          completeJob(jobId, result);
        } catch (err) {
          if (signal.aborted) return;

          const message =
            err instanceof Error && err.message
              ? err.message
              : "Search failed.";

          failJob(jobId, message);
        }
      })();

      return jobId;
    },
    [beginJob, completeJob, failJob, setJobProgress],
  );

  const selectJob = useCallback((jobId: string | null) => {
    setSelectedJobId(jobId);
  }, []);

  const openJob = useCallback(
    (jobId: string) => {
      const job = jobsRef.current.find((j) => j.id === jobId);

      if (!job) return;

      setSelectedJobId(jobId);
      clearNoticeForJob(jobId);
      setPanelOpen(false);
      router.push(`/dashboard/search/${job.moduleId}`);
    },
    [clearNoticeForJob, router],
  );

  const getLatestJobForModule = useCallback((moduleId: string) => {
    return jobsRef.current.find((j) => j.moduleId === moduleId);
  }, []);

  const getJob = useCallback((jobId: string) => {
    return jobsRef.current.find((j) => j.id === jobId);
  }, []);

  const runningCount = useMemo(
    () => jobs.filter((j) => j.status === "running").length,
    [jobs],
  );

  const value = useMemo<SearchJobsContextValue>(
    () => ({
      jobs,
      runningCount,
      selectedJobId,
      panelOpen,
      notices,
      beginJob,
      completeJob,
      failJob,
      setJobProgress,
      startJob,
      cancelJob,
      selectJob,
      openJob,
      dismissNotice,
      clearNoticeForJob,
      setPanelOpen,
      getLatestJobForModule,
      getJob,
    }),
    [
      jobs,
      runningCount,
      selectedJobId,
      panelOpen,
      notices,
      beginJob,
      completeJob,
      failJob,
      setJobProgress,
      startJob,
      cancelJob,
      selectJob,
      openJob,
      dismissNotice,
      clearNoticeForJob,
      getLatestJobForModule,
      getJob,
    ],
  );

  return (
    <SearchJobsContext.Provider value={value}>
      {children}
      <SearchJobsChrome />
    </SearchJobsContext.Provider>
  );
}

export function useSearchJobs() {
  const ctx = useContext(SearchJobsContext);

  if (!ctx) {
    throw new Error("useSearchJobs must be used within SearchJobsProvider");
  }

  return ctx;
}

function formatJobTime(ts: number) {
  try {
    return new Date(ts).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function SearchJobsChrome() {
  const {
    jobs,
    runningCount,
    panelOpen,
    setPanelOpen,
    notices,
    dismissNotice,
    openJob,
    cancelJob,
  } = useSearchJobs();

  return (
    <>
      <div className="search-jobs-notices" aria-live="polite">
        {notices.map((notice) => (
          <button
            key={notice.id}
            className={clsx(
              "search-jobs-toast",
              notice.tone === "error" && "search-jobs-toast--error",
            )}
            type="button"
            onClick={() => openJob(notice.jobId)}
          >
            <span className="search-jobs-toast-icon">
              {notice.tone === "error" ? (
                <XCircle className="size-4" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
            </span>
            <span className="search-jobs-toast-body">
              <span className="search-jobs-toast-title">{notice.title}</span>
              <span className="search-jobs-toast-detail">{notice.detail}</span>
            </span>
            <span
              aria-label="Dismiss"
              className="search-jobs-toast-dismiss"
              role="presentation"
              onClick={(event) => {
                event.stopPropagation();
                dismissNotice(notice.id);
              }}
            >
              <X className="size-3.5" />
            </span>
          </button>
        ))}
      </div>

      {panelOpen ? (
        <div className="search-jobs-panel" role="dialog" aria-label="Search jobs">
          <div className="search-jobs-panel-header">
            <div>
              <p className="search-jobs-panel-title">Search jobs</p>
              <p className="search-jobs-panel-subtitle">
                Background searches stay alive when you switch modules
              </p>
            </div>
            <button
              aria-label="Close search jobs"
              className="search-jobs-panel-close"
              type="button"
              onClick={() => setPanelOpen(false)}
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="search-jobs-panel-list">
            {jobs.length === 0 ? (
              <p className="search-jobs-panel-empty">No searches this session.</p>
            ) : (
              jobs.map((job) => (
                <div key={job.id} className="search-jobs-panel-row">
                  <button
                    className="search-jobs-panel-row-main"
                    type="button"
                    onClick={() => openJob(job.id)}
                  >
                    <span className="search-jobs-panel-status">
                      {job.status === "running" ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : job.status === "done" ? (
                        <CheckCircle2 className="size-3.5 text-emerald-400" />
                      ) : job.status === "error" ? (
                        <XCircle className="size-3.5 text-rose-400" />
                      ) : (
                        <X className="size-3.5 text-zinc-500" />
                      )}
                    </span>
                    <span className="search-jobs-panel-copy">
                      <span className="search-jobs-panel-row-title">
                        {job.moduleName}
                        <span className="search-jobs-panel-time">
                          {formatJobTime(job.startedAt)}
                        </span>
                      </span>
                      <span className="search-jobs-panel-row-query">
                        {job.query}
                      </span>
                      <span className="search-jobs-panel-row-meta">
                        {job.status === "running"
                          ? job.progressLabel || "Running…"
                          : job.status === "done"
                            ? job.resultSummary || "Done"
                            : job.status === "error"
                              ? job.error || "Failed"
                              : "Cancelled"}
                      </span>
                    </span>
                  </button>
                  {job.status === "running" ? (
                    <button
                      className="search-jobs-panel-cancel"
                      type="button"
                      onClick={() => cancelJob(job.id)}
                    >
                      Cancel
                    </button>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}

      {/* Floating indicator when sidebar may be collapsed — also mirrored in sidebar */}
      {runningCount > 0 && !panelOpen && notices.length === 0 ? (
        <button
          aria-label={`${runningCount} active search${runningCount === 1 ? "" : "es"}`}
          className="search-jobs-fab"
          type="button"
          onClick={() => setPanelOpen(true)}
        >
          <Bell className="size-4" />
          <span>{runningCount}</span>
        </button>
      ) : null}
    </>
  );
}

export function SearchJobsSidebarButton({
  collapsed,
}: {
  collapsed?: boolean;
}) {
  const { runningCount, jobs, panelOpen, setPanelOpen } = useSearchJobs();
  const doneUnread = jobs.some((j) => j.status === "done" || j.status === "error");

  return (
    <button
      aria-expanded={panelOpen}
      aria-label={
        runningCount > 0
          ? `${runningCount} active searches`
          : "Open search jobs"
      }
      className={clsx(
        "search-jobs-sidebar-btn",
        collapsed && "search-jobs-sidebar-btn--collapsed",
        (runningCount > 0 || doneUnread) && "search-jobs-sidebar-btn--hot",
      )}
      title="Search jobs"
      type="button"
      onClick={() => setPanelOpen(!panelOpen)}
    >
      {runningCount > 0 ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Bell className="size-4" />
      )}
      {!collapsed ? (
        <span className="dash-sidebar-label">
          {runningCount > 0
            ? `${runningCount} running`
            : jobs.length > 0
              ? "Search jobs"
              : "Search jobs"}
        </span>
      ) : null}
      {runningCount > 0 ? (
        <span className="search-jobs-sidebar-count">{runningCount}</span>
      ) : null}
    </button>
  );
}
