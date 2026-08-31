import type { Metadata } from "next";

import { notFound } from "next/navigation";

import { CheatingFunnel } from "@/components/funnels/cheating-funnel";
import { CHEATING_FUNNELS, getCheatingFunnel } from "@/config/cheating-funnels";

type CheatingFunnelPageProps = {
  params: Promise<{ audience: string; slug: string }>;
};

export function generateStaticParams() {
  return CHEATING_FUNNELS.map((funnel) => ({
    audience: funnel.audience,
    slug: funnel.routeSlug,
  }));
}

export async function generateMetadata({
  params,
}: CheatingFunnelPageProps): Promise<Metadata> {
  const { audience, slug } = await params;
  const funnel = getCheatingFunnel(audience, slug);

  if (!funnel) return {};

  const path = `/go/cheating/${funnel.audience}/${funnel.routeSlug}`;

  return {
    title: funnel.hook,
    description:
      "A private guided check for public identity, profile, and connection signals. Public data only—no private-message access.",
    alternates: { canonical: `https://anyaint.com${path}` },
    robots: { index: false, follow: false },
  };
}

export default async function CheatingFunnelPage({
  params,
}: CheatingFunnelPageProps) {
  const { audience, slug } = await params;
  const funnel = getCheatingFunnel(audience, slug);

  if (!funnel) notFound();

  return <CheatingFunnel funnel={funnel} />;
}
