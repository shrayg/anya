export type BinLookupResult = {
  bin: string;
  scheme?: string;
  type?: string;
  brand?: string;
  bank?: string;
  country?: string;
  countryCode?: string;
  currency?: string;
};

export function normalizeBin(input: string): string | null {
  const digits = input.replace(/\D/g, "");

  if (digits.length < 6 || digits.length > 8) return null;

  return digits.slice(0, 8);
}

export async function lookupBin(input: string): Promise<BinLookupResult> {
  const bin = normalizeBin(input);

  if (!bin) {
    throw new Error("Enter the first 6–8 digits of a card number (BIN).");
  }

  const res = await fetch(`https://lookup.binlist.net/${bin}`, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Accept-Version": "3",
    },
  });

  if (res.status === 404) {
    throw new Error("No BIN record found for those digits.");
  }

  if (res.status === 429) {
    throw new Error("BIN lookup rate limit reached. Try again in a minute.");
  }

  if (!res.ok) {
    throw new Error("BIN lookup failed");
  }

  const data = (await res.json()) as {
    scheme?: string;
    type?: string;
    brand?: string;
    bank?: { name?: string };
    country?: { name?: string; alpha2?: string; currency?: string };
  };

  return {
    bin,
    scheme: data.scheme,
    type: data.type,
    brand: data.brand,
    bank: data.bank?.name,
    country: data.country?.name,
    countryCode: data.country?.alpha2,
    currency: data.country?.currency,
  };
}
