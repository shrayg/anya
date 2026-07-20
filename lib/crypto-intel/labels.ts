import labelsSeed from "@/lib/crypto-intel/labels.json";

export type EntityLabelTag =
  | "mixer"
  | "ofac-sanctioned"
  | "high-risk"
  | "exchange"
  | "cex"
  | "defi"
  | "dex"
  | string;

export type EntityLabel = {
  address: string;
  chain: string;
  label: string;
  tags: EntityLabelTag[];
  source: string;
};

type LabelsFile = {
  version: number;
  note?: string;
  entries: EntityLabel[];
};

const seed = labelsSeed as LabelsFile;

const BY_ADDRESS = new Map<string, EntityLabel>();

for (const entry of seed.entries) {
  BY_ADDRESS.set(normalizeAddressKey(entry.address), entry);
}

export function normalizeAddressKey(address: string): string {
  const trimmed = address.trim();

  if (trimmed.startsWith("0x")) return trimmed.toLowerCase();

  return trimmed;
}

export function lookupEntityLabel(address: string): EntityLabel | null {
  return BY_ADDRESS.get(normalizeAddressKey(address)) ?? null;
}

export function lookupEntityLabels(
  addresses: string[],
): Record<string, EntityLabel> {
  const out: Record<string, EntityLabel> = {};

  for (const address of addresses) {
    const hit = lookupEntityLabel(address);

    if (hit) out[normalizeAddressKey(address)] = hit;
  }

  return out;
}

export function isSanctionTagged(label: EntityLabel | null): boolean {
  if (!label) return false;

  return label.tags.some(
    (tag) =>
      tag === "ofac-sanctioned" ||
      tag === "sanctioned" ||
      tag.toLowerCase().includes("ofac"),
  );
}

export function isMixerTagged(label: EntityLabel | null): boolean {
  if (!label) return false;

  return label.tags.some(
    (tag) => tag === "mixer" || tag.toLowerCase().includes("mixer"),
  );
}

export function listSeedLabels(): EntityLabel[] {
  return seed.entries.slice();
}
