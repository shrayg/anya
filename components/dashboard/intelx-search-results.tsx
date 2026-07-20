"use client";

import { BlurredValue } from "@/components/dashboard/blurred-value";
import { ResultCopyButton } from "@/components/dashboard/result-copy-button";
import { ResultsBlurNotice } from "@/components/results-blur-notice";
import { INTELX_BUCKET_LABELS, isIntelxBucket } from "@/lib/intelx-buckets";
import { siteConfig } from "@/config/site";

export type IntelxSearchPayload = {
  storageId: string;
  bucket: string;
  content: string;
};

export function IntelxSearchResults({
  result,
  blurResults = false,
}: {
  result: IntelxSearchPayload;
  blurResults?: boolean;
}) {
  const bucketLabel = isIntelxBucket(result.bucket)
    ? INTELX_BUCKET_LABELS[result.bucket]
    : result.bucket;

  return (
    <div className="intelx-result space-y-4">
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="anya-result-strip">
          <p className="anya-result-label">Storage ID</p>
          <p className="anya-result-value font-mono text-xs break-all">
            <BlurredValue forceBlur={blurResults} text={result.storageId} />
          </p>
        </div>
        <div className="anya-result-strip">
          <p className="anya-result-label">Bucket</p>
          <p className="anya-result-value">
            <BlurredValue forceBlur={blurResults} text={bucketLabel} />
          </p>
        </div>
      </div>

      <div className="intelx-export">
        <div className="intelx-export-toolbar">
          <p className="text-xs text-zinc-500">
            Export · powered by {siteConfig.name}
          </p>
          <ResultCopyButton text={result.content} />
        </div>
        <pre className="intelx-export-body">
          <BlurredValue forceBlur={blurResults} text={result.content} />
        </pre>
      </div>

      {blurResults ? <ResultsBlurNotice /> : null}
    </div>
  );
}
