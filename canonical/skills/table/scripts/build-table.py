#!/usr/bin/env python3
"""Fill the /table interactive HTML template from a JSON spec — safely.

Usage:
    python3 build-table.py <spec.json> [out.html]

spec.json:
    {
      "title":   "NBA Scoring Leaders",
      "columns": [{ "key": "player", "label": "Player", "type": "string" }, ...],
      "data":    [{ "player": "...", "ppg": 26.4 }, ...]
    }

Why a script instead of a hand-rolled string replace: the data is injected as JSON
*inside* an inline <script> block. A value containing the literal "</script>" would
otherwise terminate the script element (the HTML parser scans raw text for it before
the JS ever runs) and break the whole page. This escapes that sequence — the JSON is
unchanged as data, but the HTML parser no longer sees a closing tag. The title is
HTML-escaped because it lands in <title>/<h1> (an HTML text context).

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
    return s or "table"


def build(spec: dict) -> str:
    title = str(spec.get("title", "Table"))
    columns = spec.get("columns", [])
    data = spec.get("data", [])
    tpl = (Path(__file__).resolve().parent.parent / "templates" / "table-template.html").read_text()
    return (
        tpl.replace("__TABLE_TITLE__", html_escape(title))
        .replace("/*__TABLE_COLUMNS__*/[]", js_safe(json.dumps(columns)))
        .replace("/*__TABLE_DATA__*/[]", js_safe(json.dumps(data)))
    )


def main(argv: list) -> int:
    if len(argv) < 2:
        print("usage: build-table.py <spec.json> [out.html]", file=sys.stderr)
        return 2
    spec = json.loads(Path(argv[1]).read_text())
    html = build(spec)
    out = (
        Path(argv[2])
        if len(argv) > 2
        else Path.cwd() / ".table-exports" / f"{slugify(str(spec.get('title', 'table')))}.html"
    )
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html)
    print(out.resolve())
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
