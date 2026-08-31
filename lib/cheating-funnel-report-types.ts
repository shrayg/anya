export type CheatingReportAnswer = {
  question: string;
  answer: string;
};

export type CheatingReportField = {
  label: string;
  value: string;
  group?: string;
};

export type CheatingReportRecord = {
  title: string;
  subtitle?: string;
  badge?: string;
  fields: CheatingReportField[];
};

export type CheatingReportPayload = {
  campaignId: string;
  audience: "men" | "women";
  hook: string;
  searchedPhone: string;
  generatedAt: string;
  answers: CheatingReportAnswer[];
  records: CheatingReportRecord[];
  totalCount: number;
  /** Vault that was unlocked for this report; required for PDF/email export. */
  vaultId?: string;
};
