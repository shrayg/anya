#!/usr/bin/env bash
set -euo pipefail

DOMAIN=anyaint.com
APP_DIR=/var/www/anya.int
UPSTREAM=127.0.0.1:3000

export DEBIAN_FRONTEND=noninteractive

echo "==> Install nginx + certbot"
apt-get update -y
apt-get install -y nginx certbot python3-certbot-nginx

echo "==> Write nginx site (HTTP first for certbot)"
cat >/etc/nginx/sites-available/anyaint.com <<'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name anyaint.com www.anyaint.com;

    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 120s;
    }
}
EOF

ln -sfn /etc/nginx/sites-available/anyaint.com /etc/nginx/sites-enabled/anyaint.com
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl enable nginx
systemctl restart nginx

echo "==> Update app env for domain"
cd "$APP_DIR"
if grep -q '^APP_URL=' .env.local; then
  sed -i 's|^APP_URL=.*|APP_URL=https://anyaint.com|' .env.local
else
  echo 'APP_URL=https://anyaint.com' >> .env.local
fi
if grep -q '^COOKIE_SECURE=' .env.local; then
  sed -i 's/^COOKIE_SECURE=.*/COOKIE_SECURE=true/' .env.local
else
  echo 'COOKIE_SECURE=true' >> .env.local
fi
# Keep HTTP usable until cert is live; certbot step may fail if DNS not ready
grep -E '^(APP_URL|COOKIE_SECURE)=' .env.local

echo "==> Attempt SSL (requires DNS A records pointing here)"
if certbot --nginx -d anyaint.com -d www.anyaint.com --non-interactive --agree-tos --register-unsafely-without-email --redirect; then
  echo SSL_OK
  # COOKIE_SECURE already true
else
  echo "SSL_PENDING: DNS may not point here yet. Leaving HTTP proxy up."
  # Until HTTPS works, cookies over HTTP need COOKIE_SECURE=false
  sed -i 's/^COOKIE_SECURE=.*/COOKIE_SECURE=false/' .env.local
  sed -i 's|^APP_URL=.*|APP_URL=http://anyaint.com|' .env.local
fi

pm2 restart anya-int --update-env
sleep 2
pm2 list
ss -tlnp | grep -E ':80|:443|:3000' || true
curl -sS -o /dev/null -w "local3000 %{http_code}\n" http://127.0.0.1:3000/ || true
curl -sS -o /dev/null -w "nginx80 %{http_code}\n" -H "Host: anyaint.com" http://127.0.0.1/ || true
echo DONE
