"""Target parsing and auth header helpers (store/use credentials — no brute)."""

from __future__ import annotations

import base64
from dataclasses import dataclass, field
from typing import Dict, Optional
from urllib.parse import urlparse, urlunparse


@dataclass
class AuthConfig:
    """Optional credentials supplied by the operator (never guessed/bruteforced)."""

    basic_user: Optional[str] = None
    basic_pass: Optional[str] = None
    cookie: Optional[str] = None
    bearer_jwt: Optional[str] = None
    extra_headers: Dict[str, str] = field(default_factory=dict)

    def to_headers(self) -> Dict[str, str]:
        headers: Dict[str, str] = dict(self.extra_headers)
        if self.basic_user is not None:
            token = base64.b64encode(
                f"{self.basic_user}:{self.basic_pass or ''}".encode("utf-8")
            ).decode("ascii")
            headers["Authorization"] = f"Basic {token}"
        if self.bearer_jwt:
            headers["Authorization"] = f"Bearer {self.bearer_jwt.strip()}"
        if self.cookie:
            headers["Cookie"] = self.cookie.strip()
        return headers


@dataclass
class Target:
    raw: str
    scheme: str
    hostname: str
    port: Optional[int]
    path: str
    base_url: str
    origin: str
    auth: AuthConfig = field(default_factory=AuthConfig)

    @property
    def apex_guess(self) -> str:
        parts = self.hostname.split(".")
        if len(parts) >= 2:
            return ".".join(parts[-2:])
        return self.hostname


def parse_target(url: str, auth: Optional[AuthConfig] = None) -> Target:
    raw = (url or "").strip()
    if not raw:
        raise ValueError("Target URL is required.")

    if not raw.lower().startswith(("http://", "https://")):
        raw = "https://" + raw

    parsed = urlparse(raw)
    if parsed.scheme not in ("http", "https"):
        raise ValueError("Only http/https targets are supported.")
    if not parsed.hostname:
        raise ValueError("Could not parse hostname from URL.")

    hostname = parsed.hostname.lower()
    port = parsed.port
    path = parsed.path or "/"
    netloc = parsed.netloc
    origin = urlunparse((parsed.scheme, netloc, "", "", "", ""))
    base_url = origin.rstrip("/") + "/"

    return Target(
        raw=raw,
        scheme=parsed.scheme,
        hostname=hostname,
        port=port,
        path=path,
        base_url=base_url,
        origin=origin,
        auth=auth or AuthConfig(),
    )
