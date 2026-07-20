export type UsernameAccountCategory =
  | "coding"
  | "social"
  | "professional"
  | "video"
  | "gaming"
  | "music"
  | "photography"
  | "art"
  | "content"
  | "forum"
  | "security"
  | "education"
  | "books"
  | "fitness"
  | "ecommerce"
  | "freelance"
  | "blogging"
  | "crypto"
  | "dating"
  | "travel"
  | "links"
  | "avatar"
  | string;

export type UsernameAccountSite = {
  name: string;
  url: string;
  error_type: "status_code" | string;
  error_code: number;
  category: UsernameAccountCategory;
};

export type UsernameAccountHit = {
  siteName: string;
  category: UsernameAccountCategory;
  username: string;
  url: string;
  statusCode: number;
  found: boolean;
  responseMs: number | null;
  error?: string;
};

export type UsernameAccountsSearchResult = {
  query: string;
  username: string;
  count: number;
  checked: number;
  found: UsernameAccountHit[];
  notFound: number;
  errors: number;
  categories: Record<string, number>;
  categoryFilter: string | null;
  durationMs: number;
  warning?: string;
};
