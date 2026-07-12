#!/usr/bin/env bash
set -euo pipefail

echo "==> Issue SSL"
certbot --nginx -d anyaint.com -d www.anyaint.com --non-interactive --agree-tos --register-unsafely-without-email --redirect

echo "==> Update app env for HTTPS"
cd /var/www/anya.int
sed -i 's|^APP_URL=.*|APP_URL=https://anyaint.com|' .env.local
sed -i 's/^COOKIE_SECURE=.*/COOKIE_SECURE=true/' .env.local
grep -E '^(APP_URL|COOKIE_SECURE)=' .env.local

pm2 restart anya-int --update-env
sleep 2

echo "==> Verify"
curl -sS -o /dev/null -w "https_root %{http_code}\n" https://anyaint.com/ || true
curl -sS -o /dev/null -w "https_www %{http_code}\n" https://www.anyaint.com/ || true
curl -sS -o /dev/null -w "http_redirect %{http_code} -> %{redirect_url}\n" http://anyaint.com/ || true
nginx -t
pm2 list
echo DONE
