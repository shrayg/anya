"""HTML (Jinja2) and optional PDF report generation."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

from jinja2 import Template

REPORT_TEMPLATE = Template(
    """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>Anya Recon Report — {{ target }}</title>
  <style>
    :root { --bg:#0f1218; --card:#1a2030; --text:#e8ecf4; --muted:#9aa3b5; --accent:#5eead4; --high:#f87171; --med:#fbbf24; --low:#38bdf8; }
    body { font-family: "Segoe UI", system-ui, sans-serif; background: var(--bg); color: var(--text); margin:0; padding:2rem; line-height:1.5; }
    h1 { font-size:1.6rem; margin:0 0 .25rem; }
    .sub { color: var(--muted); margin-bottom:1.5rem; }
    .banner { background:#134e4a; border:1px solid #2dd4bf; color:#ccfbf1; padding:.75rem 1rem; border-radius:8px; margin-bottom:1.5rem; }
    .grid { display:grid; gap:1rem; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); }
    .card { background:var(--card); border-radius:10px; padding:1rem 1.1rem; border:1px solid #2a3348; }
    h2 { font-size:1rem; margin:0 0 .6rem; color:var(--accent); }
    ul { margin:.3rem 0; padding-left:1.1rem; }
    li { margin:.2rem 0; }
    .sev-high { color:var(--high); }
    .sev-medium { color:var(--med); }
    .sev-low, .sev-info { color:var(--low); }
    pre { background:#0b0e14; padding:.75rem; border-radius:6px; overflow:auto; font-size:.75rem; }
    code { font-size:.85rem; }
  </style>
</head>
<body>
  <h1>Anya Recon</h1>
  <p class="sub">{{ target }} · {{ generated_at }} · grade {{ grade }}</p>
  <div class="banner">
    <strong>Authorized use only.</strong>
    Passive recon / hardening audit with ethical rate limiting.
    No exploit payloads, injection tests, credential brute force, or webshells.
  </div>
  <div class="grid">
    <div class="card">
      <h2>Summary</h2>
      <ul>
        <li>Modules: {{ modules|join(", ") }}</li>
        <li>Findings: {{ finding_count }}</li>
        <li>Grade: {{ grade }}</li>
      </ul>
    </div>
    {% for name, data in modules_data.items() %}
    <div class="card">
      <h2>{{ name }}</h2>
      {% if data.note %}<p class="sub">{{ data.note }}</p>{% endif %}
      <pre>{{ data | tojson(indent=2) }}</pre>
    </div>
    {% endfor %}
  </div>
  {% if findings %}
  <div class="card" style="margin-top:1rem">
    <h2>Findings</h2>
    <ul>
      {% for f in findings %}
      <li class="sev-{{ f.severity|default('info') }}">
        <strong>[{{ f.severity|default('info')|upper }}]</strong>
        {{ f.title or f.type }}
        {% if f.detail %} — {{ f.detail }}{% endif %}
        {% if f.evidence %} <code>{{ f.evidence }}</code>{% endif %}
      </li>
      {% endfor %}
    </ul>
  </div>
  {% endif %}
</body>
</html>
"""
)


def _grade(findings: list) -> str:
    high = sum(1 for f in findings if f.get("severity") == "high")
    medium = sum(1 for f in findings if f.get("severity") == "medium")
    low = sum(1 for f in findings if f.get("severity") == "low")
    if high >= 2:
        return "D"
    if high >= 1 or medium >= 3:
        return "C"
    if medium >= 1 or low >= 3:
        return "B"
    if low >= 1:
        return "A-"
    return "A"


def collect_findings(modules_data: Dict[str, Any]) -> list:
    findings = []
    for data in modules_data.values():
        if not isinstance(data, dict):
            continue
        for f in data.get("findings") or []:
            if isinstance(f, dict):
                findings.append(f)
        for hit in data.get("hits") or []:
            if isinstance(hit, dict):
                findings.append(
                    {
                        "severity": hit.get("severity", "info"),
                        "title": f"Path [{hit.get('status')}]: {hit.get('path')}",
                        "detail": "Directory/path existence hit",
                        "evidence": str(hit.get("status")),
                    }
                )
    return findings


def render_html(report: Dict[str, Any]) -> str:
    modules_data = report.get("modules") or {}
    findings = report.get("findings") or collect_findings(modules_data)
    return REPORT_TEMPLATE.render(
        target=report.get("target", ""),
        generated_at=report.get("generated_at", ""),
        modules=report.get("modules_ran") or list(modules_data.keys()),
        modules_data=modules_data,
        findings=findings,
        finding_count=len(findings),
        grade=report.get("grade") or _grade(findings),
    )


def write_report(report: Dict[str, Any], out_path: str, pdf: bool = False) -> Dict[str, Optional[str]]:
    path = Path(out_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    html = render_html(report)
    path.write_text(html, encoding="utf-8")

    pdf_path = None
    if pdf:
        pdf_path = str(path.with_suffix(".pdf"))
        try:
            from reportlab.lib.pagesizes import letter
            from reportlab.pdfgen import canvas

            c = canvas.Canvas(pdf_path, pagesize=letter)
            width, height = letter
            y = height - 40
            c.setFont("Helvetica-Bold", 14)
            c.drawString(40, y, "Anya Recon Report (authorized use only)")
            y -= 24
            c.setFont("Helvetica", 10)
            lines = [
                f"Target: {report.get('target')}",
                f"Generated: {report.get('generated_at')}",
                f"Grade: {report.get('grade')}",
                f"Modules: {', '.join(report.get('modules_ran') or [])}",
                "",
                "Passive recon / hardening audit. Rate-limited. No exploits.",
            ]
            for finding in (report.get("findings") or [])[:40]:
                title = finding.get("title") or finding.get("type") or "finding"
                sev = finding.get("severity", "info")
                lines.append(f"[{sev}] {title}")
            for line in lines:
                if y < 40:
                    c.showPage()
                    y = height - 40
                    c.setFont("Helvetica", 10)
                c.drawString(40, y, line[:110])
                y -= 14
            c.save()
        except ImportError:
            pdf_path = None

    json_sidecar = path.with_suffix(".json")
    json_sidecar.write_text(json.dumps(report, indent=2, default=str), encoding="utf-8")

    return {"html": str(path), "pdf": pdf_path, "json": str(json_sidecar)}


def build_report(
    target: str,
    modules_ran: list,
    modules_data: Dict[str, Any],
) -> Dict[str, Any]:
    findings = collect_findings(modules_data)
    return {
        "target": target,
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"),
        "modules_ran": modules_ran,
        "modules": modules_data,
        "findings": findings,
        "grade": _grade(findings),
        "lawful_use": "Authorized targets only. Ethical rate limiting. No exploit modules.",
    }
