---
name: sync-projects
description: Refresh the projects mirror in the LLM-Wiki knowledge base — re-read the source-of-truth PROJECTS.md repo index and update the wiki's my-projects page, cross-linking each project to related wiki pages. Use when the user says "sync projects", "refresh my projects", "update the projects mirror", or after adding a new repo or project.
disable-model-invocation: false
---

# Sync Projects

Keep a **living mirror** of the repositories index inside the wiki. `PROJECTS.md` is a
regenerated, source-of-truth index — it is **not** a raw source (raw sources are immutable;
this file changes constantly). Never copy it into `raw-sources/`. Instead maintain one wiki
page that mirrors it and, crucially, **cross-links each project into the rest of the brain**.

The git history of `PROJECTS.md` is the archive, so don't keep dated snapshots — just keep
the current mirror fresh.

## Step 0 — Resolve paths

Read `~/.claude/knowledge-config.json` for `vaultPath`, `wikiDir`, and `projectsIndex`.

```bash
cat ~/.claude/knowledge-config.json
```

If `projectsIndex` is missing or its path doesn't exist, ask the user where the index is.

## Step 1 — Read both sides

- Read the current `projectsIndex` file (the source of truth).
- Read the existing `<wikiDir>/my-projects.md` if it exists (to diff against).
- Skim `<wikiDir>/index.md` so you know which entity/concept/source pages exist to link to.

## Step 2 — Write the mirror page

Write `<wikiDir>/my-projects.md`:

```markdown
---
type: mirror
title: My Projects
synced_from: <projectsIndex path>
last_synced: <YYYY-MM-DD>
---

# My Projects

_Living mirror of the repositories index. Source of truth: `<projectsIndex>`._

## Active

- **[[<project-slug>|<Project>]]** — <one-line description>. _<stack>._ Related: [[Related Page]], [[Other Page]]
- ...

## Idle / Stale / Seeded

- ...
```

Rules:
- Group by state (Active first, then Idle/Stale/Seeded) so the useful ones are on top.
- For each project, add **Related:** links to wiki pages that actually exist and connect — a source you ingested about that project, a concept it implements, an entity it involves. Don't invent links to pages that don't exist; a project with no connections yet just has no Related line.
- Keep the project's own description short; the value you add is the cross-links, not re-describing the repo.

## Step 3 — Index, log, report

- Update the catalog line for `my-projects` in `<wikiDir>/index.md`.
- Append a `log.md` entry: `## [<YYYY-MM-DD>] sync-projects | <N projects>` plus a short note of what changed since the last sync (added / removed / newly-linked).
- Tell the user what changed — especially new projects and any fresh cross-links into the brain.

## Scheduling

This skill is also run by the weekly knowledge-base routine (alongside `lint`), which
delivers its summary as a notification. Running it on demand here does the same work now.
