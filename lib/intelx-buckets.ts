/** IntelX buckets accepted by csint.pro POST /api/intelx (see docs). */
export const INTELX_BUCKETS = [
  "darknet.i2p",
  "darknet.tor",
  "dns",
  "dumpster",
  "leaks.logs",
  "leaks.private",
  "private.combs",
  "leaks.public",
  "wikileaks",
  "pastes",
  "usenet",
  "gov.ru",
  "public.af",
] as const;

export type IntelxBucket = (typeof INTELX_BUCKETS)[number];

export const INTELX_BUCKET_LABELS: Record<IntelxBucket, string> = {
  "darknet.i2p": "Darknet I2P",
  "darknet.tor": "Darknet Tor",
  dns: "DNS",
  dumpster: "Dumpster",
  "leaks.logs": "Leaks · Logs",
  "leaks.private": "Leaks · Private",
  "private.combs": "Private Combs",
  "leaks.public": "Leaks · Public",
  wikileaks: "WikiLeaks",
  pastes: "Pastes",
  usenet: "Usenet",
  "gov.ru": "Gov · Russia",
  "public.af": "Public AF",
};

export const DEFAULT_INTELX_BUCKET: IntelxBucket = "leaks.public";

export function isIntelxBucket(value: string): value is IntelxBucket {
  return (INTELX_BUCKETS as readonly string[]).includes(value);
}
