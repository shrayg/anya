/**
 * Parse Discord OSINT enrichment (guilds/servers, linked accounts, contacts)
 * from OsintCat / BreachHub / CordCat / CSINT payloads.
 *
 * Guild membership lists come from stalker-style endpoints (`mutual_guilds`,
 * `guilds`, `servers`). Some upstreams only return a `mutual_servers` count.
 */

export type DiscordGuildMembership = {
  id: string;
  name: string | null;
  nick: string | null;
  iconUrl: string | null;
};

export type DiscordConnectedAccount = {
  type: string;
  name: string;
  id: string | null;
  verified: boolean | null;
};

export type DiscordOsintContacts = {
  email: string | null;
  phone: string | null;
  ip: string | null;
};

export type DiscordUsernameHistoryEntry = {
  username: string;
  changedAt: string | null;
};

export type DiscordOsintEnrichment = {
  guilds: DiscordGuildMembership[];
  /** Upstream count when only a number is returned (no guild list). */
  mutualServersCount: number;
  connections: DiscordConnectedAccount[];
  contacts: DiscordOsintContacts;
  usernameHistory: DiscordUsernameHistoryEntry[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);

  return null;
}

function asBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;

  return null;
}

function guildIconUrl(guildId: string, icon: string | null): string | null {
  if (!icon) return null;
  if (/^https?:\/\//i.test(icon)) return icon;

  const ext = icon.startsWith("a_") ? "gif" : "png";

  return `https://cdn.discordapp.com/icons/${guildId}/${icon}.${ext}?size=64`;
}

function parseGuildEntry(entry: unknown): DiscordGuildMembership | null {
  if (typeof entry === "string" || typeof entry === "number") {
    const id = String(entry).trim();

    if (!/^\d{17,20}$/.test(id)) return null;

    return { id, name: null, nick: null, iconUrl: null };
  }

  const row = asRecord(entry);

  if (!row) return null;

  const id =
    asString(row.id) ||
    asString(row.guild_id) ||
    asString(row.guildId) ||
    asString(row.server_id) ||
    asString(row.serverId);

  if (!id) return null;

  const name =
    asString(row.name) ||
    asString(row.guild_name) ||
    asString(row.guildName) ||
    asString(row.server_name) ||
    asString(row.serverName) ||
    asString(row.title);

  const nick =
    asString(row.nick) ||
    asString(row.nickname) ||
    asString(row.display_name) ||
    asString(row.displayName);

  const icon =
    asString(row.icon) ||
    asString(row.icon_url) ||
    asString(row.iconUrl) ||
    asString(row.guild_icon);

  return {
    id,
    name,
    nick,
    iconUrl: guildIconUrl(id, icon),
  };
}

function collectGuildArrays(payload: unknown, into: unknown[]): void {
  const root = asRecord(payload);

  if (!root) return;

  const candidates = [
    root.mutual_guilds,
    root.mutualGuilds,
    root.guilds,
    root.servers,
    root.mutual_servers,
    root.mutualServers,
    root.server_list,
    root.serverList,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) into.push(...candidate);
  }

  const userInfo = asRecord(root.user_info) ?? asRecord(root.userInfo);

  if (userInfo) collectGuildArrays(userInfo, into);

  const data = asRecord(root.data);

  if (data) collectGuildArrays(data, into);

  const profile = asRecord(root.profile);

  if (profile) collectGuildArrays(profile, into);

  const results = root.results;

  if (Array.isArray(results)) {
    for (const item of results) collectGuildArrays(item, into);
  }
}

export function extractDiscordGuilds(
  payload: unknown,
): DiscordGuildMembership[] {
  const raw: unknown[] = [];

  collectGuildArrays(payload, raw);

  const seen = new Set<string>();
  const out: DiscordGuildMembership[] = [];

  for (const entry of raw) {
    // Skip numeric-only mutual_servers counts collected as non-array.
    if (typeof entry === "number") continue;

    const guild = parseGuildEntry(entry);

    if (!guild || seen.has(guild.id)) continue;
    seen.add(guild.id);
    out.push(guild);
  }

  return out;
}

function readMutualServersCount(payload: unknown): number {
  const root = asRecord(payload);

  if (!root) return 0;

  for (const key of [
    "mutual_servers",
    "mutualServers",
    "mutual_guilds_count",
    "mutualGuildsCount",
    "servers_count",
    "guilds_count",
  ]) {
    const value = root[key];

    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
      return Math.floor(value);
    }
  }

  const userInfo = asRecord(root.user_info) ?? asRecord(root.userInfo);

  if (userInfo) {
    const nested = readMutualServersCount(userInfo);

    if (nested > 0) return nested;
  }

  return 0;
}

export function extractMutualServersCount(payload: unknown): number {
  return readMutualServersCount(payload);
}

function parseConnection(entry: unknown): DiscordConnectedAccount | null {
  const row = asRecord(entry);

  if (!row) return null;

  const type =
    asString(row.type) ||
    asString(row.platform) ||
    asString(row.provider) ||
    asString(row.service) ||
    "linked";
  const name =
    asString(row.name) ||
    asString(row.username) ||
    asString(row.handle) ||
    asString(row.display_name) ||
    asString(row.displayName);

  if (!name && !asString(row.id)) return null;

  return {
    type,
    name: name ?? asString(row.id) ?? type,
    id: asString(row.id),
    verified: asBoolean(row.verified),
  };
}

