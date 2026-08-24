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

## Override: lettered options, one per line

When a question has discrete options, break them out of the body — one lettered
option per line, then the recommendation as a `Rec:` on the `➡️` line:

```
❓ **Q1** - **<question title>**: <question body>
A) <option>
B) <option>
C) <option>

➡️ Rec: A + C — <one-line justification>
```

This replaces upstream's "multiple choices" folded into the question body. Letters
let a reply say "A" or "B but with X"; keep options mutually scannable and the
justification to one line. Questions with no discrete options keep upstream's
format unchanged.

## Override: no confirmation gate before the next stage

`grilling` ends by waiting for confirmation before acting. In the DevOS lifecycle
the plan stage carries its own approval gate, so stopping twice is friction — see
the routing rule at the end of the next section.

## When the work touches a Surface, grill the design too

If the work changes what a user sees or does — `surface: true` from `/scope`, or
plainly true from the request — then **an unstated interaction is as open a
decision as an unstated API**, and it gets the same relentless treatment. Do not
let design questions pass as "we'll figure that out when we build it"; that is
the sentence this section exists to catch.

Grill these alongside the technical branches:

- **Hierarchy** — what should the user notice first, and what did you make loud
  that does not deserve it?
- **Affordance and Signifier** — what is the primary action, and what visible cue
  tells them it is available? Is that cue **honest** about what happens next?
- **Empty State** — what is on screen before there is any data, and does it teach
  or just apologize?
- **Error State** — what does the user see when it fails, and can they recover
  without leaving?
- **Feedback** — how do they know the action worked?
- **Progressive Disclosure** — what is hidden, and what reveals it?
- **Design Boundary** — what does this do *for* the user, and what does it do
  *with* them? Anything the second question catches is a decision, not a detail.

Two tests to push a vague answer with: **the Mom Test** — could someone
non-technical work it out unaided? — and **the Nick Test** — does the value land
before the user invests any effort? "It's intuitive" is not an answer to either.

Resolve these into the Decision Ledger exactly like technical decisions.

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
