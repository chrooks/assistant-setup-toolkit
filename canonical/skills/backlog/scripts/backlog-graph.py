#!/usr/bin/env python3
"""Render a repo's open GitHub issues as an interactive dependency graph.

Usage:
    python3 backlog-graph.py [owner/repo] [--open]

Reads open issues with `gh api graphql` (blocked-by links, parent/sub-issue links,
labels, milestone), shapes them into the /diagram model, and builds the HTML with the
sibling diagram skill's build-diagram.py. Writes <cwd>/.exports/backlog/<repo>.html
and prints the absolute path. `--open` opens it in Orca's embedded browser when the
`orca` CLI is on PATH.

Colors: red = blocked (open blocker, or `blocked` label), amber = needs a decision or
scope, green = ready. Edges: blocker -> blocked (solid), parent -> sub-issue (dashed).
"""
import json
import shutil
import subprocess
import sys
from pathlib import Path

BUILD_SCRIPT = Path(__file__).resolve().parent.parent.parent / "diagram" / "scripts" / "build-diagram.py"
PAGE_SIZE = 100
MAX_PAGES = 5  # ponytail: 500 open issues is plenty; paginate further if a repo ever needs it
LABEL_WAIT = {"needs-decision", "needs-scope"}
COLORS = {
    "blocked": ("#fee2e2", "#b91c1c"),
    "waiting": ("#fef3c7", "#b45309"),
    "ready": ("#dcfce7", "#15803d"),
}
QUERY = """
query($owner:String!, $name:String!, $after:String) {
  repository(owner:$owner, name:$name) {
    issues(first:%d, after:$after, states:OPEN, orderBy:{field:CREATED_AT, direction:ASC}) {
      pageInfo { hasNextPage endCursor }
      nodes {
        number title url
        milestone { title }
        labels(first:20) { nodes { name } }
        parent { number }
        blockedBy(first:20) { nodes { number state } }
        subIssues(first:50) { nodes { number } }
      }
    }
  }
}
""" % PAGE_SIZE


def sh(*args: str) -> str:
    return subprocess.run(args, check=True, capture_output=True, text=True).stdout


def fetch_issues(owner: str, name: str) -> list:
    issues, after = [], None
    for _ in range(MAX_PAGES):
        cmd = ["gh", "api", "graphql", "-f", f"query={QUERY}", "-F", f"owner={owner}", "-F", f"name={name}"]
        if after:
            cmd += ["-F", f"after={after}"]
        page = json.loads(sh(*cmd))["data"]["repository"]["issues"]
        issues += page["nodes"]
        if not page["pageInfo"]["hasNextPage"]:
            break
        after = page["pageInfo"]["endCursor"]
    return issues


def status_of(issue: dict, open_numbers: set) -> str:
    labels = {l["name"] for l in issue["labels"]["nodes"]}
    open_blockers = [b for b in issue["blockedBy"]["nodes"] if b["number"] in open_numbers]
    if open_blockers or "blocked" in labels:
        return "blocked"
    if labels & LABEL_WAIT:
        return "waiting"
    return "ready"


def to_model(repo: str, issues: list) -> dict:
    open_numbers = {i["number"] for i in issues}
    nodes, edges = [], []
    for i in issues:
        labels = sorted(l["name"] for l in i["labels"]["nodes"])
        milestone = (i["milestone"] or {}).get("title") or "no milestone"
        status = status_of(i, open_numbers)
        bg, bd = COLORS[status]
        blockers = [f"#{b['number']}" for b in i["blockedBy"]["nodes"] if b["number"] in open_numbers]
        nodes.append({
            "id": i["number"],
            "label": f"#{i['number']} {i['title'][:48]}\n({milestone})",
            "group": milestone,
            "color": {"background": bg, "border": bd, "highlight": {"background": bg, "border": bd}},
            "description": i["title"] + (f" — blocked by {', '.join(blockers)}" if blockers else ""),
            "meta": {"status": status, "milestone": milestone, "labels": ", ".join(labels) or "none", "url": i["url"]},
        })
        for b in i["blockedBy"]["nodes"]:
            if b["number"] in open_numbers:
                edges.append({"from": b["number"], "to": i["number"], "label": "blocks",
                              "description": f"#{b['number']} must close before #{i['number']} can start."})
        for s in i["subIssues"]["nodes"]:
            if s["number"] in open_numbers:
                edges.append({"from": i["number"], "to": s["number"], "dashes": True,
                              "description": f"#{s['number']} is a sub-issue of #{i['number']}."})
    return {"title": f"{repo} backlog", "kind": "roadmap", "nodes": nodes, "edges": edges}


def main(argv: list) -> int:
    args = [a for a in argv[1:] if not a.startswith("--")]
    repo = args[0] if args else sh("gh", "repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner").strip()
    owner, name = repo.split("/", 1)
    issues = fetch_issues(owner, name)
    model = to_model(repo, issues)
    out_dir = Path.cwd() / ".exports" / "backlog"
    out_dir.mkdir(parents=True, exist_ok=True)
    model_path = out_dir / f"{name.lower()}.json"
    model_path.write_text(json.dumps(model, indent=2) + "\n")
    html_path = out_dir / f"{name.lower()}.html"
    sh(sys.executable, str(BUILD_SCRIPT), str(model_path), str(html_path))
    counts = {s: sum(1 for n in model["nodes"] if n["meta"]["status"] == s) for s in COLORS}
    print(f"{len(issues)} open issues: {counts['ready']} ready, {counts['waiting']} waiting, {counts['blocked']} blocked; {len(model['edges'])} links", file=sys.stderr)
    print(html_path.resolve())
    if "--open" in argv:
        if not shutil.which("orca"):
            print("orca CLI not on PATH; open the file above in a browser.", file=sys.stderr)
            return 0
        subprocess.run(["orca", "tab", "create", "--url", html_path.resolve().as_uri(), "--worktree", f"path:{Path.cwd()}"], check=False)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