function collectConnectionArrays(payload: unknown, into: unknown[]): void {
  const root = asRecord(payload);

  if (!root) return;

  for (const key of [
    "connected_accounts",
    "connectedAccounts",
    "connections",
    "linked_accounts",
    "linkedAccounts",
    "accounts",
  ]) {
    if (Array.isArray(root[key])) into.push(...(root[key] as unknown[]));
  }

  const userInfo = asRecord(root.user_info) ?? asRecord(root.userInfo);

  if (userInfo) collectConnectionArrays(userInfo, into);

  const data = asRecord(root.data);

  if (data) collectConnectionArrays(data, into);

  const profile = asRecord(root.profile);

  if (profile) collectConnectionArrays(profile, into);

  if (Array.isArray(root.results)) {
    for (const item of root.results) collectConnectionArrays(item, into);
  }
}

export function extractDiscordConnections(
  payload: unknown,
): DiscordConnectedAccount[] {
  const raw: unknown[] = [];

  collectConnectionArrays(payload, raw);

  const seen = new Set<string>();
  const out: DiscordConnectedAccount[] = [];

  for (const entry of raw) {
    const connection = parseConnection(entry);

    if (!connection) continue;
    const key = `${connection.type}:${connection.name}:${connection.id ?? ""}`;

    if (seen.has(key)) continue;
    seen.add(key);
    out.push(connection);
  }

  return out;
}

function pickContact(
  payloads: unknown[],
  keys: string[],
): string | null {
  for (const payload of payloads) {
    const root = asRecord(payload);

    if (!root) continue;

    for (const key of keys) {
      const direct = asString(root[key]);

      if (direct) return direct;
    }

    const nestedSources = [
      asRecord(root.user_info),
      asRecord(root.userInfo),
      asRecord(root.osint_data),
      asRecord(root.osintData),
      asRecord(root.data),
      asRecord(root.profile),
    ];

    for (const nested of nestedSources) {
      if (!nested) continue;
      for (const key of keys) {
        const value = asString(nested[key]);

        if (value) return value;
      }
    }
  }

  return null;
}

export function extractDiscordContacts(
  ...payloads: unknown[]
): DiscordOsintContacts {
  return {
    email: pickContact(payloads, ["email", "mail"]),
    phone: pickContact(payloads, ["phone", "phone_number", "phoneNumber"]),
    ip: pickContact(payloads, ["ip", "ip_address", "ipAddress"]),
  };
}

function parseHistoryEntry(
  entry: unknown,
): DiscordUsernameHistoryEntry | null {
  if (typeof entry === "string" && entry.trim()) {
    return { username: entry.trim(), changedAt: null };
  }

  const row = asRecord(entry);

  if (!row) return null;

  const username =
    asString(row.username) ||
    asString(row.name) ||
    asString(row.handle) ||
    asString(row.global_name) ||
    asString(row.globalName);

  if (!username) return null;

  return {
    username,
    changedAt:
      asString(row.changed_at) ||
      asString(row.changedAt) ||
      asString(row.timestamp) ||
      asString(row.date) ||
      asString(row.created_at) ||
      null,
  };
}

function collectHistoryArrays(payload: unknown, into: unknown[]): void {
  const root = asRecord(payload);

  if (!root) return;

  for (const key of [
    "username_history",
    "usernameHistory",
    "name_history",
    "nameHistory",
    "history",
    "previous_usernames",
    "previousUsernames",
  ]) {
    if (Array.isArray(root[key])) into.push(...(root[key] as unknown[]));
  }

  const data = asRecord(root.data);

  if (data) collectHistoryArrays(data, into);

  if (Array.isArray(root.results)) {
    for (const item of root.results) {
      const parsed = parseHistoryEntry(item);

      if (parsed) into.push(item);
      else collectHistoryArrays(item, into);
    }
  }
}

export function extractDiscordUsernameHistory(
  payload: unknown,
): DiscordUsernameHistoryEntry[] {
  const raw: unknown[] = [];

  collectHistoryArrays(payload, raw);

  const seen = new Set<string>();
  const out: DiscordUsernameHistoryEntry[] = [];

  for (const entry of raw) {
    const item = parseHistoryEntry(entry);

    if (!item) continue;
    const key = `${item.username.toLowerCase()}:${item.changedAt ?? ""}`;

    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }

  return out;
}

export function mergeDiscordOsintEnrichment(
  ...payloads: unknown[]
): DiscordOsintEnrichment {
  const guildMap = new Map<string, DiscordGuildMembership>();
  let mutualServersCount = 0;
  const connectionMap = new Map<string, DiscordConnectedAccount>();
  const history: DiscordUsernameHistoryEntry[] = [];
  const historySeen = new Set<string>();

  for (const payload of payloads) {
    if (!payload) continue;

    for (const guild of extractDiscordGuilds(payload)) {
      const existing = guildMap.get(guild.id);

      if (!existing) {
        guildMap.set(guild.id, guild);
        continue;
      }

      guildMap.set(guild.id, {
        id: guild.id,
        name: existing.name ?? guild.name,
        nick: existing.nick ?? guild.nick,
        iconUrl: existing.iconUrl ?? guild.iconUrl,
      });
    }

    mutualServersCount = Math.max(
      mutualServersCount,
      extractMutualServersCount(payload),
    );

    for (const connection of extractDiscordConnections(payload)) {
      const key = `${connection.type}:${connection.name}:${connection.id ?? ""}`;

      if (!connectionMap.has(key)) connectionMap.set(key, connection);
    }

    for (const entry of extractDiscordUsernameHistory(payload)) {
      const key = `${entry.username.toLowerCase()}:${entry.changedAt ?? ""}`;

      if (historySeen.has(key)) continue;
      historySeen.add(key);
      history.push(entry);
    }
  }

  const guilds = [...guildMap.values()];

  return {
    guilds,
    mutualServersCount: Math.max(mutualServersCount, guilds.length),
    connections: [...connectionMap.values()],
    contacts: extractDiscordContacts(...payloads),
    usernameHistory: history,
  };
}
