"""Minimal Flask UI to run authorized scans and view reports."""

from __future__ import annotations

import tempfile
from pathlib import Path

from ..config import ScanConfig, parse_modules
from ..cli import run_scan
from ..target import AuthConfig

INDEX_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>Anya Recon</title>
  <style>
    body { font-family: Segoe UI, system-ui, sans-serif; background:#0f1218; color:#e8ecf4; max-width:720px; margin:2rem auto; padding:0 1rem; }
    h1 { color:#5eead4; }
    .banner { background:#134e4a; border:1px solid #2dd4bf; padding:.75rem 1rem; border-radius:8px; margin-bottom:1rem; }
    label { display:block; margin:.75rem 0 .25rem; color:#9aa3b5; }
    input, select { width:100%; padding:.5rem; border-radius:6px; border:1px solid #2a3348; background:#1a2030; color:#e8ecf4; }
    button { margin-top:1rem; background:#5eead4; color:#0f1218; border:0; padding:.6rem 1.2rem; border-radius:6px; font-weight:600; cursor:pointer; }
    a { color:#5eead4; }
  </style>
</head>
<body>
  <h1>Anya Recon</h1>
  <div class="banner">
    <strong>Authorized use only.</strong> Confirm you have permission to scan the target.
    Scans are rate-limited. No exploit / injection / brute-force modules.
  </div>
  <form method="post" action="/scan">
    <label>Target URL</label>
    <input name="url" placeholder="https://example.com" required/>
    <label>Modules</label>
    <input name="modules" value="recon,crawl,dirs,misconfig,secrets"/>
    <label><input type="checkbox" name="authorized" value="1" required/> I am authorized to scan this target</label>
    <button type="submit">Run scan</button>
  </form>
  {% if report_url %}<p>Report: <a href="{{ report_url }}">{{ report_url }}</a></p>{% endif %}
  {% if error %}<p style="color:#f87171">{{ error }}</p>{% endif %}
</body>
</html>
"""


def create_app():
    try:
        from flask import Flask, render_template_string, request, send_file
    except ImportError as exc:
        raise SystemExit(
            "Flask is optional. Install with: pip install flask"
        ) from exc

    app = Flask(__name__)
    reports_dir = Path(tempfile.gettempdir()) / "anya_recon_reports"
    reports_dir.mkdir(parents=True, exist_ok=True)

    @app.get("/")
    def index():
        return render_template_string(INDEX_HTML, report_url=None, error=None)

    @app.post("/scan")
    def scan():
        if not request.form.get("authorized"):
            return render_template_string(
                INDEX_HTML,
                report_url=None,
                error="Authorization checkbox required.",
            ), 400
        url = (request.form.get("url") or "").strip()
        modules = parse_modules(request.form.get("modules"))
        out = reports_dir / "last-report.html"
        config = ScanConfig(
            url=url,
            modules=modules,
            out_path=str(out),
            delay_ms=250,
            threads=4,
            lawful_use_ack=True,
        )
        try:
            run_scan(config, AuthConfig())
        except Exception as exc:
            return render_template_string(
                INDEX_HTML, report_url=None, error=str(exc)
            ), 500
        return render_template_string(
            INDEX_HTML, report_url="/report", error=None
        )

    @app.get("/report")
    def report_view():
        path = reports_dir / "last-report.html"
        if not path.exists():
            return "No report yet", 404
        return send_file(path)

    return app


def run_web(host: str = "127.0.0.1", port: int = 8765) -> None:
    app = create_app()
    print(f"Anya Recon UI — http://{host}:{port}")
    print("Authorized use only. Local bind. Rate-limited scans.")
    app.run(host=host, port=port, debug=False)
