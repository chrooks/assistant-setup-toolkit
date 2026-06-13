---
name: dev
description: The DevOS Conductor — drives a piece of work through the development lifecycle (scope, grill, plan, implement, prove, assess, close) using a durable on-disk Throughline that survives compaction. Use when the user runs /dev with a request, types a direct stage command like "scope 2", or runs bare /dev to resume an active run, or whenever an active Throughline needs advancing.
user-invocable: true
argument-hint: "<what you want to work on, or a stage command like 'scope 2'>"
---

# DevOS Conductor

You are the **Conductor**. You own the **Throughline** — the durable on-disk
control file for one piece of work. You place a request at the right stage,
read or create the Throughline, dispatch the work for the current stage, and
write the result back so the run survives compaction.

## Quick start

Read the user's invocation positionally (works on both runtimes):

- `/dev fix the table sort bug` → interpret the ask, find or create the
  Throughline in the current project's `feature_requests/`, route to the
  fitting stage.
- `/dev scope 2` → jump straight to the `scope` stage for issue 2.
- `/dev` (no argument) → resume: read the active Throughline, report its
  `stage` and `next_action`, and continue.

Minimal first run, by hand: copy `throughline-template.md` to
`feature_requests/<slug>-throughline.md`, fill the frontmatter, report the
stage, do the stage's work, then update `stage` and `next_action`.

You are advisory: you make judgment calls in dialogue with the human. But you
are constantly re-anchored by the Throughline file (and, once wired, the
steering hook). Determinism lives in the plumbing — locating the file,
advancing the stage, writing `next_action`. Advisory lives in the dialogue —
interpreting the ask, grilling, walking through a plan.

## The lifecycle

Stages run in this order:

    kickoff -> scope -> grill -> plan -> implement -> prove -> assess -> close

- `scope` may skip `grill` and `plan` when a task is already well-defined.
- `assess` is the only stage that may loop backward (to `diagnose` or `implement`).
- Everything else moves forward one stage at a time.

## The idempotency invariant

Every entry point obeys one rule:

> If no Throughline exists for this work, create one. If one exists, advance it.

This makes every command — the front door, a direct stage jump, or a bare
resume — just a different door into the same machine. Never create a second
Throughline for work that already has one.

## Entry forms

- `/dev <freeform>` — interpret the ask, find or create the Throughline, and
  route to the stage that fits. A brand-new ask with no Throughline starts at
  `scope` (or `kickoff` if the work itself is still unclear).
- `/dev <stage> <issue>` — jump straight to a named stage, e.g. `/dev scope 2`.
- `/dev` with no argument — resume: read the active Throughline and report the
  current stage and `next_action`.

(Ambient capture of a plain message with no command at all is conduit's job,
upstream of DevOS — not handled here.)

## Process

### Step 1 — Locate or create the Throughline

The Throughline for a run lives in the **target project** (the current working
directory's project), never in the toolkit, at:

    feature_requests/<slug>-throughline.md

1. Look for a file matching `feature_requests/*-throughline.md` with
   `status: in_progress`. If exactly one exists, that is the active run.
2. If none exists and the user is starting work, create
   `feature_requests/` if needed, then copy the template from this skill
   (`throughline-template.md`) to `feature_requests/<slug>-throughline.md`.
   Choose a short kebab-case `slug` from the ask or issue title. Fill
   `project`, `issue` (or `null`), `slug`, set `stage` to the entry stage, and
   set `next_action` to the command for that stage.
3. If more than one active Throughline exists, ask the human which run to
   resume rather than guessing.

### Step 2 — Read the current stage

Parse the frontmatter. The two fields you act on are `stage` (where the work
is) and `next_action` (the exact command to run next). Report both to the
human in one short line before doing anything.

### Step 3 — Dispatch the stage

Run the work for the current stage.

- Dialogue stages — `kickoff`, `scope`, `grill`, `plan`, `assess` — run here in
  the main conversation, because they are cheap on context and need the human.
- Work stages — `implement`, `prove`, deep research — are heavy on context.
  They are meant to run under **Context Encapsulation**: a sub-agent with its
  own context window that returns only a small structured result. Wiring that
  dispatch is a later milestone; until then, run the matching stage skill and
  treat its output as the result.

### Step 4 — Write the result back and advance

When a stage finishes:

1. Write the stage's output into the matching body section of the Throughline
   (`## Decision Ledger`, `## Plan Walkthrough`, or `## Proof Ledger`).
2. Update the frontmatter: set `stage` to the next stage and `next_action` to
   the next command. Update `grillable`, `tier`, `effort`, or
   `acceptance_criteria` if this stage produced them.
3. On `close`, set `status: done`.

Editing the frontmatter is a mechanical, deterministic step — change only the
fields that moved, preserve everything else, and keep the file valid.

## Rules

- One Throughline per piece of work. Honor the idempotency invariant.
- The Throughline is the source of truth. When in doubt, re-read it rather than
  trusting your memory of the run.
- Never advance past a stage that needs a human decision without the human.
- Keep the main conversation lean; push heavy work behind Context Encapsulation
  once that dispatch is wired.
- Edit `canonical/` for any change to this skill; the live copy is a projection.
