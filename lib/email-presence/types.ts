export type ContactPresenceKind = "email" | "phone";

export type EmailPresenceProbeResult = {
  name: string;
  domain: string;
  exists: boolean;
  rateLimit: boolean;
  error?: boolean;
  emailrecovery?: string | null;
  phoneNumber?: string | null;
  others?: Record<string, string> | null;
  profileUrl?: string | null;
};

/** Alias — same probe row shape for email and phone. */
export type ContactPresenceProbeResult = EmailPresenceProbeResult;

export type EmailPresenceHit = {
  siteName: string;
  domain: string;
  exists: boolean;
  rateLimit: boolean;
  emailrecovery: string | null;
  phoneNumber: string | null;
  profileUrl: string | null;
  others: Record<string, string> | null;
};

export type EmailPresenceSearchResult = {
  query: string;
  kind: ContactPresenceKind;
  /** Present when kind=email */
  email: string | null;
  /** Present when kind=phone (E.164-ish) */
  phone: string | null;
  count: number;
  checked: number;
  rateLimited: number;
  errors: number;
  found: EmailPresenceHit[];
  profileCount: number;
  presenceCount: number;
  sources: Array<{
    id: "email-presence";
    label: string;
    checked: number;
    count: number;
    errors: number;
    durationMs: number;
    found: EmailPresenceHit[];
    warning?: string;
  }>;
  durationMs: number;
  warning?: string;
};

export type ContactPresenceSearchResult = EmailPresenceSearchResult;
