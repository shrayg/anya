#!/usr/bin/env bash
set -euo pipefail

echo "==> Fix HTTPS env"
sed -i 's/^COOKIE_SECURE=.*/COOKIE_SECURE=true/' /var/www/anya.int/.env.local
sed -i 's|^APP_URL=.*|APP_URL=https://anyaint.com|' /var/www/anya.int/.env.local
grep -E '^(COOKIE_SECURE|APP_URL)=' /var/www/anya.int/.env.local

echo "==> Harden nginx (deny source maps)"
python3 - <<'PY'
from pathlib import Path
path = Path('/etc/nginx/sites-available/anyaint.com')
text = path.read_text()
snippet = """
    location ~* \\.map$ {
        deny all;
        return 404;
    }
"""
if '.map$' not in text:
    text = text.replace('location / {', snippet + '\n    location / {', 1)
    path.write_text(text)
    print('NGINX_MAP_DENY_ADDED')
else:
    print('NGINX_MAP_DENY_OK')
PY
nginx -t
systemctl reload nginx

echo "==> Bind Next to localhost only via PM2"
cd /var/www/anya.int
pm2 delete anya-int || true
pm2 start npx --name anya-int -- next start -H 127.0.0.1 -p 3000
pm2 save
sleep 2
ss -tlnp | grep -E ':3000|:80|:443' || true

echo "==> UFW: allow 22/80/443 only"
ufw --force reset >/dev/null
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
ufw status

pm2 restart anya-int --update-env
sleep 2
curl -sSI https://anyaint.com/api/auth/logout -X POST | tr -d '\r' | grep -i set-cookie || true
curl -sS -o /dev/null -w "map %{http_code}\n" https://anyaint.com/_next/static/chunks/a6dad97d9634a72d.js.map || true
curl -sS -o /dev/null -w "direct3000 %{http_code}\n" --connect-timeout 3 http://45.156.87.33:3000/ || echo "direct3000 blocked"
echo DONE
