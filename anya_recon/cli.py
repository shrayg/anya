"""Anya Recon CLI — authorized passive reconnaissance only."""

from __future__ import annotations

import argparse
import sys
from typing import Any, Dict, List, Optional, Tuple

from colorama import Fore, Style, init as colorama_init

from . import __version__
from .config import ScanConfig, parse_modules, parse_proxy
from .http_client import HttpClient
from .modules import crawl, dirs, misconfig, recon, report, secrets
from .target import AuthConfig, parse_target

BANNER = f"""
{Fore.CYAN}Anya Recon v{__version__}{Style.RESET_ALL}
Authorized use only · ethical rate limiting · no exploits / injection / brute / webshells
"""


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="anya_recon",
        description=(
            "Passive recon & hardening audit for systems you own or have "
            "written authorization to test. Rate-limited. No exploit payloads."
        ),
    )
    p.add_argument("--url", required=True, help="Target URL or hostname (authorized only)")
    p.add_argument(
        "--modules",
        default="recon,crawl,dirs,misconfig,secrets",
        help="Comma-separated: recon,crawl,dirs,misconfig,secrets",
    )
    p.add_argument("--out", default="report.html", help="HTML report path")
    p.add_argument("--pdf", action="store_true", help="Also write PDF if reportlab is installed")
    p.add_argument("--threads", type=int, default=6, help="Worker threads (default 6)")
    p.add_argument("--delay", type=int, default=200, help="Delay between requests in ms (default 200)")
    p.add_argument("--timeout", type=float, default=12.0, help="Per-request timeout seconds")
    p.add_argument("--max-depth", type=int, default=2, help="Crawl depth limit")
    p.add_argument("--max-pages", type=int, default=40, help="Crawl page cap")
    p.add_argument("--max-dirs", type=int, default=120, help="Directory wordlist cap")
    p.add_argument("--proxy", default=None, help="Optional HTTP(S) proxy URL")
    p.add_argument("--scope", default=None, help="Comma-separated allowed host suffixes")
    p.add_argument("--insecure", action="store_true", help="Skip TLS verification")
    p.add_argument("--basic-user", default=None, help="Optional Basic auth username (no brute)")
    p.add_argument("--basic-pass", default=None, help="Optional Basic auth password")
    p.add_argument("--cookie", default=None, help="Optional Cookie header value")
    p.add_argument("--jwt", default=None, help="Optional Bearer JWT (supplied by you)")
    p.add_argument(
        "--i-am-authorized",
        action="store_true",
        help="Confirm you have authorization to scan this target",
    )
    p.add_argument("--web", action="store_true", help="Launch optional Flask UI instead of CLI scan")
    return p


def run_scan(config: ScanConfig, auth: AuthConfig) -> Dict[str, Any]:
    target = parse_target(config.url, auth=auth)
    if not config.in_scope(target.hostname):
        raise SystemExit(f"Host {target.hostname} is outside configured --scope.")

    client = HttpClient(config, target)
    modules = config.sanitize_modules()
    modules_data: Dict[str, Any] = {}

    print(BANNER)
    print(f"Target: {target.origin}")
    print(f"Modules: {', '.join(modules)}")
    print(f"Rate limit: {config.threads} threads · {config.delay_ms}ms delay\n")

    crawl_bodies: List[Tuple[str, str]] = []

    if "recon" in modules:
        print(f"{Fore.GREEN}[*] recon{Style.RESET_ALL}")
        modules_data["recon"] = recon.run(client, target, config)

    if "crawl" in modules:
        print(f"{Fore.GREEN}[*] crawl{Style.RESET_ALL}")
        crawl_result = crawl.run(client, target, config)
        modules_data["crawl"] = crawl_result
        # Re-fetch a few pages for secrets with stored bodies from crawl pages
        for page in (crawl_result.get("pages") or [])[:12]:
            url = page.get("url")
            if not url:
                continue
            _, body, _ = client.get_text(url)
            if body:
                crawl_bodies.append((url, body))

    if "dirs" in modules:
        print(f"{Fore.GREEN}[*] dirs{Style.RESET_ALL}")
        modules_data["dirs"] = dirs.run(client, target, config)

    if "misconfig" in modules:
        print(f"{Fore.GREEN}[*] misconfig{Style.RESET_ALL}")
        modules_data["misconfig"] = misconfig.run(client, target, config)

    if "secrets" in modules:
        print(f"{Fore.GREEN}[*] secrets{Style.RESET_ALL}")
        modules_data["secrets"] = secrets.run(
            client, target, config, extra_bodies=crawl_bodies
        )

    result = report.build_report(target.origin, modules, modules_data)
    paths = report.write_report(result, config.out_path, pdf=config.pdf)
    print(f"\n{Fore.CYAN}Report:{Style.RESET_ALL} {paths['html']}")
    if paths.get("pdf"):
        print(f"PDF: {paths['pdf']}")
    print(f"JSON: {paths['json']}")
    print(f"Grade: {result['grade']} · findings: {len(result['findings'])}")
    return result


def main(argv: Optional[List[str]] = None) -> int:
    colorama_init()
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.web:
        from .web.app import run_web

        run_web()
        return 0

    if not args.i_am_authorized:
        print(
            f"{Fore.YELLOW}Refusing to scan without --i-am-authorized.{Style.RESET_ALL}\n"
            "Only scan systems you own or have written permission to test.",
            file=sys.stderr,
        )
        return 2

    scope = [s.strip() for s in (args.scope or "").split(",") if s.strip()]
    config = ScanConfig(
        url=args.url,
        modules=parse_modules(args.modules),
        threads=max(1, args.threads),
        delay_ms=max(0, args.delay),
        timeout=args.timeout,
        max_depth=max(0, args.max_depth),
        max_pages=max(1, args.max_pages),
        max_dirs=max(1, args.max_dirs),
        out_path=args.out,
        pdf=args.pdf,
        proxies=parse_proxy(args.proxy),
        scope_hosts=scope,
        verify_tls=not args.insecure,
        lawful_use_ack=True,
    )
    auth = AuthConfig(
        basic_user=args.basic_user,
        basic_pass=args.basic_pass,
        cookie=args.cookie,
        bearer_jwt=args.jwt,
    )
    run_scan(config, auth)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
