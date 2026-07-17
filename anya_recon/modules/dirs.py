"""ffuf-style path existence discovery — HEAD/GET status only, no payloads."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from ..config import ScanConfig
from ..http_client import HttpClient, map_threaded
from ..target import Target

# Curated safe wordlist — common public/disclosure paths only (no traversal).
DEFAULT_WORDLIST: List[str] = [
    "robots.txt",
    "sitemap.xml",
    ".well-known/security.txt",
    "humans.txt",
    "crossdomain.xml",
    "favicon.ico",
    "admin",
    "administrator",
    "admin/login",
    "admin.php",
    "cpanel",
    "dashboard",
    "manage",
    "backend",
    "console",
    "login",
    "signin",
    "sign-in",
    "auth",
    "account",
    "user/login",
    "wp-admin",
    "wp-login.php",
    "wp-config.php",
    "wordpress",
    "xmlrpc.php",
    "joomla",
    "typo3",
    "ghost",
    "drupal",
    "phpmyadmin",
    "pma",
    "adminer",
    "adminer.php",
    "backup",
    "backups",
    "backup.zip",
    "backup.tar.gz",
    "backup.sql",
    "db.sql",
    "dump.sql",
    "site.zip",
    "www.zip",
    "old",
    "temp",
    "tmp",
    "config",
    "config.php",
    "configuration.php",
    "settings",
    "web.config",
    "appsettings.json",
    "config.json",
    ".env",
    ".env.local",
    ".env.production",
    ".env.backup",
    ".env.example",
    ".git/HEAD",
    ".git/config",
    ".svn/entries",
    ".hg",
    ".DS_Store",
    ".htaccess",
    ".htpasswd",
    "server-status",
    "server-info",
    "phpinfo.php",
    "info.php",
    "debug",
    "actuator",
    "actuator/health",
    "actuator/env",
    "swagger",
    "swagger-ui",
    "swagger-ui.html",
    "api-docs",
    "openapi.json",
    "v2/api-docs",
    "graphql",
    "graphiql",
    "api",
    "api/v1",
    "api/v2",
    "api/docs",
    "uploads",
    "upload",
    "files",
    "static",
    "assets",
    "media",
    "package.json",
    "composer.json",
    "yarn.lock",
    "package-lock.json",
    "Dockerfile",
    "docker-compose.yml",
    ".dockerenv",
    "README.md",
    "CHANGELOG.md",
    "LICENSE",
    "trace.axd",
    "elmah.axd",
    "server.js",
    "app.js",
    "main.js",
    "index.php",
    "test",
    "testing",
    "staging",
    "dev",
    "development",
    "beta",
    "internal",
    "private",
    "secret",
    "secrets",
    "keys",
    "id_rsa",
    ".ssh/id_rsa",
    "wp-content",
    "wp-includes",
    "cgi-bin",
    "bin",
    "includes",
    "vendor",
    "node_modules",
    ".vscode",
    ".idea",
    "web.config.bak",
    "config.bak",
    "database.yml",
    "credentials.json",
    "service-account.json",
]

INTERESTING = {200, 301, 302, 401, 403}


def run(
    client: HttpClient,
    target: Target,
    config: ScanConfig,
    wordlist: Optional[List[str]] = None,
) -> Dict[str, Any]:
    words = wordlist or DEFAULT_WORDLIST
    words = words[: config.max_dirs]
    base = target.origin.rstrip("/")

    def probe(path: str) -> Optional[Dict[str, Any]]:
        path = path.lstrip("/")
        if ".." in path or "\\" in path:
            return None
        url = f"{base}/{path}"
        status = client.probe_status(url)
        if status is None or status not in INTERESTING:
            return None
        severity = "info"
        if any(
            x in path
            for x in (".env", ".git", "backup", ".sql", "phpinfo", "id_rsa", "credentials")
        ):
            severity = "high"
        elif status in (401, 403) or path.startswith("admin") or "wp-" in path:
            severity = "medium"
        elif path in ("robots.txt", "sitemap.xml", ".well-known/security.txt"):
            severity = "info"
        else:
            severity = "low"
        return {"path": f"/{path}", "status": status, "severity": severity}

    hits = [h for h in map_threaded(words, probe, threads=config.threads) if h]
    hits.sort(key=lambda h: h["path"])

    return {
        "module": "dirs",
        "probed": len(words),
        "hits": hits,
        "note": "Existence discovery only (HEAD/GET). Authorized use · rate-limited · no payloads.",
    }
