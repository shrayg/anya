import type {
  StealerArchiveEntry,
  StealerFileNode,
} from "@/lib/breachhub";
import { isBrandPlaceholderValue } from "@/lib/intel-record";
import { sanitizePublicText } from "@/lib/public-branding";

export type StealerCredentialRow = {
  site: string;
  username: string;
  password: string;
  date: string;
};

function asString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return "";
}

function clean(value: string): string {
  const text = sanitizePublicText(value).trim();

  if (!text || isBrandPlaceholderValue(text)) return "";
  if (/upgrade[_ ]?to[_ ]?see/i.test(text)) return "";
  if (/^\*{3,}/.test(text)) return "";

  return text;
}

/** Flatten breach/stealer result rows into SITE / USERNAME / PASSWORD / DATE. */
export function extractStealerCredentialRows(
  results: unknown[],
  query?: string,
): StealerCredentialRow[] {
  const rows: StealerCredentialRow[] = [];
  const seen = new Set<string>();
  const needle = query?.trim().toLowerCase() || "";
  const isEmail = Boolean(needle && /^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(needle));

  const matchesQuery = (site: string, username: string) => {
    if (!needle) return true;
    const blob = `${site} ${username}`.toLowerCase();

    if (blob.includes(needle)) return true;
    if (!isEmail) return blob.includes(needle);

    const [local, domain] = needle.split("@");

    return (
      username.toLowerCase() === needle ||
      (local.length >= 3 &&
        blob.includes(local) &&
        Boolean(domain) &&
        blob.includes(domain))
    );
  };

  for (const entry of results) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;

    if (Array.isArray(record.credentials)) {
      for (const cred of record.credentials) {
        if (!cred || typeof cred !== "object") continue;
        const c = cred as Record<string, unknown>;
        const site = asString(c.url) || asString(c.site) || asString(c.domain);
        const username =
          asString(c.username) || asString(c.login) || asString(c.email);

        if (!matchesQuery(site, username)) continue;

        pushCredential(rows, seen, {
          site,
          username,
          password: asString(c.password) || asString(c.pass),
          date: asString(c.date) || asString(record.date),
        });
      }
      continue;
    }

    const site =
      asString(record.url) ||
      asString(record.site) ||
      asString(record.domain) ||
      asString(record.host);
    const username =
      asString(record.username) ||
      asString(record.login) ||
      asString(record.email) ||
      asString(record.user);

    if (!matchesQuery(site, username)) continue;

    pushCredential(rows, seen, {
      site,
      username,
      password:
        asString(record.password) ||
        asString(record.pass) ||
        asString(record.secret),
      date:
        asString(record.date) ||
        asString(record.added_at) ||
        asString(record.indexed_at) ||
        asString(record.breach_date) ||
        asString(record.timestamp),
    });
  }

  return rows;
}

function pushCredential(
  rows: StealerCredentialRow[],
  seen: Set<string>,
  raw: {
    site: string;
    username: string;
    password: string;
    date: string;
  },
) {
  const site = clean(raw.site);
  const username = clean(raw.username);
  const password = clean(raw.password);
  let date = clean(raw.date);

  if (date.length > 10 && date.includes("T")) {
    date = date.slice(0, 10);
  }

  if (!site && !username && !password) return;

  const key = `${site}\0${username}\0${password}\0${date}`.toLowerCase();

  if (seen.has(key)) return;
  seen.add(key);

  rows.push({ site, username, password, date });
}

export function mergeStealerArchives(
  ...lists: StealerArchiveEntry[][]
): StealerArchiveEntry[] {
  const map = new Map<string, StealerArchiveEntry>();

  for (const list of lists) {
    for (const entry of list) {
      if (!entry.logId) continue;
      const existing = map.get(entry.logId);

      if (!existing) {
        map.set(entry.logId, entry);
        continue;
      }

      map.set(entry.logId, {
        ...existing,
        ...entry,
        credentials:
          entry.credentials?.length
            ? entry.credentials
            : existing.credentials,
        files: entry.files?.length ? entry.files : existing.files,
        cookies: entry.cookies?.length ? entry.cookies : existing.cookies,
        summary: entry.summary ?? existing.summary,
        properties: entry.properties ?? existing.properties,
      });
    }
  }

  return [...map.values()];
}

/** Pull archive IDs from generic stealer result rows when victims API is empty. */
export function archivesFromStealerResults(
  results: unknown[],
): StealerArchiveEntry[] {
  const archives: StealerArchiveEntry[] = [];
  const seen = new Set<string>();

  for (const entry of results) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const candidates = [
      asString(record.log_id),
      asString(record.logId),
      asString(record.doc_id),
      asString(record.import_id),
      asString(record.importId),
      asString(record.id),
    ];
    const logId = candidates.find(
      (value) =>
        value.length >= 24 &&
        /^[a-zA-Z0-9_-]+$/.test(value) &&
        !/^DESKTOP[-_]/i.test(value) &&
        !value.includes("."),
    );

    if (!logId || seen.has(logId)) continue;
    seen.add(logId);

    archives.push({
      logId,
      label:
        asString(record.machine_id) ||
        asString(record.hostname) ||
        undefined,
      machineId: asString(record.machine_id) || undefined,
      os: asString(record.os) || undefined,
      date: asString(record.date) || asString(record.indexed_at) || undefined,
      malware: asString(record.malware) || asString(record.stealer) || undefined,
      country: asString(record.country) || undefined,
    });
  }

  return archives;
}

export function countFileNodes(nodes: StealerFileNode[]): number {
  let total = 0;

  for (const node of nodes) {
    total += 1;
    if (node.children?.length) total += countFileNodes(node.children);
  }

  return total;
}

export type StealerLogsSearchPayload = {
  query: string;
  count: number;
  results: unknown[];
  credentials: StealerCredentialRow[];
  archives: StealerArchiveEntry[];
  message?: string;
};
