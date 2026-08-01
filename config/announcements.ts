/**
 * Site announcements / product updates.
 * Add new entries at the top — newest first. Each `id` must be unique and stable
 * (used for unread / mark-as-read via localStorage).
 */
export type SiteAnnouncement = {
  id: string;
  title: string;
  /** Plain text body; use `\n\n` for paragraphs. Sign-off can live in `signOff`. */
  body: string;
  /** Optional warm closing line (e.g. "Your Anya team <3"). */
  signOff?: string;
  /** ISO date string for display (YYYY-MM-DD). */
  date: string;
  kind?: "status" | "update" | "discord";
};

export const SITE_ANNOUNCEMENTS: readonly SiteAnnouncement[] = [
  {
    id: "2026-08-server-load",
    title: "Searches may take longer",
    body: "Searches may take a little longer right now — our servers are catching up with all of you. We're working hard to get things back to normal as soon as we can. Thank you so much for your patience.",
    signOff: "Your Anya team <3",
    date: "2026-08-01",
    kind: "status",
  },
];

/** Fingerprint of current announcement IDs — bump unread when this set changes. */
export function announcementsFingerprint(
  items: readonly SiteAnnouncement[] = SITE_ANNOUNCEMENTS,
): string {
  return items.map((item) => item.id).join("|");
}
