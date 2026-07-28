/** Brand default and preset accent colors for dashboard theming. */
export const DASHBOARD_ACCENT_DEFAULT = "#c3d3e6";

export const DASHBOARD_ACCENT_PRESETS = [
  { id: "ice", label: "Ice", value: "#c3d3e6" },
  { id: "sky", label: "Sky", value: "#6ba3d4" },
  { id: "mint", label: "Mint", value: "#8fd4a8" },
  { id: "amber", label: "Amber", value: "#e0b878" },
  { id: "rose", label: "Rose", value: "#e0a8b8" },
  { id: "violet", label: "Violet", value: "#b8a8e0" },
  { id: "cyan", label: "Cyan", value: "#7ec8e3" },
] as const;

export type DashboardAccentPresetId =
  (typeof DASHBOARD_ACCENT_PRESETS)[number]["id"];

/** Compact SVG avatar presets (no upload required). */
export const AVATAR_PRESETS = [
  {
    id: "ice",
    label: "Ice",
    url: svgAvatar("#c3d3e6", "#1a2330"),
  },
  {
    id: "slate",
    label: "Slate",
    url: svgAvatar("#94a3b8", "#0f172a"),
  },
  {
    id: "mint",
    label: "Mint",
    url: svgAvatar("#8fd4a8", "#102018"),
  },
  {
    id: "amber",
    label: "Amber",
    url: svgAvatar("#e0b878", "#1f180c"),
  },
  {
    id: "rose",
    label: "Rose",
    url: svgAvatar("#e0a8b8", "#1f1218"),
  },
  {
    id: "violet",
    label: "Violet",
    url: svgAvatar("#b8a8e0", "#16121f"),
  },
] as const;

export type AvatarPresetId = (typeof AVATAR_PRESETS)[number]["id"];

const HEX_RE = /^#([0-9a-fA-F]{6})$/;
const MAX_AVATAR_CHARS = 140_000;
const MAX_DISPLAY_NAME = 40;

function svgAvatar(fill: string, bg: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><rect width="128" height="128" rx="28" fill="${bg}"/><circle cx="64" cy="48" r="22" fill="${fill}"/><ellipse cx="64" cy="104" rx="40" ry="28" fill="${fill}"/></svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function normalizeDisplayName(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim().replace(/\s+/g, " ");

  if (!trimmed) return null;
  if (trimmed.length > MAX_DISPLAY_NAME) return undefined;

  return trimmed;
}

export function normalizeDashboardAccent(
  value: unknown,
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();

  if (!HEX_RE.test(trimmed)) return undefined;

  return trimmed.toLowerCase();
}

export function normalizeAvatarUrl(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();

  if (!trimmed) return null;
  if (trimmed.length > MAX_AVATAR_CHARS) return undefined;

  if (trimmed.startsWith("data:image/")) {
    if (!/^data:image\/(png|jpeg|jpg|webp|gif|svg\+xml)/i.test(trimmed)) {
      return undefined;
    }

    return trimmed;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);

      if (url.protocol !== "http:" && url.protocol !== "https:") {
        return undefined;
      }

      return url.toString();
    } catch {
      return undefined;
    }
  }

  return undefined;
}

export function resolveAccentHover(hex: string): string {
  return `color-mix(in srgb, ${hex} 72%, white)`;
}

export function accentStyleVars(
  accent: string | null | undefined,
): Record<string, string> | undefined {
  if (!accent || !HEX_RE.test(accent)) return undefined;

  return {
    "--anya-blush": accent,
    "--anya-blush-hover": resolveAccentHover(accent),
  };
}
