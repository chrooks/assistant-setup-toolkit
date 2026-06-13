---
name: prove-it
description: Prove a piece of work against its acceptance criteria. Reads each criterion's recorded proof method from the DevOS Throughline, runs it, and writes a Proof Ledger with evidence and a proposed status per criterion for the human to assess. Use when the user types /prove-it, asks to verify a feature against its acceptance criteria, or as the DevOS prove stage after implement.
user-invocable: true
argument-hint: "<issue number or what to prove>"
---

# Prove It

Gather the evidence that a piece of work meets its acceptance criteria. You do
the legwork and form an opinion; the human renders the final verdict in the
assess stage. You never decide that work is done.

## When to Use

- The user types `/prove-it` or asks to verify a feature against its criteria.
- The DevOS implement stage finished and `next_action` points at `/prove-it`.

## Quick start

1. Read the Throughline's `acceptance_criteria` — each has a `statement` and a
   recorded `proof_method`.
2. Run each proof method and capture the evidence.
3. Write the `## Proof Ledger` and set a proposed status per criterion.
4. Hand off to assess; the human disposes.

## Process

### Step 1 — Read the criteria and their proof methods

From the Throughline at `feature_requests/*-throughline.md`, read every entry in
`acceptance_criteria`. Each carries the `proof_method` recorded at plan time, so
you never have to guess how to prove something — a UI change has a
Playwright/DOM assertion, an endpoint has an integration test, a pure function
has a unit test.

### Step 2 — Run each proof

Execute the recorded proof method for each criterion and capture concrete
evidence: the test name and result, the assertion and observed values, a short
log excerpt. Keep evidence tight and specific.

### Step 3 — Propose a status per criterion

For each criterion, propose one of:

- `pass` — the proof ran and the behavior held, with evidence.
- `fail` — the proof ran and the behavior did not hold.
- `needs-human` — the proof is inherently visual or judgmental and you cannot
  decide it mechanically (confirm a layout looks right, a color reads well).

Propose; do not decide. The verdict is the human's at assess.

### Step 4 — Write the Proof Ledger

Write one line per criterion into the Throughline's `## Proof Ledger` section:
the id, the statement, the proposed status, and the evidence. For example:

    ## Proof Ledger
    - ac1 search filters rows — PASS — playwright: typed "char", rows 1010 -> 6
    - ac2 column header sorts — PASS — playwright: clicked #col-bst, first row bst ascending
    - ac3 column toggle hides column — NEEDS-HUMAN — toggled #toggle-bst, column hidden; confirm visually

Also set each criterion's `status` in the frontmatter to your proposed value.

### Step 5 — Hand off to assess

Set `next_action` to the assess stage so the human can check off the ledger.
Do not set `status: done` and do not commit — that is the human's call at
assess, then close.

## DevOS: the prove stage

The prove stage is heavy work, so the Conductor dispatches it under **Context
Encapsulation** — a sub-agent with its own context window, at the Throughline's
recorded tier. Return a structured result the Conductor writes back: at least
`files_changed` (usually none), `tests` (what ran and how), `artifacts`
(evidence), `ac_status` (proposed status per criterion), and
`suggested_next_action` (the assess stage). The Conductor edits the Throughline
and advances; you only produce the ledger and the result.

## Rules

- Propose statuses; never render the final verdict. The human disposes at assess.
- Never mark a criterion `pass` without concrete evidence.
- Prefer Playwright or DOM assertions over headless Google Chrome screenshots,
  which are known to crash on this machine — verify the rendered result another
  way.
- Do not commit or mark the run done; hand off to assess.
