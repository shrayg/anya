"""Scan configuration: threads, delay, UA rotation, proxies, scope."""

from __future__ import annotations

import random
from dataclasses import dataclass, field
from typing import List, Optional, Sequence

DEFAULT_USER_AGENTS: Sequence[str] = (
    "AnyaRecon/1.0 (+authorized-use; rate-limited; no-exploits)",
    "Mozilla/5.0 (compatible; AnyaRecon/1.0; +https://example.local/authorized)",
    "Anya.Int-SitePentest/1.0 (passive hardening audit)",
)

DEFAULT_MODULES: Sequence[str] = (
    "recon",
    "crawl",
    "dirs",
    "misconfig",
    "secrets",
)

VALID_MODULES = frozenset(DEFAULT_MODULES)


@dataclass
class ScanConfig:
    """Runtime options for an authorized recon scan."""

    url: str
    modules: List[str] = field(default_factory=lambda: list(DEFAULT_MODULES))
    threads: int = 6
    delay_ms: int = 200
    timeout: float = 12.0
    max_depth: int = 2
    max_pages: int = 40
    max_dirs: int = 120
    out_path: str = "report.html"
    pdf: bool = False
    proxies: Optional[dict] = None
    user_agents: List[str] = field(default_factory=lambda: list(DEFAULT_USER_AGENTS))
    scope_hosts: List[str] = field(default_factory=list)
    verify_tls: bool = True
    lawful_use_ack: bool = False

    def pick_ua(self) -> str:
        return random.choice(self.user_agents) if self.user_agents else DEFAULT_USER_AGENTS[0]

    def sanitize_modules(self) -> List[str]:
        cleaned = [m.strip().lower() for m in self.modules if m.strip()]
        allowed = [m for m in cleaned if m in VALID_MODULES]
        return allowed or list(DEFAULT_MODULES)

    def in_scope(self, hostname: str) -> bool:
        host = hostname.lower().rstrip(".")
        if not self.scope_hosts:
            return True
        for allowed in self.scope_hosts:
            a = allowed.lower().rstrip(".")
            if host == a or host.endswith("." + a):
                return True
        return False


def parse_proxy(proxy: Optional[str]) -> Optional[dict]:
    if not proxy or not proxy.strip():
        return None
    p = proxy.strip()
    return {"http": p, "https": p}


def parse_modules(raw: Optional[str]) -> List[str]:
    if not raw or not raw.strip():
        return list(DEFAULT_MODULES)
    return [p.strip().lower() for p in raw.split(",") if p.strip()]
