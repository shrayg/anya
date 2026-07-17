"""Regex scan for PII / API key patterns in HTTP responses (passive)."""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Tuple

from ..config import ScanConfig
from ..http_client import HttpClient
from ..target import Target

# Pattern name, severity, compiled regex
PATTERNS: List[Tuple[str, str, "re.Pattern[str]"]] = [
    (
        "AWS Access Key",
        "high",
        re.compile(r"\b(AKIA[0-9A-Z]{16})\b"),
    ),
    (
        "Google API key",
        "high",
        re.compile(r"\b(AIza[0-9A-Za-z\-_]{35})\b"),
    ),
    (
        "GitHub token",
        "high",
        re.compile(r"\b(gh[pousr]_[A-Za-z0-9_]{36,})\b"),
    ),
    (
        "Slack token",
        "high",
        re.compile(r"\b(xox[baprs]-[0-9A-Za-z-]{10,})\b"),
    ),
    (
        "Stripe secret key",
        "high",
        re.compile(r"\b(sk_live_[0-9a-zA-Z]{24,})\b"),
    ),
    (
        "Private key block",
        "high",
        re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    ),
    (
        "JWT-like token",
        "medium",
        re.compile(r"\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b"),
    ),
    (
        "Generic API key assignment",
        "medium",
        re.compile(
            r"(?i)(?:api[_-]?key|apikey|secret[_-]?key|access[_-]?token)\s*[:=]\s*['\"]?([A-Za-z0-9_\-]{16,})"
        ),
    ),
    (
        "Email address",
        "low",
        re.compile(r"\b([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})\b"),
    ),
    (
        "US phone-like number",
        "info",
        re.compile(r"\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b"),
    ),
    (
        "SSN-like pattern",
        "high",
        re.compile(r"\b(?!000|666|9\d{2})\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b"),
    ),
]


def _redact(value: str) -> str:
    if len(value) <= 8:
        return "***"
    return value[:4] + "…" + value[-2:]


def scan_text(text: str, source: str, *, max_per_pattern: int = 5) -> List[Dict[str, Any]]:
    hits: List[Dict[str, Any]] = []
    if not text:
        return hits
    blob = text[:300_000]
    for name, severity, pattern in PATTERNS:
        count = 0
        for m in pattern.finditer(blob):
            if count >= max_per_pattern:
                break
            evidence = m.group(1) if m.lastindex else m.group(0)
            if name == "Email address" and evidence.lower().endswith(
                (".png", ".jpg", ".svg", ".css", ".js")
            ):
                continue
            hits.append(
                {
                    "type": name,
                    "severity": severity,
                    "source": source,
                    "evidence": _redact(evidence[:120]),
                }
            )
            count += 1
    return hits


def run(
    client: HttpClient,
    target: Target,
    config: ScanConfig,
    extra_bodies: Optional[List[Tuple[str, str]]] = None,
) -> Dict[str, Any]:
    bodies: List[Tuple[str, str]] = []
    status, body, _ = client.get_text(target.base_url)
    if body:
        bodies.append((target.base_url, body))
    if extra_bodies:
        bodies.extend(extra_bodies[: config.max_pages])

    findings: List[Dict[str, Any]] = []
    seen = set()
    for source, text in bodies:
        for hit in scan_text(text, source):
            key = (hit["type"], hit["evidence"], hit["source"])
            if key in seen:
                continue
            seen.add(key)
            findings.append(hit)
            if len(findings) >= 80:
                break
        if len(findings) >= 80:
            break

    return {
        "module": "secrets",
        "scanned_pages": len(bodies),
        "landing_status": status,
        "findings": findings,
        "note": "Passive regex scan of fetched responses. Evidence redacted. Authorized use only.",
    }
