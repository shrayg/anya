#!/usr/bin/env bash
# Run ON THE VPS after git pull (or let GitHub Actions call this).
#
# Hardened deploy rules (Jul 2026 outage postmortem):
# 1. Exclusive flock — only one deploy/build at a time.
# 2. Build-then-swap — keep serving the old `.next` until the new build is good.
# 3. Single PM2 process — never leave two `anya-int` instances on :3000.
# 4. Health check + rollback — failed swap restores the previous build.
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/anya.int}"
BRANCH="${BRANCH:-main}"
MAINT_DIR="${MAINT_DIR:-/var/www/anya-maintenance}"
SECRETS_DIR="${SECRETS_DIR:-/var/www/anya-secrets}"
DEPLOY_LOCK="${DEPLOY_LOCK:-/tmp/anya-deploy.lock}"
BUILD_DIR="${BUILD_DIR:-.next.new}"
PREV_DIR="${PREV_DIR:-.next.prev}"
PM2_NAME="${PM2_NAME:-anya-int}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/}"

# Re-exec under flock so overlapping deploys cannot race `.next` / PM2.
if [[ "${ANYA_DEPLOY_LOCKED:-}" != "1" ]]; then
  set +e
  env ANYA_DEPLOY_LOCKED=1 flock -n -E 42 "${DEPLOY_LOCK}" bash "$0" "$@"
  ec=$?
  set -e
  if [[ "${ec}" -eq 42 ]]; then
    echo "ERROR: another deploy holds ${DEPLOY_LOCK}."
    echo "Only one person should deploy at a time. Wait and retry."
    exit 1
  fi
  exit "${ec}"
fi

merge_env_file() {
  local source_file="$1"
  local target_file="$2"
  [[ -f "$source_file" ]] || return 0
  python3 - "$source_file" "$target_file" <<'PY'
from pathlib import Path
import sys
src, dst = Path(sys.argv[1]), Path(sys.argv[2])
updates = {}
for line in src.read_text().splitlines():
    line = line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    k, v = line.split("=", 1)
    updates[k.strip()] = v.strip().strip('"').strip("'")
text = dst.read_text() if dst.exists() else ""
lines = text.splitlines()
out, seen = [], set()
for line in lines:
    if line.strip() and not line.strip().startswith("#") and "=" in line:
        k = line.split("=", 1)[0].strip()
        if k in updates:
            out.append(f"{k}={updates[k]}")
            seen.add(k)
            continue
    out.append(line)
for k, v in updates.items():
    if k not in seen:
        out.append(f"{k}={v}")
dst.write_text("\n".join(out).rstrip() + "\n")
print(f"merged {src} -> {dst} ({len(updates)} keys)")
PY
}

maint_on() {
  mkdir -p "${MAINT_DIR}/assets"
  if [[ -f "${APP_DIR}/public/maintenance.html" ]]; then
    cp -a "${APP_DIR}/public/maintenance.html" "${MAINT_DIR}/maintenance.html"
  fi
  if [[ -f "${APP_DIR}/public/images/anya-logo.png" ]]; then
    cp -a "${APP_DIR}/public/images/anya-logo.png" "${MAINT_DIR}/assets/anya-logo.png"
  fi
  touch "${MAINT_DIR}/ON"
  echo "==> Maintenance mode ON"
}

maint_off() {
  rm -f "${MAINT_DIR}/ON"
  echo "==> Maintenance mode OFF"
}

pm2_online_count() {
  pm2 jlist 2>/dev/null | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
except Exception:
    print(0)
    raise SystemExit(0)
print(sum(1 for x in data if x.get('name') == '${PM2_NAME}' and x.get('pm2_env', {}).get('status') == 'online'))
"
}

free_port_3000() {
  fuser -k 3000/tcp 2>/dev/null || true
  sleep 1
}

start_anya_pm2() {
  pm2 delete "${PM2_NAME}" 2>/dev/null || true
  free_port_3000
  pm2 start npx --name "${PM2_NAME}" -- next start -H 127.0.0.1 -p 3000
  pm2 save
  sleep 3
  local count
  count="$(pm2_online_count)"
  if [[ "${count}" -ne 1 ]]; then
    echo "ERROR: expected exactly 1 online ${PM2_NAME}, found ${count}"
    pm2 list || true
    return 1
  fi
  return 0
}

health_ok() {
  local code
  code="$(curl -sS -o /dev/null -w "%{http_code}" --max-time 8 "${HEALTH_URL}" || true)"
  [[ "${code}" == "200" || "${code}" == "307" || "${code}" == "302" ]]
}

swap_build_into_place() {
  # Move newly built dist into `.next` for `next start`.
  rm -rf "${PREV_DIR}"
  if [[ -d .next ]]; then
    mv .next "${PREV_DIR}"
  fi
  mv "${BUILD_DIR}" .next
}

rollback_build() {
  echo "==> ROLLBACK: restoring previous build"
  if [[ -d "${PREV_DIR}" ]]; then
    rm -rf .next
    mv "${PREV_DIR}" .next
  fi
  start_anya_pm2 || true
}

# On unexpected failure after we took the app down for swap, try to bring
# something back and clear maintenance. Before swap, the old process may still
# be serving — don't kill it from the trap.
SWAP_STARTED=0
cleanup_on_exit() {
  local ec=$?
  if [[ "${SWAP_STARTED}" -eq 1 && "${ec}" -ne 0 ]]; then
    rollback_build || true
  fi
  # If deploy failed before swap, leave the running app alone.
  # Always clear maintenance so we don't leave the site in maint forever.
  maint_off || true
}
trap cleanup_on_exit EXIT

cd "${APP_DIR}"

