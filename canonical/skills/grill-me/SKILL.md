---
name: grill-me
description: Interview the user relentlessly about a plan or design until reaching shared understanding, resolving each branch of the decision tree. Records each resolved decision into the DevOS Throughline's Decision Ledger when one exists. Use when the user wants to stress-test a plan, get grilled on their design, mentions "grill me", or as the DevOS grill stage.
---

Interview me relentlessly about every aspect of this plan until we reach a shared understanding. Walk down each branch of the design tree, resolving dependencies between decisions one-by-one. For each question, provide your recommended answer.

Ask the questions one at a time.

If a question can be answered by exploring the codebase, explore the codebase instead.

## DevOS: record decisions into the Throughline

When this is the DevOS grill stage — there is a Throughline at
`feature_requests/*-throughline.md` with `status: in_progress` — the grill is
not just conversation; it is how the Decision Ledger gets filled.

- Scope may have seeded `## Decision Ledger` with open Meaningful Decisions (a
  Meaningful Decision is a choice that needs the human because it was not
  already specified). Resolve those first; surface any new ones you uncover.
- As each decision is resolved, append one entry to `## Decision Ledger`:
  the question, the choice that was made, and a one-line rationale. Mark the
  matching open item resolved. Append as you go — do not wait until the end —
  so the run survives compaction mid-grill.
- When every Meaningful Decision is resolved, set `next_action` to `/plan
  <issue>` (the work needs an acceptance-criteria-and-proof plan) or, when the
  approach is already concrete enough to build, to the implement stage. Then
  advance `stage` to match.

Editing the Throughline is mechanical: change only the fields and ledger lines
that moved, keep the file valid, and preserve everything else.
