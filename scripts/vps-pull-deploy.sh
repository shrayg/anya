#!/usr/bin/env bash
# Run ON THE VPS after git pull (or let GitHub Actions call this).
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/anya.int}"
BRANCH="${BRANCH:-main}"

cd "${APP_DIR}"

echo "==> Pull latest ${BRANCH}"
git fetch origin "${BRANCH}"
git reset --hard "origin/${BRANCH}"

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

echo "==> npm install"
npm install

echo "==> Prisma"
npx prisma generate
npx prisma db push

echo "==> Build"
rm -rf .next
npm run build
test -f .next/BUILD_ID

echo "==> Restart PM2"
pm2 delete anya-int 2>/dev/null || true
pm2 start npx --name anya-int -- next start -H 127.0.0.1 -p 3000
pm2 save

sleep 2
pm2 list
curl -sS -o /dev/null -w "Homepage HTTP %{http_code}\n" http://127.0.0.1:3000/ || true
echo "==> Deploy complete"
