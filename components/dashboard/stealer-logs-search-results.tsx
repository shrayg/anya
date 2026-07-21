"use client";

import type { StealerArchiveEntry, StealerFileNode } from "@/lib/breachhub";
import type { StealerCredentialRow } from "@/lib/stealer-logs-view";

import clsx from "clsx";
import {
  Archive,
  ChevronDown,
  ChevronRight,
  Download,
  FileText,
  Folder,
  FolderOpen,
  Monitor,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { BlurredValue } from "@/components/dashboard/blurred-value";
import { ResultCopyButton } from "@/components/dashboard/result-copy-button";
import { SearchEmptyState } from "@/components/dashboard/search-empty-state";
import { ResultsBlurNotice } from "@/components/results-blur-notice";
import { apiFetch } from "@/lib/csrf-client";
import { countFileNodes } from "@/lib/stealer-logs-view";

const CRED_PAGE = 5;
const DEVICE_PAGE = 4;

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

function FileTreeNode({
  node,
  depth = 0,
}: {
  node: StealerFileNode;
  depth?: number;
}) {
  const [open, setOpen] = useState(depth < 1);
  const isFolder = node.type === "folder";
  const count = node.count ?? (node.children ? countFileNodes(node.children) : undefined);

  return (
    <div className="anya-stealer-tree-node">
      <button
        className="anya-stealer-tree-row"
        style={{ paddingLeft: `${0.55 + depth * 0.85}rem` }}
        type="button"
        onClick={() => isFolder && setOpen((v) => !v)}
      >
        <span className="anya-stealer-tree-icon">
          {isFolder ? (
            open ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )
          ) : (
            <span className="w-3.5" />
          )}
          {isFolder ? (
            open ? (
              <FolderOpen className="size-3.5 text-anya-accent" />
            ) : (
              <Folder className="size-3.5 text-anya-accent" />
            )
          ) : (
            <FileText className="size-3.5 text-zinc-500" />
          )}
        </span>
        <span className="anya-stealer-tree-name">{node.name}</span>
        {count !== undefined && isFolder ? (
          <span className="anya-stealer-tree-count">{count}</span>
        ) : null}
      </button>
      {isFolder && open && node.children?.length ? (
        <div>
          {node.children.map((child) => (
            <FileTreeNode
              key={`${child.path ?? child.name}-${child.id ?? ""}`}
              depth={depth + 1}
              node={child}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DeviceBrowser({
  device,
  index,
  blurResults,
  onHide,
  onArchive,
  archiving,
}: {
  device: StealerArchiveEntry;
  index: number;
  blurResults: boolean;
  onHide: () => void;
  onArchive: () => void;
  archiving: boolean;
}) {
  const [tab, setTab] = useState<DeviceTab>("files");
  const [manifest, setManifest] = useState<StealerArchiveEntry | null>(
    device.files?.length ? device : null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadManifest = useCallback(async () => {
    if (manifest?.files?.length) return;
    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch(
        `/api/osint/stealer-victim?logId=${encodeURIComponent(device.logId)}&action=manifest&moduleSlug=stealer-logs`,
      );
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

  const files = manifest?.files ?? device.files ?? [];
  const rootCount = files.length
    ? countFileNodes(files)
    : 0;
  const summary = manifest?.summary ?? device.summary;
  const properties = manifest?.properties ?? device.properties;
  const cookies = manifest?.cookies ?? device.cookies;

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

  return (
    <div className="anya-stealer-device-panel">
      <div className="anya-stealer-device-panel-head">
        <div className="flex items-start gap-2 min-w-0">
          <Monitor className="mt-0.5 size-4 shrink-0 text-anya-accent" />
          <div className="min-w-0">
            <p className="anya-stealer-device-title">
              Infected device #{index}
            </p>
            <div className="flex items-center gap-1.5 min-w-0">
              <p className="anya-stealer-device-id truncate">
                <BlurredValue forceBlur={blurResults} text={device.logId} />
              </p>
              <ResultCopyButton compact text={device.logId} />
            </div>
          </div>
        </div>
      </div>

      <div className="anya-stealer-device-actions">
        <button
          className="anya-stealer-btn anya-stealer-btn--ghost"
          type="button"
          onClick={onHide}
        >
          <FolderOpen className="size-3.5" />
          Hide files
        </button>
        <button
          className="anya-stealer-btn anya-stealer-btn--solid"
          disabled={archiving}
          type="button"
          onClick={onArchive}
        >
          <Download className="size-3.5" />
          {archiving ? "Preparing…" : "Archive"}
        </button>
        <span className="anya-stealer-file-manager-label">File manager</span>
      </div>

      <div className="anya-stealer-tabs" role="tablist">
        {tabs
          .filter((t) => t.show)
          .map((t) => (
            <button
              key={t.id}
              aria-selected={tab === t.id}
              className={clsx(
                "anya-stealer-tab",
                tab === t.id && "anya-stealer-tab--active",
              )}
              role="tab"
              type="button"
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
      </div>

      <div className="anya-stealer-tab-panel">
        {tab === "files" ? (
          loading ? (
            <p className="text-xs text-zinc-500">Loading file tree…</p>
          ) : error && files.length === 0 ? (
            <p className="text-xs text-zinc-500">{error}</p>
          ) : files.length === 0 ? (
            <p className="text-xs text-zinc-500">
              No file tree available for this device.
            </p>
          ) : (
            <div className="anya-stealer-tree">
              <div className="anya-stealer-tree-row anya-stealer-tree-root">
                <span className="anya-stealer-tree-icon">
                  <ChevronDown className="size-3.5" />
                  <FolderOpen className="size-3.5 text-anya-accent" />
                </span>
                <span className="anya-stealer-tree-name">/</span>
                <span className="anya-stealer-tree-count">{rootCount}</span>
              </div>
              {files.map((node) => (
                <FileTreeNode
                  key={`${node.path ?? node.name}-${node.id ?? ""}`}
                  depth={1}
                  node={node}
                />
              ))}
            </div>
          )
        ) : null}

        {tab === "summary" && summary ? (
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
        ) : null}

        {tab === "properties" && properties ? (
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
        ) : null}

        {tab === "cookies" && cookies?.length ? (
          <ul className="anya-stealer-cookie-list">
            {cookies.slice(0, 40).map((cookie, i) => (
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
        ) : null}
      </div>
    </div>
  );
}

export function StealerLogsSearchResults({
  credentials,
  archives,
  blurResults = false,
  totalCredentialCount,
}: {
  credentials: StealerCredentialRow[];
  archives: StealerArchiveEntry[];
  blurResults?: boolean;
  totalCredentialCount?: number;
}) {
  const [credPage, setCredPage] = useState(1);
  const [devicePage, setDevicePage] = useState(1);
  const [openDevice, setOpenDevice] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [archiveMsg, setArchiveMsg] = useState<string | null>(null);

  const credCount = totalCredentialCount ?? credentials.length;
  const credPageCount = Math.max(1, Math.ceil(credentials.length / CRED_PAGE));
  const devicePageCount = Math.max(1, Math.ceil(archives.length / DEVICE_PAGE));

  const visibleCreds = useMemo(() => {
    const start = (credPage - 1) * CRED_PAGE;

    return credentials.slice(start, start + CRED_PAGE);
  }, [credentials, credPage]);

  const visibleDevices = useMemo(() => {
    const start = (devicePage - 1) * DEVICE_PAGE;

    return archives.slice(start, start + DEVICE_PAGE);
  }, [archives, devicePage]);

  const handleArchive = async (logId: string) => {
    setArchivingId(logId);
    setArchiveMsg(null);

    try {
      const res = await apiFetch(
        `/api/osint/stealer-victim?logId=${encodeURIComponent(logId)}&action=archive&moduleSlug=stealer-logs`,
      );
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

  if (credentials.length === 0 && archives.length === 0) {
    return <SearchEmptyState detail="No stealer credentials or archives found." />;
  }

  return (
    <div className="anya-stealer-results">
      {credentials.length > 0 ? (
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
                      <BlurredValue forceBlur={blurResults} text={row.site || "—"} />
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
        </section>
      ) : null}

      {archives.length > 0 ? (
        <section className="anya-stealer-card">
          <header className="anya-stealer-archives-head">
            <p className="anya-stealer-archives-label">
              Linked stealer-log archives
            </p>
            <p className="anya-stealer-archives-sub">
              Browse files per device or download the full archive.
            </p>
          </header>

          {archiveMsg ? (
            <p className="mb-2 text-xs text-zinc-400">{archiveMsg}</p>
          ) : null}

          <ul className="anya-stealer-device-list">
            {visibleDevices.map((device, i) => {
              const globalIndex =
                (devicePage - 1) * DEVICE_PAGE + i + 1;
              const isOpen = openDevice === device.logId;

              return (
                <li key={device.logId} className="anya-stealer-device-item">
                  {isOpen ? (
                    <DeviceBrowser
                      archiving={archivingId === device.logId}
                      blurResults={blurResults}
                      device={device}
                      index={globalIndex}
                      onArchive={() => void handleArchive(device.logId)}
                      onHide={() => setOpenDevice(null)}
                    />
                  ) : (
                    <div className="anya-stealer-device-row">
                      <div className="flex min-w-0 items-start gap-2">
                        <Monitor className="mt-0.5 size-4 shrink-0 text-anya-accent" />
                        <div className="min-w-0">
                          <p className="anya-stealer-device-title">
                            Infected device #{globalIndex}
                          </p>
                          <div className="flex items-center gap-1.5 min-w-0">
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
                        <span className="anya-stealer-file-manager-label">
                          File manager
                        </span>
                      </div>
                    </div>
                  )}
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
        </section>
      ) : null}

      {blurResults ? <ResultsBlurNotice /> : null}
    </div>
  );
}
