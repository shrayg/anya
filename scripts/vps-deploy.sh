#!/usr/bin/env bash
set -euo pipefail

APP_DIR=/var/www/anya.int
ARCHIVE=/var/www/anya-deploy.tar.gz

echo "==> Stopping PM2"
pm2 stop anya-int || true

echo "==> Backing up env + db"
cp -a "$APP_DIR/.env.local" /tmp/anya.env.local
cp -a "$APP_DIR/prisma/dev.db" /tmp/anya.dev.db

echo "==> Extracting latest code"
tar -xzf "$ARCHIVE" -C "$APP_DIR"
cp -a /tmp/anya.env.local "$APP_DIR/.env.local"
cp -a /tmp/anya.dev.db "$APP_DIR/prisma/dev.db"

cd "$APP_DIR"

# Production HTTPS settings for anyaint.com
if ! grep -q '^COOKIE_SECURE=' .env.local; then
  echo 'COOKIE_SECURE=true' >> .env.local
else
  sed -i 's/^COOKIE_SECURE=.*/COOKIE_SECURE=true/' .env.local
fi
if ! grep -q '^APP_URL=' .env.local; then
  echo 'APP_URL=https://anyaint.com' >> .env.local
else
  sed -i 's|^APP_URL=.*|APP_URL=https://anyaint.com|' .env.local
fi

echo "==> npm install"
npm install

echo "==> Prisma generate + db push"
npx prisma generate
npx prisma db push

echo "==> next build"
rm -rf .next
npm run build

test -f .next/BUILD_ID
echo "BUILD_ID=$(cat .next/BUILD_ID)"

echo "==> Restart PM2"
pm2 delete anya-int || true
cd "$APP_DIR"
pm2 start npx --name anya-int -- next start -H 127.0.0.1 -p 3000
pm2 save
pm2 startup systemd -u root --hp /root >/tmp/pm2-startup.txt 2>&1 || true
# shellcheck disable=SC1091
if grep -q 'sudo env' /tmp/pm2-startup.txt; then
  bash -lc "$(grep -o 'sudo env.*' /tmp/pm2-startup.txt | head -1 | sed 's/^sudo //')" || true
fi

sleep 3
echo "==> Status"
pm2 list
ss -tlnp | grep -E ':3000|:22' || true
curl -sS -o /tmp/anya-home.html -w "HTTP %{http_code}\n" http://127.0.0.1:3000/ || true
head -c 200 /tmp/anya-home.html || true
echo
echo "==> DONE"
