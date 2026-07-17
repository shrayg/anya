"""Passive recon: subdomains (crt.sh + DNS), tech fingerprint, WHOIS/DNS, web ports."""

from __future__ import annotations

import re
import socket
from typing import Any, Dict, List, Optional

import requests

from ..config import ScanConfig
from ..http_client import HttpClient
from ..target import Target

WEB_PORTS = (80, 443, 8080, 8443, 8000, 3000, 5000)


def _apex(hostname: str) -> str:
    parts = hostname.split(".")
    return ".".join(parts[-2:]) if len(parts) >= 2 else hostname


def fetch_crtsh_subdomains(hostname: str, timeout: float = 18.0) -> List[str]:
    apex = _apex(hostname)
    url = f"https://crt.sh/?q=%25.{apex}&output=json"
    try:
        res = requests.get(
            url,
            timeout=timeout,
            headers={"User-Agent": "AnyaRecon/1.0 (authorized; passive CT)"},
        )
        if res.status_code != 200:
            return []
        entries = res.json()
    except Exception:
        return []

    found = set()
    for entry in entries if isinstance(entries, list) else []:
        name = entry.get("name_value") or ""
        for part in str(name).split("\n"):
            sub = part.strip().lower().lstrip("*.")
            if sub.endswith(apex) and "." in sub and " " not in sub:
                found.add(sub)
            if len(found) >= 80:
                break
        if len(found) >= 80:
            break
    return sorted(found)[:50]


def resolve_dns(hostname: str) -> Dict[str, Any]:
    out: Dict[str, Any] = {"a": [], "aaaa": [], "error": None}
    try:
        infos = socket.getaddrinfo(hostname, None)
        for info in infos:
            ip = info[4][0]
            if ":" in ip:
                if ip not in out["aaaa"]:
                    out["aaaa"].append(ip)
            else:
                if ip not in out["a"]:
                    out["a"].append(ip)
    except socket.gaierror as exc:
        out["error"] = str(exc)
    return out


def whois_lookup(hostname: str) -> Dict[str, Any]:
    """Best-effort WHOIS via python-whois if installed; otherwise skip."""
    try:
        import whois  # type: ignore
    except ImportError:
        return {"available": False, "note": "python-whois not installed (optional)"}

    try:
        data = whois.whois(hostname)
        return {
            "available": True,
            "registrar": getattr(data, "registrar", None),
            "creation_date": str(getattr(data, "creation_date", None)),
            "expiration_date": str(getattr(data, "expiration_date", None)),
            "name_servers": list(getattr(data, "name_servers", None) or [])[:12],
            "emails": list(getattr(data, "emails", None) or [])[:8]
            if not isinstance(getattr(data, "emails", None), str)
            else [getattr(data, "emails")],
        }
    except Exception as exc:
        return {"available": False, "error": str(exc)}


def check_web_ports(hostname: str, ports: tuple = WEB_PORTS, timeout: float = 1.5) -> List[Dict[str, Any]]:
    """Socket connect check on common web ports only — not a full nmap attack scan."""
    results = []
    for port in ports:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)
        try:
            open_ = sock.connect_ex((hostname, port)) == 0
        except OSError:
            open_ = False
        finally:
            sock.close()
        results.append({"port": port, "open": open_})
    return results


_TECH_PATTERNS = [
    (re.compile(r"wp-content|wordpress", re.I), "CMS: WordPress"),
    (re.compile(r"drupal\.js|Drupal\.settings", re.I), "CMS: Drupal"),
    (re.compile(r"joomla", re.I), "CMS: Joomla"),
    (re.compile(r"__NEXT_DATA__|/_next/", re.I), "Framework: Next.js"),
    (re.compile(r"ng-version|angular", re.I), "Framework: Angular"),
    (re.compile(r"react(?:-dom)?[\./]|data-reactroot", re.I), "Framework: React"),
    (re.compile(r"vue(?:\.runtime)?\.|__VUE__", re.I), "Framework: Vue"),
    (re.compile(r"shopify", re.I), "Platform: Shopify"),
    (re.compile(r"squarespace", re.I), "Platform: Squarespace"),
    (re.compile(r"wix\.com|X-Wix", re.I), "Platform: Wix"),
    (re.compile(r"laravel_session|csrf-token", re.I), "Framework: Laravel"),
    (re.compile(r"django", re.I), "Framework: Django"),
    (re.compile(r"rails|csrf-param", re.I), "Framework: Rails"),
]


def fingerprint_tech(headers: Dict[str, str], body: str = "") -> List[str]:
    hints: List[str] = []
    server = headers.get("server")
    powered = headers.get("x-powered-by")
    via = headers.get("via")
    if server:
        hints.append(f"Server: {server}")
    if powered:
        hints.append(f"Powered by: {powered}")
    if via:
        hints.append(f"Via: {via}")
    if headers.get("cf-ray") or headers.get("cf-cache-status"):
        hints.append("CDN: Cloudflare")
    if headers.get("x-vercel-id") or headers.get("x-vercel-cache"):
        hints.append("Host: Vercel")
    if headers.get("x-nf-request-id"):
        hints.append("Host: Netlify")
    if headers.get("x-amz-cf-id") or headers.get("x-amz-cf-pop"):
        hints.append("CDN: CloudFront")
    if headers.get("x-akamai-transformed"):
        hints.append("CDN: Akamai")
    if headers.get("x-generator"):
        hints.append(f"Generator: {headers['x-generator']}")
    if headers.get("x-nextjs-cache") or headers.get("x-nextjs-matched-path"):
        hints.append("Framework: Next.js")

    gen = re.search(
        r'<meta[^>]+name=["\']generator["\'][^>]+content=["\']([^"\']+)',
        body,
        re.I,
    )
    if gen:
        hints.append(f"Meta generator: {gen.group(1)[:80]}")

    blob = body[:80_000] + "\n" + "\n".join(f"{k}:{v}" for k, v in headers.items())
    for pattern, label in _TECH_PATTERNS:
        if pattern.search(blob) and label not in hints:
            hints.append(label)

    # de-dupe preserve order
    seen = set()
    ordered = []
    for h in hints:
        if h not in seen:
            seen.add(h)
            ordered.append(h)
    return ordered


def run(client: HttpClient, target: Target, config: ScanConfig) -> Dict[str, Any]:
    status, body, headers = client.get_text(target.base_url)
    dns = resolve_dns(target.hostname)
    subs = fetch_crtsh_subdomains(target.hostname, timeout=config.timeout)
    # Light DNS check on a few CT names (rate-limited via client delay elsewhere)
    resolved_subs = []
    for sub in subs[:15]:
        info = resolve_dns(sub)
        if info["a"] or info["aaaa"]:
            resolved_subs.append(
                {"host": sub, "a": info["a"][:3], "aaaa": info["aaaa"][:2]}
            )

    return {
        "module": "recon",
        "http_status": status,
        "tech": fingerprint_tech(headers, body),
        "dns": dns,
        "whois": whois_lookup(target.hostname),
        "web_ports": check_web_ports(target.hostname),
        "subdomains_ct": subs,
        "subdomains_resolved": resolved_subs,
        "note": "Passive recon only — authorized use, rate-limited, no exploit payloads.",
    }
