---
name: fork
description: Crystallizes the current conversation into durable in-project artifacts (CONTEXT.md, PRD, handoff) so the next session can resume work. Orchestrates grill-with-docs, to-prd, and handoff. Use when user says "fork", "hand off", "checkpoint", or "save" a conversation, especially after substantive design or domain discussion. Requires a writable project folder (Cowork mode, Claude Code, or a connected filesystem MCP); falls back to in-chat artifacts otherwise.
disable-model-invocation: false
---

# /fork — Conversation Continuity

Thin orchestrator. Calls `grill-with-docs`, `to-prd`, `handoff`. See `docs/prd/fork-skill.md` (in the target project) and ADR-0001..0004 for design. See [REFERENCE.md](REFERENCE.md) for slug rules, path conventions, failure modes, invariants.

## Status — v1.0 (feature complete)

Implemented: Steps 1–10 + Modes 2 & 3. Full flow: detect mode → index read → config → prep → scratch sweep → widget promotion → handoff → index regen → surface.
No deferred steps remain.

## Step 1 — Detect destination mode

Decision tree, first match wins:

1. **Mode 1 (Folder)** — writable project folder available. Indicators: cwd contains `CONTEXT.md`, `.cowork/`, `docs/`, or a repo marker (`.git/`, `package.json`, `pyproject.toml`). Confirm with a non-destructive read; do not create probe files.
2. **Mode 2 (Materialize)** — no folder, but filesystem access via `mcp__cowork__request_cowork_directory` or any connected filesystem MCP. Prompt: *"No project folder. Create at `~/CoworkProjects/<slug>/`, pick existing, or skip?"* Accept → scaffold layout, continue as Mode 1. Skip/cancel → Mode 3.
3. **Mode 3 (Chat)** — no filesystem, or Mode 2 declined. Emit in-chat artifacts. Handoff degrades to fully-self-contained.

Ambiguity rule: if cwd has `.cowork/` or `CONTEXT.md`, prefer Mode 1; otherwise prompt.

Print detected mode + one-line evidence before proceeding.

## Step 2 — Pre-fork index read

Read `.cowork/index.md` if it exists. Print its content fenced so the user sees current project state before the fork runs. If the file does not exist, print "No index found — will create on first fork." Do not write; this step is read-only.

## Steps 3–5 — Config and prep-step orchestration

Run between Step 2 and Step 8. Full logic in [REFERENCE.md](REFERENCE.md) § Steps 3–5. Read `.cowork/config.yaml` (Step 3, prompt on first fork), optionally invoke `grill-with-docs` (Step 4) and `to-prd` (Step 5) based on config `run_*` preferences.

## Step 8 — Handoff write

### 8a. Infer slug

Derive a slug from the conversation's dominant topic. Kebab-case, alphanumeric + dashes, max 60 chars. Surface it with an override prompt: *"Handoff slug: `<inferred-slug>`. Override or Enter to accept."* See [REFERENCE.md](REFERENCE.md) § Slug rules.

### 8b. Ensure destination

Create `.cowork/handoffs/` if it does not exist. Filename: `<YYYY-MM-DD>-<slug>.md`.

### 8c. Invoke `/handoff`

Run the existing `handoff` skill. It produces a fenced markdown block (template in `~/.claude/skills/handoff/SKILL.md`). Capture its full output — do not modify the handoff body.

### 8d. Write hybrid wrapper (Mode 1/2)

Prepend a path-reference header to the handoff body and write to disk:

```markdown
<!-- /fork hybrid handoff — read referenced files for full depth -->
<!-- CONTEXT: CONTEXT.md -->
<!-- PRD: docs/prd/<slug>.md (if exists) -->

<handoff body from Step 8c>
```

The `<!-- PRD: ... -->` line is omitted if no PRD exists for this conversation. Path references use repo-relative paths.

### 8e. Mode 3 fallback

If Mode 3: skip the file write. Emit the handoff body directly in chat as a fenced code block (fully self-contained, no path references). The `handoff` skill's existing output format already serves this case.

### 8f. Surface to user

After writing, print:
1. Path to the written handoff file (Mode 1/2).
2. The handoff content as a fenced code block for copy-paste.
3. Note which steps were deferred (prep steps, index regen).

## Step 9 — Post-fork index regeneration

Walk the project folder. Rebuild `.cowork/index.md` with three sections per [REFERENCE.md](REFERENCE.md) § Index format:

1. **Source-of-truth documents** — `CONTEXT.md`, all files in `docs/adr/`, all files in `docs/prd/`. One link per file, brief description from filename.
2. **Artifacts** — all files in `artifacts/`. If empty, print "(none yet)".
3. **Handoffs** — all files in `.cowork/handoffs/`. One link per file.

Update header: `Last updated: <YYYY-MM-DD> by /fork (handoff: <YYYY-MM-DD>-<slug>)`. Create the file if it does not exist.

## Step 6 — Sweep `.cowork/scratch/`
Runs between Steps 5 and 8. See [REFERENCE.md](REFERENCE.md) § Step 6. Skip if dir missing/empty.

## Step 7 — Promote Cowork HTML widgets
Runs between Steps 6 and 8. See [REFERENCE.md](REFERENCE.md) § Step 7. Skip if `mcp__cowork__list_artifacts` unavailable.

## Step 10 — Rich surface
After Step 9. See [REFERENCE.md](REFERENCE.md) § Step 10. Falls back to basic surface (8f) when no seed-chat tool available.

## Invariants (forward-compat for auto-load)

- `CONTEXT.md` always at project root.
- `.cowork/index.md` is plain-markdown-link-parseable.
- No load-bearing state in Cowork's artifact registry — promoted artifacts always have file copies.
- Orchestrator stays thin. Missing capability → extend `grill-with-docs` / `to-prd` / `handoff`, not reimplement here.
