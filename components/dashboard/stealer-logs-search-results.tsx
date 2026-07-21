"use client";

import type { StealerArchiveEntry, StealerFileNode } from "@/lib/breachhub";
import type { StealerCredentialRow } from "@/lib/stealer-logs-view";
import type { FormattedRecord } from "@/lib/search-utils";

import clsx from "clsx";
import {
  Archive,
  ChevronRight,
  Download,
  FileText,
  Folder,
  FolderOpen,
  Home,
  Monitor,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { BlurredValue } from "@/components/dashboard/blurred-value";
import { ResultCopyButton } from "@/components/dashboard/result-copy-button";
import { SearchEmptyState } from "@/components/dashboard/search-empty-state";
import { SearchResultCards } from "@/components/dashboard/search-result-cards";
import { ResultsBlurNotice } from "@/components/results-blur-notice";
import { apiFetch } from "@/lib/csrf-client";
import { countFileNodes } from "@/lib/stealer-logs-view";

const CRED_PAGE = 5;
const DEVICE_PAGE = 4;

type ResultsPane = "credentials" | "machines";
type DeviceTab = "files" | "summary" | "properties" | "cookies";

function PaginationBar({
  page,
  pageCount,
  pageSize,
  onPrev,
  onNext,
}: {
  page: number;
  pageCount: number;
  pageSize: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  if (pageCount <= 1) return null;

  return (
    <div className="anya-stealer-pager">
      <p className="anya-stealer-pager-meta">
        Page {page} of {pageCount} · {pageSize} per page
      </p>
      <div className="anya-stealer-pager-actions">
        <button
          className="anya-stealer-btn anya-stealer-btn--ghost"
          disabled={page <= 1}
          type="button"
          onClick={onPrev}
        >
          Previous
        </button>
        <button
          className="anya-stealer-btn anya-stealer-btn--ghost"
          disabled={page >= pageCount}
          type="button"
          onClick={onNext}
        >
          Next
        </button>
      </div>
    </div>
  );
}

function DeviceFileExplorerModal({
  device,
  index,
  blurResults,
  onClose,
  onArchive,
  archiving,
}: {
  device: StealerArchiveEntry;
  index: number;
  blurResults: boolean;
  onClose: () => void;
  onArchive: () => void;
  archiving: boolean;
}) {
  const [tab, setTab] = useState<DeviceTab>("files");
  const [manifest, setManifest] = useState<StealerArchiveEntry | null>(
    device.files?.length ? device : null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pathStack, setPathStack] = useState<StealerFileNode[]>([]);
  const [filePreview, setFilePreview] = useState<{
    name: string;
    content: string;
  } | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const loadManifest = useCallback(async () => {
    if (manifest?.files?.length) return;
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        logId: device.logId,
        action: "manifest",
        moduleSlug: "stealer-logs",
      });

      if (device.machineId?.trim()) {
        params.set("machineId", device.machineId.trim());
      }

      const res = await apiFetch(`/api/osint/stealer-victim?${params}`);
      const data = (await res.json()) as StealerArchiveEntry & {
        available?: boolean;
        message?: string;
        error?: string;
      };

      if (!res.ok || data.available === false) {
        setError(data.message || data.error || "Manifest unavailable.");
        setManifest(device);

        return;
      }

      setManifest({ ...device, ...data, logId: device.logId });
    } catch {
      setError("Could not load file manifest.");
      setManifest(device);
    } finally {
      setLoading(false);
    }
  }, [device, manifest?.files?.length]);

  useEffect(() => {
    void loadManifest();
  }, [loadManifest]);

  const rootFiles = manifest?.files ?? device.files ?? [];
  const currentNodes =
    pathStack.length === 0
      ? rootFiles
      : pathStack[pathStack.length - 1]?.children ?? [];

  const openFile = useCallback(
    async (fileId: string, name: string) => {
      setFileLoading(true);
      setFilePreview(null);
      setFileError(null);
      setError(null);

      try {
        const res = await apiFetch(
          `/api/osint/stealer-victim?logId=${encodeURIComponent(device.logId)}&fileId=${encodeURIComponent(fileId)}&action=file&moduleSlug=stealer-logs`,
        );
        const data = (await res.json()) as {
          available?: boolean;
          content?: string;
          filename?: string;
          message?: string;
          error?: string;
        };

        if (!res.ok) {
          const message =
            data.message || data.error || `Could not open file (HTTP ${res.status}).`;

          setFileError(message);
          setError(message);

          return;
        }

        if (data.available === false || !data.content) {
          const message =
            data.message ||
            data.error ||
            "File content is not available for preview.";

          setFileError(message);
          setError(message);

          return;
        }

        setFilePreview({
          name: data.filename || name,
          content: data.content,
        });
      } catch {
        const message = "Could not open file.";

        setFileError(message);
        setError(message);
      } finally {
        setFileLoading(false);
      }
    },
    [device.logId],
  );

  const resolveFileId = (node: StealerFileNode): string =>
    (node.id || node.path || node.name || "").trim();

  const summary = manifest?.summary ?? device.summary;
  const properties = manifest?.properties ?? device.properties;
  const cookies = manifest?.cookies ?? device.cookies;
  const titleBits = [
    `Infected device #${index}`,
    device.label || device.machineId,
  ].filter(Boolean);
  const metaBits = [
    device.os,
    device.malware,
    device.country,
    device.date?.slice(0, 10),
  ].filter(Boolean);

  const tabs: { id: DeviceTab; label: string; show: boolean }[] = [
    { id: "files", label: "Files", show: true },
    {
      id: "summary",
      label: "Summary",
      show: Boolean(summary && Object.keys(summary).length),
    },
    {
      id: "properties",
      label: "Properties",
      show: Boolean(properties && Object.keys(properties).length),
    },
    {
      id: "cookies",
      label: "Cookies",
      show: Boolean(cookies && cookies.length),
    },
  ];

  if (!mounted) return null;

  return createPortal(
    <div className="anya-explorer-overlay" role="presentation">
      <button
        aria-label="Close file explorer"
        className="anya-explorer-backdrop"
        type="button"
        onClick={onClose}
      />
      <div
        aria-labelledby="anya-explorer-title"
        aria-modal="true"
        className="anya-explorer-window"
        role="dialog"
      >
        <header className="anya-explorer-titlebar">
          <div className="anya-explorer-titlebar-main">
            <Monitor className="size-4 shrink-0 text-anya-accent" />
            <div className="min-w-0">
              <h2 className="anya-explorer-title" id="anya-explorer-title">
                {titleBits.join(" · ")}
              </h2>
              {metaBits.length > 0 ? (
                <p className="anya-explorer-subtitle">{metaBits.join(" · ")}</p>
              ) : null}
            </div>
          </div>
          <div className="anya-explorer-titlebar-actions">
            <button
              className="anya-stealer-btn anya-stealer-btn--solid"
              disabled={archiving}
              type="button"
              onClick={onArchive}
            >
              <Download className="size-3.5" />
              {archiving ? "Preparing…" : "Archive"}
            </button>
            <button
              aria-label="Close"
              className="anya-explorer-close"
              type="button"
              onClick={onClose}
            >
              <X className="size-4" />
            </button>
          </div>
        </header>

        <div className="anya-explorer-idrow">
          <span className="anya-explorer-idlabel">Log ID</span>
          <code className="anya-explorer-idvalue">
            <BlurredValue forceBlur={blurResults} text={device.logId} />
          </code>
          <ResultCopyButton compact text={device.logId} />
        </div>

        <div className="anya-explorer-tabs" role="tablist">
          {tabs
            .filter((t) => t.show)
            .map((t) => (
              <button
                key={t.id}
                aria-selected={tab === t.id}
                className={clsx(
                  "anya-explorer-tab",
                  tab === t.id && "anya-explorer-tab--active",
                )}
                role="tab"
                type="button"
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
        </div>

        {tab === "files" ? (
          <>
            <nav aria-label="Path" className="anya-explorer-breadcrumb">
              <button
                className="anya-explorer-crumb"
                type="button"
                onClick={() => {
                  setPathStack([]);
                  setFilePreview(null);
                  setFileError(null);
                }}
              >
                <Home className="size-3.5" />
                Root
              </button>
              {pathStack.map((folder, i) => (
                <span key={`${folder.name}-${i}`} className="anya-explorer-crumb-wrap">
                  <ChevronRight className="size-3 text-zinc-600" />
                  <button
                    className="anya-explorer-crumb"
                    type="button"
                    onClick={() => {
                      setPathStack((stack) => stack.slice(0, i + 1));
                      setFilePreview(null);
                      setFileError(null);
                    }}
                  >
                    {folder.name}
                  </button>
                </span>
              ))}
            </nav>

            <div className="anya-explorer-body">
              <div className="anya-explorer-list-pane">
                {loading ? (
                  <p className="anya-explorer-empty">Loading file tree…</p>
                ) : error && rootFiles.length === 0 ? (
                  <p className="anya-explorer-empty">{error}</p>
                ) : currentNodes.length === 0 ? (
                  <p className="anya-explorer-empty">This folder is empty.</p>
                ) : (
                  <ul className="anya-explorer-list">
                    <li className="anya-explorer-list-head">
                      <span>Name</span>
                      <span>Type</span>
                      <span>Items</span>
                    </li>
                    {pathStack.length > 0 ? (
                      <li>
                        <button
                          className="anya-explorer-row"
                          type="button"
                          onClick={() => {
                            setPathStack((stack) => stack.slice(0, -1));
                            setFilePreview(null);
                            setFileError(null);
                          }}
                        >
                          <span className="anya-explorer-row-name">
                            <FolderOpen className="size-4 text-anya-accent" />
                            ..
                          </span>
                          <span className="anya-explorer-row-type">Up</span>
                          <span className="anya-explorer-row-meta">—</span>
                        </button>
                      </li>
                    ) : null}
                    {[...currentNodes]
                      .sort((a, b) => {
                        if (a.type !== b.type) {
                          return a.type === "folder" ? -1 : 1;
                        }

                        return a.name.localeCompare(b.name);
                      })
                      .map((node) => {
                        const isFolder = node.type === "folder";
                        const count =
                          node.count ??
                          (node.children
                            ? countFileNodes(node.children)
                            : undefined);

                        return (
                          <li key={`${node.path ?? node.name}-${node.id ?? ""}`}>
                            <button
                              className={clsx(
                                "anya-explorer-row",
                                filePreview?.name === node.name &&
                                  !isFolder &&
                                  "anya-explorer-row--active",
                              )}
                              type="button"
                              onDoubleClick={() => {
                                if (isFolder) {
                                  setPathStack((stack) => [...stack, node]);
                                  setFilePreview(null);
                                  setFileError(null);
                                } else {
                                  const id = resolveFileId(node);

                                  if (id) void openFile(id, node.name);
                                  else {
                                    setFileError(
                                      "No file id available for preview.",
                                    );
                                    setFilePreview(null);
                                  }
                                }
                              }}
                              onClick={() => {
                                if (isFolder) {
                                  setPathStack((stack) => [...stack, node]);
                                  setFilePreview(null);
                                  setFileError(null);

                                  return;
                                }

                                const id = resolveFileId(node);

                                if (id) void openFile(id, node.name);
                                else {
                                  setFileError(
                                    "No file id available for preview.",
                                  );
                                  setFilePreview(null);
                                }
                              }}
                            >
                              <span className="anya-explorer-row-name">
                                {isFolder ? (
                                  <Folder className="size-4 text-anya-accent" />
                                ) : (
                                  <FileText className="size-4 text-zinc-500" />
                                )}
                                <BlurredValue
                                  forceBlur={blurResults}
                                  text={node.name}
                                />
                              </span>
                              <span className="anya-explorer-row-type">
                                {isFolder ? "Folder" : "File"}
                              </span>
                              <span className="anya-explorer-row-meta">
                                {isFolder
                                  ? count !== undefined
                                    ? String(count)
                                    : "—"
                                  : "—"}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                  </ul>
                )}
              </div>

              <aside className="anya-explorer-preview-pane">
                <div className="anya-explorer-preview-head">
                  <p>{filePreview?.name || "Preview"}</p>
                  {filePreview || fileError ? (
                    <button
                      className="anya-stealer-btn anya-stealer-btn--ghost"
                      type="button"
                      onClick={() => {
                        setFilePreview(null);
                        setFileError(null);
                      }}
                    >
                      Clear
                    </button>
                  ) : null}
                </div>
                <div className="anya-explorer-preview-body">
                  {fileLoading ? (
                    <p className="anya-explorer-empty">Loading file…</p>
                  ) : fileError ? (
                    <p className="anya-explorer-empty anya-explorer-empty--error">
                      {fileError}
                    </p>
                  ) : filePreview ? (
                    <pre>
                      <BlurredValue
                        forceBlur={blurResults}
                        text={filePreview.content}
                      />
                    </pre>
                  ) : (
                    <p className="anya-explorer-empty">
                      Select a file to preview its contents.
                    </p>
                  )}
                </div>
              </aside>
            </div>
          </>
        ) : null}

        {tab === "summary" && summary ? (
          <div className="anya-explorer-meta-pane">
            <dl className="anya-stealer-kv">
              {Object.entries(summary).map(([key, value]) => (
                <div key={key}>
                  <dt>{key}</dt>
                  <dd>
                    <BlurredValue
                      forceBlur={blurResults}
                      text={
                        typeof value === "string"
                          ? value
                          : JSON.stringify(value)
                      }
                    />
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}

        {tab === "properties" && properties ? (
          <div className="anya-explorer-meta-pane">
            <dl className="anya-stealer-kv">
              {Object.entries(properties).map(([key, value]) => (
                <div key={key}>
                  <dt>{key}</dt>
                  <dd>
                    <BlurredValue
                      forceBlur={blurResults}
                      text={
                        typeof value === "string"
                          ? value
                          : JSON.stringify(value)
                      }
                    />
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}

        {tab === "cookies" && cookies?.length ? (
          <div className="anya-explorer-meta-pane">
            <ul className="anya-stealer-cookie-list">
              {cookies.slice(0, 80).map((cookie, i) => (
                <li key={i}>
                  <BlurredValue
                    forceBlur={blurResults}
                    text={
                      typeof cookie === "string"
                        ? cookie
                        : JSON.stringify(cookie)
                    }
                  />
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <footer className="anya-explorer-status">
          {rootFiles.length > 0
            ? `${countFileNodes(rootFiles)} items in archive · ${currentNodes.length} in this folder`
            : "No files loaded"}
          {error ? ` · ${error}` : ""}
        </footer>
      </div>
    </div>,
    document.body,
  );
}

export function StealerLogsSearchResults({
  credentials,
  archives,
  blurResults = false,
  totalCredentialCount,
  fallbackRecords,
}: {
  credentials: StealerCredentialRow[];
  archives: StealerArchiveEntry[];
  blurResults?: boolean;
  totalCredentialCount?: number;
  fallbackRecords?: FormattedRecord[];
}) {
  const [pane, setPane] = useState<ResultsPane>(() =>
    archives.length > 0 && credentials.length === 0
      ? "machines"
      : "credentials",
  );
  const [credPage, setCredPage] = useState(1);
  const [devicePage, setDevicePage] = useState(1);
  const [openDevice, setOpenDevice] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [archiveMsg, setArchiveMsg] = useState<string | null>(null);

  const credCount = totalCredentialCount ?? credentials.length;
  const credPageCount = Math.max(1, Math.ceil(credentials.length / CRED_PAGE));
  const devicePageCount = Math.max(1, Math.ceil(archives.length / DEVICE_PAGE));

  useEffect(() => {
    if (archives.length > 0 && credentials.length === 0) {
      setPane("machines");
    }
  }, [archives.length, credentials.length]);

  const visibleCreds = useMemo(() => {
    const start = (credPage - 1) * CRED_PAGE;

    return credentials.slice(start, start + CRED_PAGE);
  }, [credentials, credPage]);

  const visibleDevices = useMemo(() => {
    const start = (devicePage - 1) * DEVICE_PAGE;

    return archives.slice(start, start + DEVICE_PAGE);
  }, [archives, devicePage]);

  const openDeviceEntry = useMemo(
    () => archives.find((device) => device.logId === openDevice) ?? null,
    [archives, openDevice],
  );

  const openDeviceIndex = useMemo(() => {
    if (!openDeviceEntry) return 1;
    const idx = archives.findIndex((d) => d.logId === openDeviceEntry.logId);

    return idx >= 0 ? idx + 1 : 1;
  }, [archives, openDeviceEntry]);

  const handleArchive = async (logId: string) => {
    setArchivingId(logId);
    setArchiveMsg(null);

    try {
      const deviceMatch = archives.find((d) => d.logId === logId);
      const params = new URLSearchParams({
        logId,
        action: "archive",
        moduleSlug: "stealer-logs",
      });

      if (deviceMatch?.machineId?.trim()) {
        params.set("machineId", deviceMatch.machineId.trim());
      }

      const res = await apiFetch(`/api/osint/stealer-victim?${params}`);
      const contentType = res.headers.get("content-type") || "";

      if (
        res.ok &&
        (contentType.includes("zip") ||
          contentType.includes("octet-stream") ||
          contentType.includes("application/x-zip"))
      ) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");

        a.href = url;
        a.download = `stealer-${logId.slice(0, 12)}.zip`;
        a.click();
        URL.revokeObjectURL(url);
        setArchiveMsg("Archive download started.");

        return;
      }

      const data = (await res.json()) as {
        downloadUrl?: string | null;
        available?: boolean;
        message?: string;
        error?: string;
      };

      if (data.downloadUrl) {
        window.open(data.downloadUrl, "_blank", "noopener,noreferrer");
        setArchiveMsg("Archive download started.");
      } else {
        setArchiveMsg(
          data.message ||
            data.error ||
            "Archive download is not available for this device.",
        );
      }
    } catch {
      setArchiveMsg("Archive download failed.");
    } finally {
      setArchivingId(null);
    }
  };

  if (
    credentials.length === 0 &&
    archives.length === 0 &&
    !(fallbackRecords && fallbackRecords.length > 0)
  ) {
    return (
      <SearchEmptyState detail="No stealer credentials or archives found." />
    );
  }

  return (
    <div className="anya-stealer-results">
      <div className="anya-stealer-view-toggle" role="tablist">
        <button
          aria-selected={pane === "credentials"}
          className={clsx(
            "anya-stealer-view-tab",
            pane === "credentials" && "anya-stealer-view-tab--active",
          )}
          role="tab"
          type="button"
          onClick={() => setPane("credentials")}
        >
          Credentials
          <span className="anya-stealer-view-count">
            {credCount.toLocaleString()}
          </span>
        </button>
        <button
          aria-selected={pane === "machines"}
          className={clsx(
            "anya-stealer-view-tab",
            pane === "machines" && "anya-stealer-view-tab--active",
          )}
          role="tab"
          type="button"
          onClick={() => setPane("machines")}
        >
          <Monitor className="size-3.5" />
          Machine view
          <span className="anya-stealer-view-count">
            {archives.length.toLocaleString()}
          </span>
        </button>
      </div>

      {pane === "credentials" ? (
        <section className="anya-stealer-card">
          <header className="anya-stealer-card-head">
            <p className="anya-stealer-stat">
              {credCount.toLocaleString()} credential
              {credCount === 1 ? "" : "s"}
            </p>
            {archives.length > 0 ? (
              <p className="anya-stealer-stat anya-stealer-stat--muted">
                {archives.length.toLocaleString()} linked archive
                {archives.length === 1 ? "" : "s"}
              </p>
            ) : null}
          </header>

          {credentials.length === 0 ? (
            <p className="anya-stealer-empty-pane">
              No flattened credentials for this query. Check Machine view for
              infected devices, or related intel below.
            </p>
          ) : (
            <>
              <div className="anya-stealer-table-wrap">
                <table className="anya-stealer-table">
                  <thead>
                    <tr>
                      <th>Site</th>
                      <th>Username</th>
                      <th>Password</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleCreds.map((row, i) => (
                      <tr key={`${row.site}-${row.username}-${i}`}>
                        <td>
                          <BlurredValue
                            forceBlur={blurResults}
                            text={row.site || "—"}
                          />
                        </td>
                        <td>
                          <BlurredValue
                            forceBlur={blurResults}
                            text={row.username || "—"}
                          />
                        </td>
                        <td>
                          <BlurredValue
                            forceBlur={blurResults}
                            text={row.password || "—"}
                          />
                        </td>
                        <td className="text-zinc-500">{row.date || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <PaginationBar
                page={credPage}
                pageCount={credPageCount}
                pageSize={CRED_PAGE}
                onNext={() =>
                  setCredPage((p) => Math.min(credPageCount, p + 1))
                }
                onPrev={() => setCredPage((p) => Math.max(1, p - 1))}
              />
            </>
          )}
        </section>
      ) : (
        <section className="anya-stealer-card">
          <header className="anya-stealer-archives-head">
            <p className="anya-stealer-archives-label">Infected devices</p>
            <p className="anya-stealer-archives-sub">
              Browse files per device or download the full archive.
            </p>
          </header>

          {archiveMsg ? (
            <p className="mb-2 text-xs text-zinc-400">{archiveMsg}</p>
          ) : null}

          {archives.length === 0 ? (
            <div className="anya-stealer-empty-pane">
              <Monitor className="mb-2 size-5 text-zinc-500" />
              <p>
                No infected devices linked for this query yet. Credential-only
                indexes may return logins without a victim log ID — try another
                query, or open credentials above.
              </p>
            </div>
          ) : (
            <>
              <ul className="anya-stealer-device-list">
                {visibleDevices.map((device, i) => {
                  const globalIndex = (devicePage - 1) * DEVICE_PAGE + i + 1;

                  return (
                    <li key={device.logId} className="anya-stealer-device-item">
                      <div className="anya-stealer-device-row">
                        <div className="flex min-w-0 items-start gap-2">
                          <Monitor className="mt-0.5 size-4 shrink-0 text-anya-accent" />
                          <div className="min-w-0">
                            <p className="anya-stealer-device-title">
                              Infected device #{globalIndex}
                              {device.label || device.machineId
                                ? ` · ${device.label || device.machineId}`
                                : ""}
                            </p>
                            {[
                              device.os,
                              device.malware,
                              device.country,
                              device.date?.slice(0, 10),
                            ].filter(Boolean).length > 0 ? (
                              <p className="anya-stealer-device-meta">
                                {[
                                  device.os,
                                  device.malware,
                                  device.country,
                                  device.date?.slice(0, 10),
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </p>
                            ) : null}
                            <div className="flex min-w-0 items-center gap-1.5">
                              <p className="anya-stealer-device-id truncate">
                                <BlurredValue
                                  forceBlur={blurResults}
                                  text={device.logId}
                                />
                              </p>
                              <ResultCopyButton compact text={device.logId} />
                            </div>
                          </div>
                        </div>
                        <div className="anya-stealer-device-actions">
                          <button
                            className="anya-stealer-btn anya-stealer-btn--ghost"
                            type="button"
                            onClick={() => setOpenDevice(device.logId)}
                          >
                            <Folder className="size-3.5" />
                            Browse files
                          </button>
                          <button
                            className="anya-stealer-btn anya-stealer-btn--solid"
                            disabled={archivingId === device.logId}
                            type="button"
                            onClick={() => void handleArchive(device.logId)}
                          >
                            <Archive className="size-3.5" />
                            Archive
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <PaginationBar
                page={devicePage}
                pageCount={devicePageCount}
                pageSize={DEVICE_PAGE}
                onNext={() =>
                  setDevicePage((p) => Math.min(devicePageCount, p + 1))
                }
                onPrev={() => setDevicePage((p) => Math.max(1, p - 1))}
              />
            </>
          )}
        </section>
      )}

      {openDeviceEntry ? (
        <DeviceFileExplorerModal
          archiving={archivingId === openDeviceEntry.logId}
          blurResults={blurResults}
          device={openDeviceEntry}
          index={openDeviceIndex}
          onArchive={() => void handleArchive(openDeviceEntry.logId)}
          onClose={() => setOpenDevice(null)}
        />
      ) : null}

      {fallbackRecords && fallbackRecords.length > 0 ? (
        <section className="anya-stealer-card">
          <header className="anya-stealer-archives-head">
            <p className="anya-stealer-archives-label">Related intel records</p>
            <p className="anya-stealer-archives-sub">
              Additional rows from linked indexes.
            </p>
          </header>
          <SearchResultCards
            blurResults={blurResults}
            records={fallbackRecords}
            variant="premium"
          />
        </section>
      ) : null}

      {blurResults ? <ResultsBlurNotice /> : null}
    </div>
  );
}
