#!/usr/bin/env python3
"""Read-only structural analysis of an LLM-Wiki Obsidian vault.

Walks the wiki directory, parses [[wikilinks]] into a graph, and prints
structural facts: orphans, hubs (god-nodes), dead-ends, broken links, and
connected-component clusters. NEVER writes anything — the lint skill reads
this output, interprets it, and routes any fixes through the human approval
gate.

stdlib only. Usage:
    wiki-graph.py [--wiki-dir PATH] [--top N] [--json]

If --wiki-dir is omitted, resolves it from ~/.claude/knowledge-config.json
(vaultPath + wikiDir), the same config the ingest skill uses.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from collections import defaultdict

# Pages that are navigational/meta, not content — excluded from orphan and
# dead-end analysis (they are expected to be hubs or terminal lists).
META_PAGES = {"index", "log", "questions"}

# [[Target]] | [[Target|Alias]] | [[Target#Heading]] | [[Target#Heading|Alias]]
# The alias separator may be an escaped pipe (\|) — that's the correct Obsidian
# syntax inside a Markdown table, where a raw | would break the column. So the
# target class excludes backslash, and the alias group tolerates a leading \.
WIKILINK = re.compile(r"\[\[([^\]\|#\\]+)(?:#[^\]\|\\]+)?(?:\\?\|[^\]]+)?\]\]")


def resolve_wiki_dir(explicit: str | None) -> str:
    if explicit:
        return os.path.abspath(os.path.expanduser(explicit))
    cfg_path = os.path.expanduser("~/.claude/knowledge-config.json")
    if not os.path.exists(cfg_path):
        sys.exit(
            f"No --wiki-dir given and {cfg_path} not found. "
            "Pass --wiki-dir explicitly."
        )
    with open(cfg_path, encoding="utf-8") as fh:
        cfg = json.load(fh)
    vault = cfg.get("vaultPath")
    wiki = cfg.get("wikiDir", "wiki")
    if not vault:
        sys.exit(f"{cfg_path} has no vaultPath.")
    return os.path.join(vault, wiki)


def collect_pages(wiki_dir: str) -> dict[str, str]:
    """Map normalized page name -> absolute file path for every .md file."""
    pages: dict[str, str] = {}
    for root, _dirs, files in os.walk(wiki_dir):
        for fn in files:
            if fn.endswith(".md"):
                name = os.path.splitext(fn)[0]
                pages[name.lower()] = os.path.join(root, fn)
    return pages


def parse_links(path: str) -> list[str]:
    try:
        with open(path, encoding="utf-8") as fh:
            text = fh.read()
    except OSError:
        return []
    return [m.group(1).strip() for m in WIKILINK.finditer(text)]


def build_graph(wiki_dir: str):
    pages = collect_pages(wiki_dir)
    inbound: dict[str, int] = defaultdict(int)
    outbound: dict[str, int] = defaultdict(int)
    broken: dict[str, list[str]] = defaultdict(list)  # source page -> bad targets
    adj: dict[str, set[str]] = defaultdict(set)  # undirected, for components

    for name, path in pages.items():
        for target in parse_links(path):
            key = target.lower()
            outbound[name] += 1
            if key in pages:
                inbound[key] += 1
                adj[name].add(key)
                adj[key].add(name)
            else:
                broken[name].append(target)

    return pages, inbound, outbound, broken, adj


def components(pages: dict[str, str], adj: dict[str, set[str]]) -> list[list[str]]:
    seen: set[str] = set()
    out: list[list[str]] = []
    for node in pages:
        if node in seen:
            continue
        stack, group = [node], []
        seen.add(node)
        while stack:
            cur = stack.pop()
            group.append(cur)
            for nbr in adj.get(cur, ()):  # neighbors
                if nbr not in seen:
                    seen.add(nbr)
                    stack.append(nbr)
        out.append(sorted(group))
    out.sort(key=len, reverse=True)
    return out


def planned_targets(pages: dict[str, str]) -> set[str]:
    """Wikilink targets registered in the questions.md backlog — these are
    intended future pages, not broken links. Used to separate planned
    forward-links (expected, low-priority) from genuine breaks (typos/rot)."""
    path = pages.get("questions")
    if not path:
        return set()
    return {t.lower() for t in parse_links(path)}


def analyze(wiki_dir: str, top: int):
    pages, inbound, outbound, broken, adj = build_graph(wiki_dir)
    content = [p for p in pages if p not in META_PAGES]

    orphans = sorted(p for p in content if inbound.get(p, 0) == 0)
    dead_ends = sorted(p for p in content if outbound.get(p, 0) == 0)
    hubs = sorted(
        ((p, inbound.get(p, 0)) for p in pages),
        key=lambda kv: kv[1],
        reverse=True,
    )[:top]
    comps = components(pages, adj)

    # Split broken links: genuine breaks vs planned forward-links (targets the
    # questions.md backlog has registered as pages to build).
    planned = planned_targets(pages)
    broken_genuine: dict[str, list[str]] = {}
    broken_planned: dict[str, list[str]] = {}
    for src, tgts in sorted(broken.items()):
        gen = [t for t in tgts if t.lower() not in planned]
        plan = [t for t in tgts if t.lower() in planned]
        if gen:
            broken_genuine[src] = gen
        if plan:
            broken_planned[src] = plan

    return {
        "wiki_dir": wiki_dir,
        "total_pages": len(pages),
        "content_pages": len(content),
        "total_links": sum(outbound.values()),
        "orphans": orphans,
        "dead_ends": dead_ends,
        "hubs": [{"page": p, "inbound": n} for p, n in hubs],
        "broken_links": broken_genuine,
        "planned_links": broken_planned,
        "components": [
            {"size": len(c), "pages": c} for c in comps
        ],
    }


def print_text(r: dict, top: int) -> None:
    w = print
    w(f"# wiki-graph — {r['wiki_dir']}")
    w(f"{r['total_pages']} pages ({r['content_pages']} content), "
      f"{r['total_links']} links\n")

    w(f"## Orphans (0 inbound links) — {len(r['orphans'])}")
    w("Pages nothing links to; you'll never reach them by browsing.")
    for p in r["orphans"]:
        w(f"  - {p}")
    if not r["orphans"]:
        w("  (none)")
    w("")

    w(f"## Hubs / god-nodes (top {top} by inbound)")
    w("Over-concentrated pages; everything leans on these.")
    for h in r["hubs"]:
        w(f"  - {h['page']}  <- {h['inbound']}")
    w("")

    w(f"## Dead-ends (0 outbound links) — {len(r['dead_ends'])}")
    w("Pages that link nowhere; candidates for missing cross-references.")
    for p in r["dead_ends"]:
        w(f"  - {p}")
    if not r["dead_ends"]:
        w("  (none)")
    w("")

    broken = r["broken_links"]
    total_broken = sum(len(v) for v in broken.values())
    w(f"## Broken wikilinks — {total_broken}")
    w("Genuine breaks: target exists nowhere and isn't a planned page (typo or rot).")
    for src, tgts in broken.items():
        w(f"  - {src} -> {', '.join(tgts)}")
    if not broken:
        w("  (none)")
    w("")

    planned = r.get("planned_links", {})
    total_planned = sum(len(v) for v in planned.values())
    w(f"## Planned forward-links — {total_planned}")
    w("Unresolved links to pages registered in questions.md; expected, low-priority.")
    for src, tgts in planned.items():
        w(f"  - {src} -> {', '.join(tgts)}")
    if not planned:
        w("  (none)")
    w("")

    comps = r["components"]
    w(f"## Clusters (connected components) — {len(comps)}")
    if comps:
        big = comps[0]
        w(f"Largest component: {big['size']} pages (the main body).")
        islands = comps[1:]
        if islands:
            w(f"{len(islands)} disconnected island(s) — possible split topics:")
            for c in islands:
                w(f"  - [{c['size']}] {', '.join(c['pages'])}")
        else:
            w("No islands — the whole wiki is one connected graph.")
    w("")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--wiki-dir", default=None,
                    help="wiki directory (default: from knowledge-config.json)")
    ap.add_argument("--top", type=int, default=10, help="hub count (default 10)")
    ap.add_argument("--json", action="store_true", help="emit JSON instead of text")
    args = ap.parse_args()

    wiki_dir = resolve_wiki_dir(args.wiki_dir)
    if not os.path.isdir(wiki_dir):
        sys.exit(f"wiki dir not found: {wiki_dir}")

    result = analyze(wiki_dir, args.top)
    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print_text(result, args.top)


if __name__ == "__main__":
    main()
