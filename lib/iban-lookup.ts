export type IbanLookupResult = {
  iban: string;
  valid: boolean;
  bankName?: string;
  bankCode?: string;
  bic?: string;
  city?: string;
  zip?: string;
  messages: string[];
};

export function normalizeIban(input: string): string {
  return input.replace(/\s+/g, "").toUpperCase();
}

export function isValidIbanFormat(input: string): boolean {
  const iban = normalizeIban(input);

  return /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban);
}

export async function lookupIban(input: string): Promise<IbanLookupResult> {
  const iban = normalizeIban(input);

  if (!isValidIbanFormat(iban)) {
    throw new Error("Enter a valid IBAN (e.g. DE89370400440532013000).");
  }

  const res = await fetch(
    `https://openiban.com/validate/${encodeURIComponent(iban)}?getBIC=true`,
    { cache: "no-store", headers: { Accept: "application/json" } },
  );

  if (!res.ok) {
    throw new Error("IBAN validation failed");
  }

  const data = (await res.json()) as {
    valid?: boolean;
    iban?: string;
    messages?: string[];
    bankData?: {
      name?: string;
      bankCode?: string;
      bic?: string;
      city?: string;
      zip?: string;
    };
  };

  return {
    iban: data.iban ?? iban,
    valid: Boolean(data.valid),
    bankName: data.bankData?.name,
    bankCode: data.bankData?.bankCode,
    bic: data.bankData?.bic,
    city: data.bankData?.city,
    zip: data.bankData?.zip,
    messages: Array.isArray(data.messages) ? data.messages : [],
  };
}
