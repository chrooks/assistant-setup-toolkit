#!/usr/bin/env python3
"""Fill the /figure interactive HTML template from a JSON spec — safely.

Usage:
    python3 build-figure.py <spec.json> [out.html]

spec.json (high-level — the common path):
    {
      "title":    "Revenue by month",
      "subtitle": "FY25, USD",
      "type":     "line",            # bar|barh|line|area|dot|scatter
      "data":     [{ "month": "Jan", "revenue": 100, "region": "NA" }, ...],
      "x":        "month",
      "y":        "revenue",
      "series":   "region",          # optional → color split + legend
      "options":  { "marginLeft": 60, "y": { "grid": true } }   # optional Plot passthrough (data only)
    }

spec.json (raw escape hatch — when Plot's high-level shape can't express it):
    {
      "title": "...",
      "plot":  { "marginLeft": 60, "marks": [{ "mark": "barY", "data": [...], "options": { "x": "a", "y": "b" } }] }
    }

The whole spec (data included) is injected as JSON inside an inline <script>. A value
containing "</script>" would otherwise terminate the script element before the JS runs.
js_safe() neutralizes that for the HTML tokenizer without changing the JSON string. The
title is HTML-escaped because it lands in <title>/<h1>.

Prints the absolute path of the written file.
"""
import json
import re
import sys
from pathlib import Path


def js_safe(s: str) -> str:
    """Neutralize HTML script-termination inside an inline <script>.

    "<\\/script" is an identical JSON/JS string to "</script" (\\/ is just /), but the
    HTML tokenizer no longer matches a closing </script tag. Same for <!-- comment open.
    """
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
    return s or "figure"


def build(spec: dict) -> str:
    title = str(spec.get("title", "Figure"))
    tpl = (Path(__file__).resolve().parent.parent / "templates" / "figure-template.html").read_text()
    # The title is rendered via the HTML placeholder (escaped), so drop it from the
    # injected JSON to avoid carrying a raw copy into the inline <script>.
    injected = {k: v for k, v in spec.items() if k != "title"}
    return (
        tpl.replace("__FIGURE_TITLE__", html_escape(title))
        .replace("/*__FIGURE_SPEC__*/{}", js_safe(json.dumps(injected)))
    )


def main(argv: list) -> int:
    if len(argv) < 2:
        print("usage: build-figure.py <spec.json> [out.html]", file=sys.stderr)
        return 2
    spec = json.loads(Path(argv[1]).read_text())
    html = build(spec)
    out = (
        Path(argv[2])
        if len(argv) > 2
        else Path.cwd() / ".figure-exports" / f"{slugify(str(spec.get('title', 'figure')))}.html"
    )
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html)
    print(out.resolve())
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
