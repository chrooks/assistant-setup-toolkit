---
name: backlog
description: Draw a repo's open GitHub issues as an interactive dependency graph (blocked-by links, parent and sub-issue links, milestone, labels) and open it in Orca's embedded browser. Use when the user asks to see the backlog, what is blocked, what depends on what, the issue graph, or invokes /backlog.
argument-hint: "[owner/repo]"
allowed-tools: Bash, Read
---

# /backlog — open issues as a dependency graph

GitHub holds the truth; this skill only draws it. One script fetches the open issues
with `gh`, shapes them into the `/diagram` model, builds the HTML with the diagram
skill's `build-diagram.py`, and opens the page as a tab in Orca's built-in browser.

## Quick start

From inside the repo (or name one):

```bash
python3 scripts/backlog-graph.py --open            # repo of the current directory
python3 scripts/backlog-graph.py owner/repo --open
```

`scripts/` is next to this SKILL.md. The script prints a count line and the absolute
path of `<cwd>/.exports/backlog/<repo>.html`. `--open` needs the `orca` CLI; without
it, the page still exists and the user can open the printed path in any browser.

## What the graph shows

- **Node** = one open issue. The label carries the number, title, and milestone.
  Double-click a node to open the issue on GitHub. Click to see status, milestone,
  labels, and the link in the side panel.
- **Color** = readiness. Red is blocked (an open blocker, or the `blocked` label).
  Amber is waiting on a person (`needs-decision` or `needs-scope`). Green is ready.
- **Solid edge** = blocker → blocked. **Dashed edge** = parent → sub-issue.
  Closed blockers do not draw; they no longer block.

## Workflow

1. Run the script from the repo root. Read the count line.
2. Report the counts in one line and the path. If the repo has zero links, say so:
   the issues have no blocked-by or sub-issue relations recorded yet, and `/to-issues`
   is where to add them.
3. If `.exports/` is not ignored in that repo, add it to `.gitignore` (one entry covers
   every visual skill).

## Boundaries

- Read-only against GitHub. To change a dependency, label, or milestone, use
  `/to-issues`; to decide what to pick up next, use `/roadmap`.
- The graph is a build product. Re-run the script after the tracker changes; do not
  edit the HTML.
