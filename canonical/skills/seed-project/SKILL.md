---
name: seed-project
description: "Turn a raw idea (and optional handoff notes) into a new project scaffold in the Repositories folder — README, project Lexicon (CONTEXT.md), implementation BRIEF for the next harness, a stub tree for the chosen stack, git init — then register it in the source-of-truth index. Use when starting a new project from an idea. Does NOT implement features."
argument-hint: "[idea, or path to a handoff/brief file]"
---

# Seed Project

Crystallize an idea into reviewable project scaffolding. **Scaffolding only — never
implement business logic.** The output is the seed plus a BRIEF that a downstream
Claude Code / Codex harness picks up via `/scope`.

Target folder: `/Users/cdbrooks/Development/Software/Repositories/`

## Step 1 — Capture the idea

Use `$ARGUMENTS` as the idea. If it's a path to a handoff/brief file, read it.
If the idea is thin, ask one focused clarifying question — otherwise proceed.
Pull any concrete facts/constraints out of the handoff (numbers, sources, open
questions) to carry into the BRIEF.

## Step 2 — Decide shape (AskUserQuestion)

Ask the project shape/stack before scaffolding. Offer options that fit the idea,
e.g.:
- **Python CLI tool** — fastest, terminal output, easy to automate later.
- **Next.js full-stack** — TypeScript web app, UI + API routes.
- **Python FastAPI + thin frontend** — clean Boundary between data and view.
- **Python lib + CLI, UI later** — pure testable core, thin CLI, Seam for a UI.

Also confirm the project **name** (kebab-case slug). Suggest one; let the user override.

## Step 3 — Write the scaffold

Create `<Repositories>/<slug>/` with, at minimum:

- `README.md` — what it does (target behavior), stack, project layout, status line
  marking **SCAFFOLD ONLY**, pointer to `BRIEF.md`.
- `CONTEXT.md` — the **project Lexicon**: domain terms with concise definitions and
  `_Avoid_` lines, plus any known constants from the handoff (marked as seeds, not
  Invariants). This takes precedence over the global Lexicon for the project.
- `BRIEF.md` — the harness handoff: goal, carried-over analysis, open questions,
  required behavior, research-first note (GitHub search → Context7 → Exa, check
  sibling repos in `PROJECTS.md` for reuse), suggested Vertical-Slice build order,
  constraints (no secrets, validate at Boundary, pure core behind a Seam), and a
  first-milestone Definition of Done.
- A **stub tree** for the chosen shape — placeholder files with `TODO(harness)`
  comments and any Contract/type definitions, but **no real logic**.
- `.gitignore` and `.env.example` (no real secrets).

Conventions:
- For web/React stubs, give every element a human-readable `id`.
- Define data-shape Contracts (types/interfaces) — that's scaffolding, not logic.
- Keep files small and focused. Follow the user's coding-style rules.

## Step 4 — git init

```sh
cd <Repositories>/<slug> && git init -q && git add -A
```
(Do not commit unless asked.)

## Step 5 — Register in the index (shared mechanism)

Run the shared index script so the new repo lands in `PROJECTS.md`:

```sh
python3 /Users/cdbrooks/Development/Software/Repositories/.repo-index/index.py
```

The script adds the row with `(NEW — needs description)`. Because this Skill already
knows the idea, immediately Edit `PROJECTS.md` to replace that placeholder with a
terse one-line description (same voice as existing rows). This reuses the one index
mechanism rather than hand-maintaining the table.

## Step 6 — Report

Summarize the created tree, the chosen shape, the index row added, and tell the user
the next step is `/scope` (or handing `BRIEF.md` to a fresh harness). Remind them
nothing is implemented yet.

## Invariants

- **No implementation.** Stubs, Contracts, and docs only.
- One index mechanism — always update `PROJECTS.md` via `.repo-index/index.py`,
  never by re-deriving the table by hand.
- Project Lexicon (`CONTEXT.md`) uses industry-standard meanings; keep it lean.
