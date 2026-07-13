#!/usr/bin/env bash
# Try to recover the old pricing files from a previous tarball deploy.
set -euo pipefail

ARCHIVE="${1:-/var/www/anya-deploy.tar.gz}"
OUT_DIR="${2:-/tmp/anya-old-pricing}"

if [[ ! -f "${ARCHIVE}" ]]; then
  echo "Archive not found: ${ARCHIVE}"
  echo "Try: ls -la /var/www/*.tar.gz"
  exit 1
fi

mkdir -p "${OUT_DIR}"

echo "==> Listing pricing-related paths in archive..."
tar -tzf "${ARCHIVE}" | grep -E 'pricing|plans\.ts|billing' || true

echo
echo "==> Extracting..."
for path in \
  components/pricing-page-content.tsx \
  lib/plans.ts \
  app/api/billing/checkout/route.ts \
  app/\(marketing\)/pricing/page.tsx
do
  if tar -tzf "${ARCHIVE}" "${path}" >/dev/null 2>&1; then
    tar -xzf "${ARCHIVE}" -C "${OUT_DIR}" "${path}"
    echo "  recovered ${path}"
  fi
done

echo
echo "==> Recovered files in ${OUT_DIR}"
find "${OUT_DIR}" -type f

echo
echo "==> Preview lib/plans.ts (first 80 lines)"
if [[ -f "${OUT_DIR}/lib/plans.ts" ]]; then
  head -n 80 "${OUT_DIR}/lib/plans.ts"
else
  echo "  (not in archive)"
fi

echo
echo "Copy these files back into the repo or paste them in chat to restore."
