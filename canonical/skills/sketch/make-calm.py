"""Write <name>-calm.html beside each /sketch HTML file: the same layout, annotation layer hidden.

Usage: python3 make-calm.py sketch/layout-a.html sketch/layout-b.html ...
The annotated file stays the one source; re-run after every edit instead of editing a calm copy.
"""
import pathlib
import sys

ANNOTATION_CLASSES = ".tag,.rid,.break,.notes,.anno"
HIDE = f"<style>/* calm copy */ {ANNOTATION_CLASSES}{{display:none!important}}</style>\n</head>"

for src in map(pathlib.Path, sys.argv[1:]):
    if src.stem.endswith("-calm"):
        continue
    html = src.read_text()
    if "</head>" not in html:
        sys.exit(f"{src}: no </head> to inject the calm style into")
    out = src.with_name(f"{src.stem}-calm.html")
    out.write_text(html.replace("</head>", HIDE, 1).replace("<title>", "<title>Calm · ", 1))
    print(out)
