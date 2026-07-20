"use client";

import clsx from "clsx";
import {
  Braces,
  ChevronDown,
  Code2,
  Download,
  FileText,
  Globe,
  Table2,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import {
  EXPORT_FORMAT_LABELS,
  EXPORT_FORMATS,
  type ExportFormat,
} from "@/lib/export-intel";

const FORMAT_ICONS: Record<ExportFormat, ReactNode> = {
  json: <Braces className="size-3.5 shrink-0" strokeWidth={1.75} />,
  jsonl: <Code2 className="size-3.5 shrink-0" strokeWidth={1.75} />,
  csv: <Table2 className="size-3.5 shrink-0" strokeWidth={1.75} />,
  txt: <FileText className="size-3.5 shrink-0" strokeWidth={1.75} />,
  html: <Globe className="size-3.5 shrink-0" strokeWidth={1.75} />,
};

type ResultExportControlsProps = {
  disabled?: boolean;
  label?: string;
  onExport: (format: ExportFormat) => void;
  className?: string;
  align?: "left" | "right";
};

export function ResultExportControls({
  disabled = false,
  label = "Export",
  onExport,
  className,
  align = "right",
}: ResultExportControlsProps) {
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

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  return (
    <div ref={rootRef} className={clsx("result-export", className)}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        className="ui-btn ui-btn-ghost result-export-trigger"
        disabled={disabled}
        type="button"
        onClick={() => setOpen((current) => !current)}
      >
        <Download className="size-3.5" />
        <span>{label}</span>
        <ChevronDown
          className={clsx(
            "size-3.5 shrink-0 opacity-60 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open ? (
        <ul
          className={clsx(
            "result-export-menu",
            align === "left" && "result-export-menu--left",
          )}
          role="menu"
        >
          {EXPORT_FORMATS.map((format) => (
            <li key={format} role="none">
              <button
                className="result-export-option"
                role="menuitem"
                type="button"
                onClick={() => {
                  onExport(format);
                  setOpen(false);
                }}
              >
                <span aria-hidden className="result-export-option-icon">
                  {FORMAT_ICONS[format]}
                </span>
                <span>{EXPORT_FORMAT_LABELS[format]}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
