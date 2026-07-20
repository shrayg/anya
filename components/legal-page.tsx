import type { ReactNode } from "react";

import NextLink from "next/link";

type LegalPageProps = {
  title: string;
  updated: string;
  children: ReactNode;
};

export function LegalPage({ title, updated, children }: LegalPageProps) {
  return (
    <article className="brutal-page brutal-legal-page relative z-20 mx-auto w-full max-w-3xl px-2 pb-20 pt-6 md:pt-10">
      <header className="brutal-page-header mb-10 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--anya-blush)]">
          Legal
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
          {title}
        </h1>
        <p className="text-sm text-zinc-500">Last updated: {updated}</p>
      </header>

      <div className="legal-prose space-y-6 text-[0.95rem] leading-7 text-zinc-300">
        {children}
      </div>

      <p className="mt-12 text-sm text-zinc-500">
        Questions?{" "}
        <NextLink
          className="text-zinc-200 underline-offset-4 hover:underline"
          href="/faq"
        >
          FAQ
        </NextLink>{" "}
        or email{" "}
        <a
          className="text-zinc-200 underline-offset-4 hover:underline"
          href="mailto:support@anyaint.com"
        >
          support@anyaint.com
        </a>
        .
      </p>
    </article>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
