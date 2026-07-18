import Link from "next/link";

export const dynamic = "force-dynamic";

export default function NotFound() {
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">404</p>
      <h1 className="text-2xl font-semibold text-white">Page not found</h1>
      <p className="max-w-md text-sm text-zinc-400">
        That route does not exist or may have moved.
      </p>
      <Link
        className="mt-2 text-sm text-zinc-200 underline-offset-4 hover:underline"
        href="/"
      >
        Back to home
      </Link>
    </main>
  );
}
