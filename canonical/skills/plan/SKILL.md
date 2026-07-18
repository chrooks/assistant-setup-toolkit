---
name: plan
description: Turn a resolved design into an ExecPlan, define acceptance criteria with proof methods, walk the human through it, and gate on approval. Writes the plan into the DevOS Throughline when one exists. Use when the user types /plan, asks to plan a feature or refactor, or as the DevOS plan stage after a grill.
user-invocable: true
argument-hint: "<feature, issue number, or what to plan>"
---

# Plan

Produce the plan of record for a piece of work: a detailed ExecPlan, a set of
acceptance criteria each with a recorded proof method, a human walkthrough, and
an explicit approval gate before any code is written.

## When to Use

- The user types `/plan` or asks to plan a feature, change, or refactor.
- Scope routed here (`grillable: false`, but the work needs a real plan).
- The DevOS grill stage finished and `next_action` points at `/plan`.

## Quick start

1. Read the inputs: the ask/issue, and — if a Throughline exists — its resolved
   `## Decision Ledger`.
2. Write an ExecPlan to `feature_requests/<slug>-plan.md`.
3. Define acceptance criteria, each with a `proof_method`.
4. Walk the human through it and wait for approval before implementing.

## The ExecPlan format

The ExecPlan is the detailed living plan document. Follow the format guide at
`~/.claude/PLAN.md` (Claude Code) or `~/.codex/PLAN.md` (Codex) to the letter:
prose-first narrative, self-contained for a novice, with the mandatory living
sections — `Progress`, `Surprises & Discoveries`, `Decision Log`, and
`Outcomes & Retrospective`. Write it to the project at
`feature_requests/<kebab-slug>-plan.md`. If the guide is not present, still
produce those sections; do not invent a different shape.

The ExecPlan is the heavy detail. The Throughline is the lightweight control
file that points at it. They are different files in the same
`feature_requests/` directory and both are kept current.

## Process

### Step 1 — Gather inputs

Read the ask and the issue. If a Throughline exists at
`feature_requests/*-throughline.md` with `status: in_progress`, read its
resolved `## Decision Ledger` — those decisions are settled and the plan must
honor them, not reopen them.

### Step 2 — Write the ExecPlan

Author or update `feature_requests/<slug>-plan.md` per the format above. Break
the work into independently verifiable milestones. Record the design choices
you make in its Decision Log.

Within each milestone, decompose the work into tasks sized **2–5 minutes** for
a competent agent. Each task names its **exact file paths** and ends with a
**one-line verification step** — a command to run or a thing to observe. A task
that cannot name its files is not ready: split it, or send the open question
back to design. Small tasks make sub-agent dispatch cheap to review and hard
to misinterpret.

### Step 3 — Define acceptance criteria with proof methods

For each user-visible behavior, write an acceptance criterion as a concrete,
checkable statement, and pair it with a `proof_method` — how it will be proven
at the prove stage. A UI change gets a Playwright or DOM assertion; an endpoint
gets an integration test; a pure function gets a unit test. Never write a
criterion without its proof method — that is the contract the prove stage runs
against.

### Step 4 — Walk the human through it

Present the plan as a walkthrough, not a wall of text:

- A one-line recap of the settled decisions (from the Decision Ledger).
- The approach and the milestones, in order.
- A diagram of the flow or architecture when it helps — reach for `/diagram md`
  for a quick ASCII-plus-Mermaid sketch, or `/diagram html` for a bigger
  interactive graph.
- The acceptance criteria, each beside its proof method (a `/table md` table
  reads well here).

### Step 5 — Offer a visual plan

After the walkthrough, propose rendering it as a visual plan with `/visual-plan`
— the richer review surface (inline diagrams, file-by-file map, annotated code,
wireframe/prototype canvas, commentable open questions) backed by the Plan MCP.

Offer it; don't force it. Reach for it when the work is UI-heavy, multi-file,
ambiguous, risky, or long-running, or when the human needs to compare and
approve a direction before code. Skip it for trivial, well-specified work whose
diff fits in one sentence. `/visual-plan` reuses this ExecPlan as its source, so
it builds the surface from the plan instead of starting over.

### Step 6 — Approval gate

Ask the human to approve, tweak, or reject. Do not start implementing until
they approve. This is the human-in-the-loop gate.

## DevOS: write the plan into the Throughline

When a Throughline exists:

- Write the `acceptance_criteria` into the frontmatter — each entry an `id`, a
  `statement`, a `proof_method`, and `status: pending`.
- Write the human walkthrough (or a tight summary plus a pointer to the
  ExecPlan file) into the `## Plan Walkthrough` body section.
- On approval, set `next_action` to the implement stage and advance `stage`.
  If the human rejects, keep `stage: plan` and record why in the Decision
  Ledger.

Editing the Throughline is mechanical: change only what moved, keep the file
valid YAML, preserve everything else.

## Rules

- Follow the ExecPlan format guide; keep the mandatory living sections.
- Never record an acceptance criterion without its proof method.
- Never start implementing before the human approves.
- The ExecPlan and the Throughline are both kept current; they do not duplicate
  each other — the Throughline points at the ExecPlan.
