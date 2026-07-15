/**
 * Site branding + optional test themes.
 * - `TEST_LIME_ICON_THEME`: lime palette + logo (marketing-wide)
 * - `TEST_MAC_DASHBOARD_THEME`: soft MacBook-style workspace look
 *   Flip either flag to `false` to restore the previous appearance.
 */
export const TEST_LIME_ICON_THEME = false;

/** Soft macOS-style dashboard. Set false to undo. */
export const TEST_MAC_DASHBOARD_THEME = true;

export const siteLogoSrc = TEST_LIME_ICON_THEME
  ? "/images/anya-icon-test.png"
  : "/images/anya-logo.png";

export const siteIconSrc = TEST_LIME_ICON_THEME
  ? "/images/anya-icon-test.png"
  : "/icon.png";

export const siteLogoClassName = TEST_LIME_ICON_THEME
  ? "rounded-full object-cover ring-1 ring-lime-400/30"
  : "rounded-full object-cover ring-1 ring-white/10";

export const themeAccent = TEST_LIME_ICON_THEME
  ? {
      blush: "#b8f042",
      blushSoft: "rgba(184, 240, 66, 0.14)",
      blushGlow: "rgba(184, 240, 66, 0.38)",
      blushHover: "#d4ff7a",
      pillarTop: "#e8ffb8",
      pillarBottom: "#141908",
    }
  : {
      blush: "#f0a4b8",
      blushSoft: "rgba(240, 164, 184, 0.12)",
      blushGlow: "rgba(240, 164, 184, 0.35)",
      blushHover: "#f5b8c8",
      pillarTop: "#ffffff",
      pillarBottom: "#3d3846",
    };
