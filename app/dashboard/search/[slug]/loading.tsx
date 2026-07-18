import { IntelSignalLoader } from "@/components/dashboard/intel-signal-loader";

export default function ModuleSearchLoading() {
  return (
    <div className="module-search px-6 py-6 md:px-8 md:py-8">
      <div className="module-search-hero mb-10 space-y-3">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--anya-blush)]/80">
          Platforms
        </p>
        <div className="h-9 w-48 rounded bg-white/8" />
        <div className="h-4 w-full max-w-xl rounded bg-white/5" />
      </div>
      <div className="ui-panel">
        <div className="ui-panel-body">
          <IntelSignalLoader active title="Module" />
        </div>
      </div>
    </div>
  );
}
