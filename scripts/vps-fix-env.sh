#!/usr/bin/env bash
set -euo pipefail
python3 - <<'PY'
from pathlib import Path
import secrets
p = Path('/var/www/anya.int/.env.local')
text = p.read_text() if p.exists() else ''
lines = text.splitlines()
out = []
changed = False
seen = set()
for line in lines:
    if line.startswith('JWT_SECRET='):
        val = line.split('=', 1)[1].strip()
        if not val or val in ('change-me', 'super-secret-jwt-key'):
            val = secrets.token_urlsafe(48)
            line = f'JWT_SECRET={val}'
            changed = True
        out.append(line)
        seen.add('JWT_SECRET')
    elif line.startswith('COOKIE_SECURE='):
        out.append('COOKIE_SECURE=true')
        changed = True
        seen.add('COOKIE_SECURE')
    elif line.startswith('APP_URL='):
        out.append('APP_URL=https://anyaint.com')
        changed = True
        seen.add('APP_URL')
    else:
        out.append(line)
if 'JWT_SECRET' not in seen:
    out.append('JWT_SECRET=' + secrets.token_urlsafe(48))
    changed = True
if 'COOKIE_SECURE' not in seen:
    out.append('COOKIE_SECURE=true')
    changed = True
if 'APP_URL' not in seen:
    out.append('APP_URL=https://anyaint.com')
    changed = True
p.write_text('\n'.join(out) + '\n')
print('ENV_UPDATED' if changed else 'ENV_OK')
print('JWT_LEN', len([l for l in out if l.startswith('JWT_SECRET=')][0].split('=',1)[1]))
PY
