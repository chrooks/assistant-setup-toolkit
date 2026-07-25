---
name: scope
description: Size up a task — count the open decisions, stamp whether it needs a grill, and set an effort tier — then pick the right workflow (/plan, /grill-me, or /implement). Records the sizing into the DevOS Throughline when one exists. Use for open-ended feature, change, or refactor requests, or as the DevOS scope stage.
user-invocable: true
---

# Triage

Size up a request before starting work: judge how big it is, how many open
decisions it carries, and which workflow fits. When the work is part of a DevOS
run (a Throughline exists), record that sizing into the Throughline so the rest
of the lifecycle can trust it.

## Terms

- **Meaningful Decision** — a single choice that needs the human because it was
  not already specified. You count these.
- **Grillable** — the verdict you stamp when the work carries enough Meaningful
  Decisions to warrant a grill before implementing (default threshold: two or
  more open Meaningful Decisions).
- **Effort Tier** — a runtime-agnostic label, `light` or `heavy`, for how strong
  a model and how much effort the work needs. Pair it with an `effort` of
  `low`, `medium`, or `high`.

## When to Use

- User gives an open-ended feature, change, or refactor request.
- Scope or approach is unclear.
- You are unsure which workflow fits.
- The DevOS Conductor dispatches the `scope` stage.

## Process

### Step 1: Understand the request

Read the user's ask. Identify:
- What they want done.
- How much context you already have (files read, prior conversation, codebase familiarity).
- Whether the task has testable logic, UI, architecture, or is purely mechanical.

### Step 2: Size it

Produce a sizing verdict, always:

- **Count the Meaningful Decisions.** List each open choice the human still
  owns (a naming choice already made is not one; an unstated trade-off is).
- **Stamp Grillable.** Two or more open Meaningful Decisions → `grillable: true`.
  Zero or one, and the path is obvious → `grillable: false`. Use judgment; the
  threshold is a default, not a law.
- **Set the Effort Tier.** Mechanical or small and well-defined → `light`,
  `effort: low`. A first project slice, cross-cutting change, or many decisions
  → `heavy`, `effort: high`. In between → `medium`.

### Step 3: Declare the route and proceed

You hold the verdict, so make the call — routing work is actualization, the
assistant's side of the **Division of Responsibility**, and the grill/no-grill
judgment needs domain knowledge the human often doesn't have. Owning it is the
point. State the sizing and the route in one line, name the decisions you're
skipping so the human can veto a specific one, then invoke the chosen workflow:

```
Sizing: grillable=false, tier=light, effort=low, 1 open decision (cache TTL) → going straight to /implement.
Say "grill" to open the decisions first.
```

The verdict points the way: `grillable: true` → `/grill-me`; `grillable: false`
with real design work still ahead → `/plan`; a clean `grillable: false` →
`/implement`, where you invoke the `implement` Skill, which reads the user-level
`## Right Skill, Right Job` section and starts the fitting workflow.

Honor a veto the moment it arrives: stop the workflow you started and open the
named decisions instead.

### Step 4: Fallback — the three-option menu

Only when the user explicitly asks for options, present exactly three with a
one-line rationale each, led by the sizing verdict, and wait for the pick:

```
Sizing: grillable=<true|false>, tier=<light|heavy>, effort=<low|medium|high>, <N> open decision(s).

1. /plan — [why: concrete steps, enforcement, test strategy]
2. /grill-me — [why: fuzzy scope, unstated assumptions, needs sharpening]
3. /implement — [why: ready to do now using the right Skill workflow]
```

## DevOS: write the sizing into the Throughline

When the work is part of a DevOS run — there is a Throughline at
`.tasks/*/throughline.md` with `status: in_progress`, or the Conductor
dispatched you — record the sizing instead of only presenting it:

1. Set the frontmatter fields `grillable`, `tier`, and `effort` to your verdict.
2. Under `## Decision Ledger`, list each Meaningful Decision you counted as an
   open item (the question, marked open). Grill resolves these later.
3. Set `next_action`:
   - `grillable: true` → `/grill-me <issue>`.
   - `grillable: false` and the work needs a plan → `/plan <issue>`.
   - `grillable: false` and the work is ready to build → the implement stage.
4. **Skip-path only** (`grillable: false`, no grill or plan needed): write the
   `acceptance_criteria` directly. Every criterion carries a `proof_method` —
   never record a criterion without how it will be proven (for a UI change, a
   Playwright/DOM assertion; for an endpoint, an integration test).

Then advance: set `stage` to the stage `next_action` points at.

Declaring the route (Step 3) applies here too — with the route stated as the
Throughline's `next_action`. When `autonomy: afk`, don't even pause for the veto
on a clean `grillable:false`: state the route and advance; only a
`grillable:true` with a decision you can't resolve is a genuine stop.

## Rules

- Proceed on a clean verdict — declare the route and start it rather than waiting
  on a pick — and honor a veto immediately when one arrives.
- If the user says "just do it" or similar, treat it as `/implement`.
- If the user already specified a workflow (e.g., typed `/plan`), do not triage — just run it.
- Never record an acceptance criterion without its proof method.
- Keep the presentation concise. No walls of text.
