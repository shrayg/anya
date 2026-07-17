"""Recursive same-origin crawl with depth limit; forms/params/robots/sitemap."""

from __future__ import annotations

import re
from typing import Any, Dict, List, Set
from urllib.parse import parse_qsl, urljoin, urlparse

from bs4 import BeautifulSoup

from ..config import ScanConfig
from ..http_client import HttpClient
from ..target import Target


def _same_origin(url: str, origin: str) -> bool:
    try:
        p = urlparse(url)
        return f"{p.scheme}://{p.netloc}" == origin
    except Exception:
        return False


def _extract_links(soup: BeautifulSoup, page_url: str, origin: str) -> List[str]:
    links = []
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        if not href or href.startswith(("#", "mailto:", "tel:", "javascript:")):
            continue
        abs_url = urljoin(page_url, href)
        parsed = urlparse(abs_url)
        if parsed.scheme not in ("http", "https"):
            continue
        if ".." in parsed.path:
            continue
        if not _same_origin(abs_url, origin):
            continue
        clean = parsed._replace(fragment="").geturl()
        links.append(clean)
    return links


def _extract_forms(soup: BeautifulSoup, page_url: str) -> List[Dict[str, Any]]:
    forms = []
    for form in soup.find_all("form"):
        method = (form.get("method") or "GET").upper()
        action = form.get("action") or ""
        action_url = urljoin(page_url, action) if action else page_url
        inputs = []
        for tag in form.find_all(["input", "textarea", "select"]):
            name = tag.get("name")
            if not name:
                continue
            itype = tag.get("type") or tag.name
            inputs.append({"name": str(name)[:80], "type": str(itype)[:40]})
            if len(inputs) >= 24:
                break
        forms.append(
            {
                "pageUrl": page_url,
                "action": action_url[:500],
                "method": method[:12],
                "inputs": inputs,
            }
        )
    return forms


def _extract_params(url: str) -> List[str]:
    try:
        return sorted({k for k, _ in parse_qsl(urlparse(url).query, keep_blank_values=True)})
    except Exception:
        return []


def _parse_robots(text: str) -> Dict[str, Any]:
    disallow = []
    allow = []
    sitemaps = []
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        lower = line.lower()
        if lower.startswith("disallow:"):
            disallow.append(line.split(":", 1)[1].strip())
        elif lower.startswith("allow:"):
            allow.append(line.split(":", 1)[1].strip())
        elif lower.startswith("sitemap:"):
            sitemaps.append(line.split(":", 1)[1].strip())
    return {
        "disallow": disallow[:80],
        "allow": allow[:40],
        "sitemaps": sitemaps[:20],
    }


def _parse_sitemap_locs(xml: str, limit: int = 80) -> List[str]:
    locs = re.findall(r"<loc>\s*([^<\s]+)\s*</loc>", xml, flags=re.I)
    out = []
    for loc in locs:
        loc = loc.strip()
        if loc and loc not in out:
            out.append(loc)
        if len(out) >= limit:
            break
    return out


def run(client: HttpClient, target: Target, config: ScanConfig) -> Dict[str, Any]:
    origin = target.origin
    start = target.raw if target.raw.startswith("http") else target.base_url

    robots_status, robots_body, _ = client.get_text(f"{origin}/robots.txt", limit=50_000)
    robots = (
        _parse_robots(robots_body)
        if robots_status and robots_status < 400 and robots_body
        else {"disallow": [], "allow": [], "sitemaps": [], "status": robots_status}
    )
    if "status" not in robots:
        robots["status"] = robots_status

    sitemap_urls: List[str] = []
    candidates = list(robots.get("sitemaps") or []) + [f"{origin}/sitemap.xml"]
    seen_sm = set()
    for sm in candidates:
        if sm in seen_sm:
            continue
        seen_sm.add(sm)
        st, body, _ = client.get_text(sm, limit=200_000)
        if st and st < 400 and body and "<loc" in body.lower():
            for loc in _parse_sitemap_locs(body):
                if _same_origin(loc, origin) or loc.endswith(".xml"):
                    sitemap_urls.append(loc)

    queue: List[tuple[str, int]] = [(start, 0)]
    for loc in sitemap_urls:
        if loc.endswith(".xml"):
            continue
        if _same_origin(loc, origin):
            queue.append((loc, 0))

    seen: Set[str] = set()
    pages: List[Dict[str, Any]] = []
    forms: List[Dict[str, Any]] = []
    params: Set[str] = set()
    links_discovered = 0

    while queue and len(pages) < config.max_pages:
        url, depth = queue.pop(0)
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https"):
            continue
        if not _same_origin(url, origin):
            continue
        if ".." in parsed.path:
            continue
        clean = parsed._replace(fragment="").geturl()
        if clean in seen:
            continue
        seen.add(clean)

        for p in _extract_params(clean):
            params.add(p)

        status, body, headers = client.get_text(clean)
        ctype = (headers.get("content-type") or "").lower()
        title = None
        html = ""
        if status and status < 400 and ("html" in ctype or "text" in ctype or not ctype):
            html = body
            m = re.search(r"<title[^>]*>(.*?)</title>", html, re.I | re.S)
            if m:
                title = re.sub(r"\s+", " ", m.group(1)).strip()[:200]

        pages.append({"url": clean, "status": status, "title": title})

        if html:
            soup = BeautifulSoup(html, "html.parser")
            page_forms = _extract_forms(soup, clean)
            for f in page_forms:
                if len(forms) < 60:
                    forms.append(f)
            if depth < config.max_depth:
                links = _extract_links(soup, clean, origin)
                links_discovered += len(links)
                for link in links:
                    if link not in seen and len(queue) + len(pages) < config.max_pages * 3:
                        queue.append((link, depth + 1))

    return {
        "module": "crawl",
        "pagesVisited": len(pages),
        "pages": pages,
        "forms": forms,
        "params": sorted(params),
        "linksDiscovered": links_discovered,
        "robots": robots,
        "sitemapUrls": sitemap_urls[:80],
        "note": "Same-origin GET crawl only — no form submission or injection payloads.",
    }
