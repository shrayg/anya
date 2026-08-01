import {
  SITE_ANNOUNCEMENTS,
  announcementsFingerprint,
  type SiteAnnouncement,
} from "@/config/announcements";

const SEEN_KEY = "anya:announcements-seen";

export function readSeenAnnouncementIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === "string"));
  } catch {
    return new Set();
  }
}

export function writeSeenAnnouncementIds(ids: Iterable<string>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SEEN_KEY, JSON.stringify([...ids]));
  } catch {
    /* ignore quota / private mode */
  }
}

export function hasUnreadAnnouncements(
  items: readonly SiteAnnouncement[] = SITE_ANNOUNCEMENTS,
): boolean {
  if (items.length === 0) return false;
  const seen = readSeenAnnouncementIds();
  return items.some((item) => !seen.has(item.id));
}

export function markAnnouncementsSeen(
  items: readonly SiteAnnouncement[] = SITE_ANNOUNCEMENTS,
): void {
  const seen = readSeenAnnouncementIds();
  for (const item of items) seen.add(item.id);
  // Also store fingerprint key for quick equality checks by consumers if needed
  seen.add(`fp:${announcementsFingerprint(items)}`);
  writeSeenAnnouncementIds(seen);
}
