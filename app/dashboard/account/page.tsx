import { redirect } from "next/navigation";

type SearchParams = Record<string, string | string[] | undefined>;

/** Account lives on the marketing shell at `/account`, not inside Panel. */
export default async function DashboardAccountRedirect({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const qs = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") qs.set(key, value);
    else if (Array.isArray(value) && value[0]) qs.set(key, value[0]);
  }

  const suffix = qs.toString();
  redirect(suffix ? `/account?${suffix}` : "/account");
}
