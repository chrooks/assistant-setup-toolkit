---
name: grill-me
description: Interview the user relentlessly about a plan or design until reaching shared understanding, resolving each branch of the decision tree. Records each resolved decision into the DevOS Throughline's Decision Ledger when one exists. Use when the user wants to stress-test a plan, get grilled on their design, mentions "grill me", or as the DevOS grill stage.
upstream:
  repo: mattpocock/skills
  path: skills/productivity/grilling/SKILL.md
  ref: 84fdeffd12f2ee307994d1eb6feb48173b6e0502
  relationship: wrapper
---

Run a `/grilling` session, with the one change below.

`grilling` is fetched from upstream and carries the interview itself — the
round-by-round frontier interview, numbered questions with a recommended answer
for each, and the rule that **facts** get looked up while **decisions** come to
the human. Do not restate those here; read that skill. (The rounds behavior used
to be a local override; upstream adopted it in July 2026, so it now lives there.)

Everything below is deliberate local divergence. It lives here, in a file this
repo owns, precisely so `grilling` can keep tracking upstream.

## Override: no confirmation gate before the next stage

`grilling` ends by waiting for confirmation before acting. In the DevOS lifecycle
the plan stage carries its own approval gate, so stopping twice is friction — see
the routing rule at the end of the next section.

## DevOS: record decisions into the Throughline

When this is the DevOS grill stage — there is a Throughline at
`.tasks/*/throughline.md` with `status: in_progress` — the grill is
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
- When the route is `/plan`, run the plan stage immediately in the same
  conversation — do not stop for the human between grill and plan; the plan's
  approval gate is the human stop. When the route is implement, stop for the
  human as usual.

Editing the Throughline is mechanical: change only the fields and ledger lines
that moved, keep the file valid, and preserve everything else.
