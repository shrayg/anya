export default function ModuleSearchLoading() {
  return (
    <div className="module-search px-6 py-6 md:px-8 md:py-8">
      <div className="mb-6 h-4 w-32 animate-pulse rounded bg-white/10" />
      <div className="module-search-hero mb-10 space-y-3">
        <div className="h-3 w-24 animate-pulse rounded bg-white/10" />
        <div className="h-10 w-64 animate-pulse rounded bg-white/10" />
        <div className="h-4 w-full max-w-xl animate-pulse rounded bg-white/10" />
      </div>
      <div className="anya-lookup animate-pulse">
        <div className="h-12 border-b border-white/6 bg-white/[0.03]" />
        <div className="space-y-4 p-6">
          <div className="h-12 rounded-lg bg-white/[0.06]" />
          <div className="h-10 w-28 rounded-lg bg-white/[0.08]" />
        </div>
      </div>
    </div>
  );
}
