export type {

  IndexSweepConfidence,

  IndexSweepDork,

  IndexSweepEngine,

  IndexSweepHit,

  IndexSweepLocationFinding,

  IndexSweepMatchMode,

  IndexSweepQueryKind,

  IndexSweepSearchResult,

} from "@/lib/index-sweep/types";



export {

  INDEX_SWEEP_PLATFORMS,

  INDEX_SWEEP_UNSUPPORTED,

  platformsForQueryType,

} from "@/lib/index-sweep/platforms";



export {

  detectIndexSweepKind,

  normalizeIndexSweepEmail,

  normalizeIndexSweepPhoneDigits,

  phoneSearchVariants,

  INDEX_SWEEP_INVALID_MESSAGE,

} from "@/lib/index-sweep/normalize";



export {

  searchIndexSweep,

  resolveDorkConfidence,

  INDEX_SWEEP_SOURCE_ID,

  INDEX_SWEEP_SOURCE_LABEL,

} from "@/lib/index-sweep/search";



export const INDEX_SWEEP_MODULE_SLUG = "index-sweep";

export const PHONE_INDEX_MODULE_SLUG = "phone-index";

