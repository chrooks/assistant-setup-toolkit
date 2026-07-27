---
name: grill-me
description: Interview the user relentlessly about a plan or design until reaching shared understanding, resolving each branch of the decision tree. Records each resolved decision into the DevOS Throughline's Decision Ledger when one exists. Use when the user wants to stress-test a plan, get grilled on their design, mentions "grill me", or as the DevOS grill stage.
upstream:
  repo: mattpocock/skills
  path: skills/productivity/grilling/SKILL.md
  ref: ed37663cc5fbef691ddfecd080dff42f7e7e350d
  relationship: wrapper
---

Run a `/grilling` session, with the two changes below.

`grilling` is fetched from upstream and carries the interview itself — relentless
questioning, one branch of the decision tree at a time, a recommended answer for
every question, and the rule that **facts** get looked up while **decisions** come
to the human. Do not restate those here; read that skill.

Everything below is deliberate local divergence. It lives here, in a file this
repo owns, precisely so `grilling` can keep tracking upstream.

## Override: ask in rounds

Ask in **dependency-ordered rounds**, not one question at a time — `grilling`
says one at a time, and this overrides it.

A round is every open question whose answer does not depend on another open
question. Ask those together, take one reply covering all of them, then build the
next round from what those answers unlocked.

- Number questions continuously across the whole session — Q1–Q4 in round one, Q5–Q7 in round two — so replies can address them by number and out of order.
- Never put two questions in the same round when one's answer would change the other's framing. That dependency is exactly what rounds preserve and a flat question-dump destroys.
- Later rounds build on earlier answers. Do not restate resolved ground.
- Keep each question short. A round is read all at once, so length compounds — four terse questions land, four paragraphs do not.
- Give your recommended answer for every question. Most rounds should be answerable with "yes to all but Q3."
- Three to five questions per round is the working range. Past that, split the round.

**Why the override:** one-at-a-time ends every session with a run of questions that
are all agreements — "agree, agree, agree" — each costing a full model round trip.
Rounds collapse those into one reply. The tradeoff is more reading per round, which
terse questions pay down.

The dependency ordering is what makes this safe. Dumping every question at once is
faster still and produces incoherent answers, because half the questions are
premature.

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
