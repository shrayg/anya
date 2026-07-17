"""Misconfiguration signals: security headers, .git/.env exposure, directory listing."""

from __future__ import annotations

import re
from typing import Any, Dict, List

from ..config import ScanConfig
from ..http_client import HttpClient
from ..target import Target

SECURITY_HEADERS = [
    ("strict-transport-security", "Strict-Transport-Security", "medium"),
    ("content-security-policy", "Content-Security-Policy", "high"),
    ("x-frame-options", "X-Frame-Options", "medium"),
    ("x-content-type-options", "X-Content-Type-Options", "low"),
    ("referrer-policy", "Referrer-Policy", "low"),
    ("permissions-policy", "Permissions-Policy", "low"),
]

DISCLOSURE_HEADERS = ("server", "x-powered-by", "x-aspnet-version")

EXPOSURE_PATHS = (
    ".env",
    ".env.local",
    ".env.production",
    ".git/HEAD",
    ".git/config",
    ".svn/entries",
    ".DS_Store",
    ".htpasswd",
    "backup.sql",
    "phpinfo.php",
)

LISTING_RE = re.compile(
    r"(Index of /)|(Directory listing for)|(Parent Directory</a>)",
    re.I,
)


def run(client: HttpClient, target: Target, config: ScanConfig) -> Dict[str, Any]:
    findings: List[Dict[str, Any]] = []
    status, body, headers = client.get_text(target.base_url)

    present = {}
    missing = []
    for name, label, severity in SECURITY_HEADERS:
        value = headers.get(name)
        present[label] = value
        if not value:
            missing.append(label)
            findings.append(
                {
                    "id": f"missing-{name}",
                    "severity": severity,
                    "title": f"Missing {label}",
                    "detail": "Security response header not observed on the landing response.",
                }
            )

    for name in DISCLOSURE_HEADERS:
        value = headers.get(name)
        if value:
            findings.append(
                {
                    "id": f"disclosure-{name}",
                    "severity": "low",
                    "title": f"Header discloses stack: {name}",
                    "detail": "Response reveals technology details useful for attackers.",
                    "evidence": value[:200],
                }
            )

    exposures = []
    base = target.origin.rstrip("/")
    for path in EXPOSURE_PATHS:
        url = f"{base}/{path}"
        st = client.probe_status(url)
        if st in (200, 401, 403):
            sev = "high" if st == 200 else "medium"
            exposures.append({"path": f"/{path}", "status": st, "severity": sev})
            findings.append(
                {
                    "id": f"exposure-{path.replace('/', '-')}",
                    "severity": sev,
                    "title": f"Sensitive path responds [{st}]: /{path}",
                    "detail": "Common disclosure path returned a notable status (existence check only).",
                    "evidence": str(st),
                }
            )

    listing_hits = []
    for path in ("", "uploads", "files", "static", "assets", "images", "backup"):
        url = f"{base}/{path}" if path else target.base_url
        st, text, _ = client.get_text(url, limit=20_000)
        if st == 200 and text and LISTING_RE.search(text):
            listing_hits.append(url)
            findings.append(
                {
                    "id": f"dirlist-{path or 'root'}",
                    "severity": "medium",
                    "title": "Possible directory listing",
                    "detail": "Response body matches common directory-index signatures.",
                    "evidence": url,
                }
            )

    return {
        "module": "misconfig",
        "http_status": status,
        "security_headers": present,
        "missing_headers": missing,
        "exposures": exposures,
        "directory_listings": listing_hits,
        "findings": findings,
        "note": "Passive misconfig signals only — authorized use, rate-limited.",
    }
