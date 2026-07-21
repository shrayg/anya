export type {
  HandleSweepErrorType,
  HandleSweepHit,
  HandleSweepSearchResult,
  HandleSweepSite,
} from "@/lib/handle-sweep/types";

export { getHandleSweepSites, buildHandleSweepUrl } from "@/lib/handle-sweep/sites";
export {
  searchHandleSweep,
  HANDLE_SWEEP_CONCURRENCY,
  HANDLE_SWEEP_PER_SITE_TIMEOUT_MS,
} from "@/lib/handle-sweep/search";

export const HANDLE_SWEEP_MODULE_SLUG = "handle-sweep";
export const HANDLE_SWEEP_SOURCE_ID = "handle-sweep";
export const HANDLE_SWEEP_SOURCE_LABEL = "Handle Sweep";
