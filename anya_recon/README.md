# Anya Recon

Passive reconnaissance and hardening-audit toolkit for **authorized** targets only.

## Lawful use

- Only scan systems you **own** or have **written permission** to test.
- Default rate limiting (`--delay`, `--threads`) is intentional — do not disable ethics for speed.
- This toolkit does **not** include SQLi/XSS/CMDi payloads, sqlmap, default-cred brute force, webshells, or exploit PoCs.

## Install

```bash
cd anya_recon
pip install -r requirements.txt
```

From the repo root:

```bash
pip install -r anya_recon/requirements.txt
```

## CLI

```bash
# From repo root
python -m anya_recon --url https://example.com --i-am-authorized \
  --modules recon,crawl,dirs,misconfig,secrets --out report.html

# Or
python anya_recon/cli.py --url https://example.com --i-am-authorized \
  --modules recon,crawl,dirs,misconfig,secrets --out report.html
```

### Common options

| Flag | Purpose |
|------|---------|
| `--url` | Target URL/host (required) |
| `--modules` | `recon,crawl,dirs,misconfig,secrets` |
| `--out` | HTML report path |
| `--pdf` | Also write PDF if `reportlab` installed |
| `--threads` | Concurrent workers (default 6) |
| `--delay` | ms between requests (default 200) |
| `--max-depth` / `--max-pages` | Crawl limits |
| `--max-dirs` | Directory wordlist cap |
| `--proxy` | Optional HTTP(S) proxy |
| `--scope` | Allowed host suffixes |
| `--basic-user` / `--basic-pass` / `--cookie` / `--jwt` | Operator-supplied auth only (no brute) |
| `--i-am-authorized` | Required acknowledgement |
| `--web` | Launch optional local Flask UI |

## Modules

| Module | What it does (safe) |
|--------|---------------------|
| `recon` | crt.sh subdomains, DNS, optional WHOIS, tech fingerprint, common web-port socket check |
| `crawl` | Same-origin recursive crawl, forms/params, robots.txt, sitemap.xml |
| `dirs` | Wordlist HEAD/GET existence discovery (ffuf-style status only) |
| `misconfig` | Security headers, `.git`/`.env` exposure signals, directory listing heuristics |
| `secrets` | Regex PII / API-key patterns in fetched responses (redacted evidence) |

## Optional Flask UI

```bash
python -m anya_recon --web
# open http://127.0.0.1:8765
```

## Package layout

```
anya_recon/
  cli.py
  config.py
  target.py
  http_client.py
  modules/
    recon.py
    crawl.py
    dirs.py
    misconfig.py
    secrets.py
    report.py
  web/
    app.py
  requirements.txt
  README.md
```
