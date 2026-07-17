"""Shared HTTP helpers with rate limiting and concurrent.futures."""

from __future__ import annotations

import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Callable, Iterable, List, Optional, TypeVar

import requests
import urllib3

from .config import ScanConfig
from .target import Target

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

T = TypeVar("T")
U = TypeVar("U")


class RateLimiter:
    def __init__(self, delay_ms: int) -> None:
        self._delay = max(0, delay_ms) / 1000.0
        self._lock = threading.Lock()
        self._last = 0.0

    def wait(self) -> None:
        if self._delay <= 0:
            return
        with self._lock:
            now = time.monotonic()
            gap = self._last + self._delay - now
            if gap > 0:
                time.sleep(gap)
            self._last = time.monotonic()


class HttpClient:
    def __init__(self, config: ScanConfig, target: Target) -> None:
        self.config = config
        self.target = target
        self.limiter = RateLimiter(config.delay_ms)
        self.session = requests.Session()
        self.session.headers.update(
            {
                "User-Agent": config.pick_ua(),
                "Accept": "*/*",
                "Accept-Language": "en-US,en;q=0.8",
            }
        )
        self.session.headers.update(target.auth.to_headers())
        if config.proxies:
            self.session.proxies.update(config.proxies)
        self.session.verify = config.verify_tls

    def request(
        self,
        method: str,
        url: str,
        *,
        allow_redirects: bool = True,
        timeout: Optional[float] = None,
        stream: bool = False,
    ) -> requests.Response:
        self.limiter.wait()
        self.session.headers["User-Agent"] = self.config.pick_ua()
        return self.session.request(
            method,
            url,
            allow_redirects=allow_redirects,
            timeout=timeout or self.config.timeout,
            stream=stream,
        )

    def get_text(self, url: str, limit: int = 250_000) -> tuple[int, str, dict]:
        try:
            res = self.request("GET", url)
            text = (res.text or "")[:limit]
            headers = {k.lower(): v for k, v in res.headers.items()}
            return res.status_code, text, headers
        except requests.RequestException as exc:
            return 0, "", {"error": str(exc)}

    def probe_status(self, url: str) -> Optional[int]:
        try:
            res = self.request("HEAD", url, allow_redirects=False)
            if res.status_code not in (405, 501):
                return res.status_code
        except requests.RequestException:
            pass
        try:
            res = self.request("GET", url, allow_redirects=False)
            return res.status_code
        except requests.RequestException:
            return None


def map_threaded(
    items: Iterable[T],
    fn: Callable[[T], U],
    *,
    threads: int,
) -> List[U]:
    work = list(items)
    if not work:
        return []
    workers = max(1, min(threads, len(work)))
    results: List[U] = []
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = [pool.submit(fn, item) for item in work]
        for fut in as_completed(futures):
            try:
                results.append(fut.result())
            except Exception:
                continue
    return results
