/** Lightweight client/server IP string helpers for breach result cards. */

const IPV4_RE =
  /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d{1,2})\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d{1,2})$/;

const IPV6_RE =
  /^(?:[0-9a-f]{1,4}:){2,7}[0-9a-f]{1,4}$|^::(?:[0-9a-f]{1,4}:){0,6}[0-9a-f]{1,4}$|^(?:[0-9a-f]{1,4}:){1,7}:$|^::$/i;

const IP_FIELD_KEYS = new Set([
  "ip",
  "ip_address",
  "ipaddress",
  "lastip",
  "last_ip",
  "last_ip_address",
  "client_ip",
  "remote_ip",
  "source_ip",
]);

export function isIpAddress(value: string): boolean {
  const trimmed = value.trim();

  if (!trimmed) return false;
  if (IPV4_RE.test(trimmed)) return true;
  if (trimmed.includes(":") && IPV6_RE.test(trimmed)) return true;

  return false;
}

export function isIpFieldKey(key: string): boolean {
  return IP_FIELD_KEYS.has(key.trim().toLowerCase());
}

export function extractIpsFromTexts(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const ips: string[] = [];

  for (const raw of values) {
    if (!raw) continue;
    const trimmed = raw.trim();

    if (!isIpAddress(trimmed)) continue;

    const key = trimmed.toLowerCase();

    if (seen.has(key)) continue;
    seen.add(key);
    ips.push(trimmed);
  }

  return ips;
}
