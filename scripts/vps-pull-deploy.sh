#!/usr/bin/env bash
# Run ON THE VPS after git pull (or let GitHub Actions call this).
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/anya.int}"
BRANCH="${BRANCH:-main}"
MAINT_DIR="${MAINT_DIR:-/var/www/anya-maintenance}"
SECRETS_DIR="${SECRETS_DIR:-/var/www/anya-secrets}"

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

# Always try to clear maintenance if the script exits unexpectedly mid-deploy
trap 'maint_off || true' EXIT

cd "${APP_DIR}"

echo "==> Enable maintenance page before restart window"
mkdir -p "${MAINT_DIR}"
if [[ -f public/maintenance.html ]]; then
  cp -a public/maintenance.html "${MAINT_DIR}/maintenance.html"
fi
maint_on

echo "==> Pull latest ${BRANCH}"
git fetch origin "${BRANCH}"
git reset --hard "origin/${BRANCH}"
git clean -fd

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
# Optional catch-all for other provider keys you want to keep forever
if [[ -f "${SECRETS_DIR}/app.env" ]]; then
  echo "==> Restoring app secrets from ${SECRETS_DIR}/app.env"
  merge_env_file "${SECRETS_DIR}/app.env" .env.local
fi
# Keep a backup copy of the merged env outside the repo as well
if [[ -f .env.local ]]; then
  cp -a .env.local "${SECRETS_DIR}/env.local.backup"
fi

# Refresh static maintenance asset after pull
mkdir -p "${MAINT_DIR}/assets"
if [[ -f public/maintenance.html ]]; then
  cp -a public/maintenance.html "${MAINT_DIR}/maintenance.html"
fi
if [[ -f public/images/anya-logo.png ]]; then
  cp -a public/images/anya-logo.png "${MAINT_DIR}/assets/anya-logo.png"
fi

# Production defaults (edit APP_URL if your domain differs)
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

echo "==> Stop app for clean build"
pm2 stop anya-int 2>/dev/null || true
pm2 delete anya-int 2>/dev/null || true
sleep 1

echo "==> npm install"
npm install

echo "==> Prisma"
npx prisma generate
npx prisma db push --accept-data-loss

echo "==> Build"
rm -rf .next
npm run build
test -f .next/BUILD_ID

echo "==> Restart PM2"
pm2 start npx --name anya-int -- next start -H 127.0.0.1 -p 3000
pm2 save

sleep 2
pm2 list
curl -sS -o /dev/null -w "Homepage HTTP %{http_code}\n" http://127.0.0.1:3000/ || true

maint_off
trap - EXIT

echo "==> Deploy complete"
