#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["markdown", "weasyprint"]
# ///
"""Render Markdown to a letterheaded PDF.

Styling comes entirely from a CSS file, so branding changes never touch this script.
CSS resolution order: --css, then <repo>/brand/letterhead.css, then the bundled template.

Usage:
  md2pdf.py FILE.md [FILE.md ...] [--css PATH] [--out DIR]
"""
import argparse
import re
import sys
from pathlib import Path

import markdown

try:
    from weasyprint import CSS, HTML
except OSError:  # Pango is a system library; uv cannot install it
    sys.exit(
        "md2pdf: missing the Pango text library.\n"
        "  macOS:  brew install pango\n"
        "  Debian: sudo apt install -y libpangocairo-1.0-0 libpangoft2-1.0-0"
    )

BUNDLED_CSS = Path(__file__).resolve().parent.parent / "templates" / "letterhead.css"
EXTENSIONS = ["tables", "fenced_code", "attr_list", "sane_lists", "footnotes"]


def repo_root() -> Path:
    """Nearest ancestor holding brand/letterhead.css, else the nearest holding .git.

    Checked before .git because a project can live inside a larger checkout — a
    synced vault, a monorepo package — and its own branding should still win.
    """
    start = Path.cwd().resolve()
    for d in (start, *start.parents):
        if (d / "brand" / "letterhead.css").is_file():
            return d
    for d in (start, *start.parents):
        if (d / ".git").exists():
            return d
    return start


def resolve_css(explicit: str | None, root: Path) -> Path:
    if explicit:
        path = Path(explicit).resolve()
        if not path.is_file():
            sys.exit(f"md2pdf: no CSS at {path}")
        return path
    project_css = root / "brand" / "letterhead.css"
    return project_css if project_css.is_file() else BUNDLED_CSS


def title_of(text: str, fallback: str) -> str:
    match = re.search(r"^#\s+(.+)$", text, re.MULTILINE)
    return match.group(1).strip() if match else fallback


def convert(src: Path, css: Path, out_dir: Path, base: Path) -> Path:
    text = src.read_text(encoding="utf-8")
    text = re.sub(r"\A---\n.*?\n---\n", "", text, flags=re.DOTALL)  # drop YAML frontmatter
    body = markdown.markdown(text, extensions=EXTENSIONS)
    html = (
        f'<!doctype html><html lang="en"><head><meta charset="utf-8">'
        f"<title>{title_of(text, src.stem)}</title></head><body>{body}</body></html>"
    )
    out_dir.mkdir(parents=True, exist_ok=True)
    out = out_dir / f"{src.stem}.pdf"
    HTML(string=html, base_url=str(base)).write_pdf(out, stylesheets=[CSS(filename=css)])
    return out


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("files", nargs="+", help="Markdown files to render")
    parser.add_argument("--css", help="stylesheet to use instead of the resolved default")
    parser.add_argument("--out", help="output directory (default: <repo>/.exports/pdf)")
    args = parser.parse_args()

    root = repo_root()
    css = resolve_css(args.css, root)
    out_dir = Path(args.out).resolve() if args.out else root / ".exports" / "pdf"

    print(f"css: {css}", file=sys.stderr)
    for name in args.files:
        src = Path(name).resolve()
        if not src.is_file():
            print(f"md2pdf: not a file: {name}", file=sys.stderr)
            return 1
        print(convert(src, css, out_dir, root))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