echo "==> Deploy lock acquired (${DEPLOY_LOCK})"
echo "==> Refusing to proceed if another next build is already running"
if pgrep -af "[n]ext build" >/dev/null 2>&1; then
  echo "ERROR: another next build is running. Wait or kill it, then retry."
  pgrep -af "[n]ext build" || true
  exit 1
fi
# Stale lock files from killed builds
rm -f .next/lock "${BUILD_DIR}/lock" 2>/dev/null || true

echo "==> Pull latest ${BRANCH} (app keeps serving old build)"
git fetch origin "${BRANCH}"
git reset --hard "origin/${BRANCH}"
# Keep runtime/secrets artifacts; only clean untracked junk that isn't protected.
git clean -fd -e .env.local -e .env -e 'prisma/dev.db' -e '.next' -e '.next.prev' -e '.next.new' -e 'data' -e 'data/status-history.json'

if [[ -f .env.local ]]; then
  cp -a .env.local /tmp/anya.env.local.bak
fi
if [[ -f prisma/dev.db ]]; then
  cp -a prisma/dev.db /tmp/anya.dev.db.bak
fi

if [[ -f /tmp/anya.env.local.bak ]]; then
  cp -a /tmp/anya.env.local.bak .env.local
fi
if [[ -f /tmp/anya.dev.db.bak ]]; then
  mkdir -p prisma
  cp -a /tmp/anya.dev.db.bak prisma/dev.db
fi

# Durable secrets live outside the git checkout and always win on deploy.
mkdir -p "${SECRETS_DIR}"
chmod 700 "${SECRETS_DIR}" || true
if [[ -f "${SECRETS_DIR}/instagram.env" ]]; then
  echo "==> Restoring Instagram session from ${SECRETS_DIR}/instagram.env"
  merge_env_file "${SECRETS_DIR}/instagram.env" .env.local
fi

if [[ -f "${SECRETS_DIR}/instagram-accounts.json" ]]; then
  echo "==> Restoring Instagram account pool from ${SECRETS_DIR}/instagram-accounts.json"
  cp -f "${SECRETS_DIR}/instagram-accounts.json" .instagram-accounts.json
  chmod 600 .instagram-accounts.json || true
fi
if [[ -f "${SECRETS_DIR}/app.env" ]]; then
  echo "==> Restoring app secrets from ${SECRETS_DIR}/app.env"
  merge_env_file "${SECRETS_DIR}/app.env" .env.local
fi
if [[ -f "${SECRETS_DIR}/hinge.env" ]]; then
  echo "==> Restoring Hinge Live secrets from ${SECRETS_DIR}/hinge.env"
  merge_env_file "${SECRETS_DIR}/hinge.env" .env.local
fi
if [[ -f "${SECRETS_DIR}/oxapay.env" ]]; then
  echo "==> Restoring OxaPay secrets from ${SECRETS_DIR}/oxapay.env"
  merge_env_file "${SECRETS_DIR}/oxapay.env" .env.local
fi
if [[ -f .env.local ]]; then
  cp -a .env.local "${SECRETS_DIR}/env.local.backup"
fi

# Refresh static maintenance assets (used only during the short cutover window)
mkdir -p "${MAINT_DIR}/assets"
if [[ -f public/maintenance.html ]]; then
  cp -a public/maintenance.html "${MAINT_DIR}/maintenance.html"
fi
if [[ -f public/images/anya-logo.png ]]; then
  cp -a public/images/anya-logo.png "${MAINT_DIR}/assets/anya-logo.png"
fi

# Production defaults
if [[ -f .env.local ]]; then
  if ! grep -q '^COOKIE_SECURE=' .env.local; then
    echo 'COOKIE_SECURE=true' >> .env.local
  else
    sed -i 's/^COOKIE_SECURE=.*/COOKIE_SECURE=true/' .env.local
  fi
  if ! grep -q '^APP_URL=' .env.local; then
    echo 'APP_URL=https://anyaint.com' >> .env.local
  fi
fi

echo "==> npm install (full deps — required for Next/Tailwind build)"
npm install

echo "==> Prisma"
npx prisma generate
# SQLite production sync — applies schema.prisma fields (displayName, avatarUrl,
# dashboardAccent, onboardingCompletedAt) without a separate migrate history.
npx prisma db push --accept-data-loss
# Existing accounts: mark onboarding done so only new signups see the stepper.
npx tsx scripts/backfill-onboarding-completed.ts || true

echo "==> Build into ${BUILD_DIR} while old app keeps serving .next"
rm -rf "${BUILD_DIR}"
NEXT_DIST_DIR="${BUILD_DIR}" npm run build
test -f "${BUILD_DIR}/BUILD_ID"
echo "==> New build OK ($(cat "${BUILD_DIR}/BUILD_ID"))"

echo "==> Short cutover window"
maint_on
SWAP_STARTED=1

# Stop old process only now that the new build exists.
pm2 stop "${PM2_NAME}" 2>/dev/null || true
pm2 delete "${PM2_NAME}" 2>/dev/null || true
free_port_3000

swap_build_into_place
start_anya_pm2

if ! health_ok; then
  echo "ERROR: health check failed after swap — rolling back"
  rollback_build
  SWAP_STARTED=0
  if ! health_ok; then
    echo "ERROR: rollback health check also failed"
    exit 1
  fi
  echo "ERROR: deploy rolled back to previous build"
  exit 1
fi

# Successful cutover — drop previous build to save disk (keep one generation optional)
rm -rf "${PREV_DIR}" "${BUILD_DIR}"
SWAP_STARTED=0

pm2 list
curl -sS -o /dev/null -w "Homepage HTTP %{http_code}\n" "${HEALTH_URL}" || true

maint_off
trap - EXIT

echo "==> Deploy complete (build-then-swap, single ${PM2_NAME})"
