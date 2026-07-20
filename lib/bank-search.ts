export type BankRecord = {
  name: string;
  city?: string;
  state?: string;
  zip?: string;
  assets?: string;
  offices?: string;
  website?: string;
  charter?: string;
  id?: string;
};

export type BankSearchResult = {
  query: string;
  count: number;
  banks: BankRecord[];
};

function formatAssets(value: unknown): string | undefined {
  if (typeof value !== "number") return undefined;

  return `$${(value / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })}k`;
}

function buildBankFilter(query: string): string {
  const trimmed = query.trim();

  if (/^\d{1,6}$/.test(trimmed)) {
    return `CERT:${trimmed}`;
  }

  if (/^[A-Za-z]{2}$/.test(trimmed)) {
    return `STALP:${trimmed.toUpperCase()}`;
  }

  const escaped = trimmed.replace(/[^a-zA-Z0-9\s-]/g, "").trim();

  return `NAME:*${escaped}*`;
}

export async function searchBanks(query: string): Promise<BankSearchResult> {
  const trimmed = query.trim();

  if (trimmed.length < 2) {
    throw new Error(
      "Enter a bank name, US state code (e.g. NY), or FDIC cert number.",
    );
  }

  const params = new URLSearchParams({
    filters: buildBankFilter(trimmed),
    limit: "10",
    format: "json",
    fields: "NAME,CITY,STALP,ZIP,WEBADDR,ASSET,CHARTER,OFFICES,ID",
    sort_by: "ASSET",
    sort_order: "DESC",
  });

  const res = await fetch(
    `https://banks.data.fdic.gov/api/institutions?${params}`,
    {
      cache: "no-store",
      headers: { Accept: "application/json" },
    },
  );

  if (!res.ok) {
    throw new Error("Bank institution search failed");
  }

  const data = (await res.json()) as {
    data?: Array<{ data?: Record<string, unknown> }>;
    meta?: { total?: number };
  };

  const banks = (data.data ?? [])
    .map((entry) => entry.data ?? {})
    .map((row) => ({
      name: String(row.NAME ?? "Unknown"),
      city: row.CITY ? String(row.CITY) : undefined,
      state: row.STALP ? String(row.STALP) : undefined,
      zip: row.ZIP ? String(row.ZIP) : undefined,
      assets: formatAssets(row.ASSET),
      offices: row.OFFICES ? String(row.OFFICES) : undefined,
      website: row.WEBADDR ? String(row.WEBADDR) : undefined,
      charter: row.CHARTER ? String(row.CHARTER) : undefined,
      id: row.ID ? String(row.ID) : undefined,
    }))
    .filter((bank) => bank.name !== "Unknown");

  return {
    query: trimmed,
    count: data.meta?.total ?? banks.length,
    banks,
  };
}
