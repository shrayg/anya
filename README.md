# Enkidu.Int

OSINT intelligence platform for investigators — breach search, stealer logs, platform lookups, AI synthesis, and case management.

Built with **Next.js 16**, **Prisma + SQLite**, and server-side intelligence provider integrations.

## Features

- **Search modules** — Email breaches, stealer logs, Discord, Roblox, FiveM, social platforms, IP/domain, crypto wallets, and more
- **AI intelligence** — Cross-source synthesis, deep scan, crypto analysis, threat briefs
- **Case management** — Save targets, notes, and intel to dossiers
- **Plans & access control** — Free through enterprise tiers with module gating
- **Admin workspace** — User management, plan assignment, staff roles
- **Live module health** — Provider status indicators in the sidebar

## Tech stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| UI | HeroUI, Tailwind CSS 4 |
| Database | SQLite via Prisma |
| Auth | JWT session cookies |
| Intelligence | GodsEye, OsintCat, ProxyNova COMB |

## Getting started

### Prerequisites

- Node.js 20+
- npm

### 1. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/anya.int.git
cd anya.int
npm install
```

### 2. Environment

Copy the example env file and fill in your values:

```bash
cp .env.example .env.local
```

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | Yes | Random string for signing session tokens |
| `COOKIE_SECURE` | Yes | `false` for HTTP, `true` for HTTPS |
| `GODSEYE_API_KEY` | Yes | GodsEye public search API key |
| `OSINTCAT_API_KEY` | Recommended | OsintCat breach / stealer index key |
| `GODSEYE_EXPORT_API_KEY` | Optional | IntelX raw export (IntelX module) |
| `CSINT_API_KEY` | Recommended | csint.pro unified intelligence API key |

**Never commit `.env.local` or API keys.**

### 3. Database

```bash
npx prisma db push
npx prisma db seed
```

Default seed creates an admin user — change the password after first login.

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Production deploy (VPS)

Example layout: `/var/www/enkidu` with **PM2** and **Node 20+**.

```bash
# On your machine — create deploy tarball
tar -czf enkidu.tar.gz \
  --exclude=node_modules \
  --exclude=.next \
  --exclude=.git \
  --exclude=prisma/dev.db \
  .

scp enkidu.tar.gz user@your-server:/var/www/

# On the server
cd /var/www && tar -xzf enkidu.tar.gz -C enkidu
cd /var/www/enkidu
cp .env.example .env.local   # then edit with production keys
npm install
npm run build
pm2 start npm --name enkidu -- start
pm2 save
```

For HTTP deployments set `COOKIE_SECURE=false`. Whitelist your VPS egress IP with GodsEye.

## Project structure

```
app/                  Next.js routes (pages + API)
components/           UI components
config/               Site branding and navigation
lib/                  Search logic, providers, auth, plans
prisma/               Schema, migrations, seed
public/               Static assets
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server (Turbopack) |
| `npm run build` | Production build |
| `npm start` | Run production server |
| `npm run lint` | ESLint |

## Security notes

- Keep `.env.local`, `prisma/dev.db`, and API keys out of git
- Rotate keys if they were ever shared or committed
- Use HTTPS in production when possible
- Restrict admin access via `isAdmin` in the database

## Links

- Telegram: [t.me/enkiduintelligence](https://t.me/enkiduintelligence)

## License

Private / proprietary. All rights reserved unless otherwise specified by the repository owner.
