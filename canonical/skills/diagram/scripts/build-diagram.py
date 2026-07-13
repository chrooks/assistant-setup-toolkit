#!/usr/bin/env python3
"""Fill the /diagram interactive HTML template (vendored vis-network) — safely.

Usage:
    python3 build-diagram.py <model.json> [out.html]

model.json:
    {
      "title": "Setup Wizard pipeline",
      "kind":  "architecture",           # flow|architecture|sequence|state|er|mindmap
      "nodes": [{ "id": "cli", "label": "cli.ts", "group": "entry", "description": "..." }, ...],
      "edges": [{ "from": "cli", "to": "manifest", "label": "...", "description": "..." }, ...],
      "options": {}                       # optional vis-network option overrides
    }

The node/edge JSON is injected into an inline <script>, and the vendored vis-network
library is inlined too. Any "</script>" in a label/description — or inside the minified
library — would terminate the <script> element and break the page, so both are escaped.
The title is HTML-escaped (it lands in <title>/<h1>). Self-contained + offline output.

Prints the absolute path of the written file.
"""
import json
import re
import sys
from pathlib import Path


def js_safe(s: str) -> str:
    return (
        s.replace("</script", "<\\/script")
        .replace("</SCRIPT", "<\\/SCRIPT")
        .replace("<!--", "<\\!--")
    )


def html_escape(s: str) -> str:
    return (
        s.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&#39;")
    )


def slugify(title: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    return s or "diagram"


def build(model: dict) -> str:
    base = Path(__file__).resolve().parent.parent
    tpl = (base / "templates" / "diagram-template.html").read_text()
    vis_js = (base / "vendor" / "vis-network.min.js").read_text()
    vis_css = (base / "vendor" / "vis-network.min.css").read_text()
    return (
        tpl.replace("__DIAGRAM_TITLE__", html_escape(str(model.get("title", "Diagram"))))
        .replace('/*__DIAGRAM_KIND__*/"flow"', json.dumps(str(model.get("kind", "flow"))))
        .replace("/*__DIAGRAM_NODES__*/[]", js_safe(json.dumps(model.get("nodes", []))))
        .replace("/*__DIAGRAM_EDGES__*/[]", js_safe(json.dumps(model.get("edges", []))))
        .replace("/*__DIAGRAM_OPTIONS__*/{}", js_safe(json.dumps(model.get("options", {}))))
        .replace("/*__DIAGRAM_ZONES__*/[]", js_safe(json.dumps(model.get("zones", []))))
        .replace("/*__VIS_NETWORK_JS__*/", js_safe(vis_js))
        .replace("/*__VIS_NETWORK_CSS__*/", vis_css)
    )


def main(argv: list) -> int:
    if len(argv) < 2:
        print("usage: build-diagram.py <model.json> [out.html]", file=sys.stderr)
        return 2
    model = json.loads(Path(argv[1]).read_text())
    html = build(model)
    out = (
        Path(argv[2])
        if len(argv) > 2
        else Path.cwd() / ".diagram-exports" / f"{slugify(str(model.get('title', 'diagram')))}.html"
    )
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html)
    print(out.resolve())
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
