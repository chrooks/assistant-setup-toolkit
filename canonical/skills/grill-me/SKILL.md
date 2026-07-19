---
name: grill-me
description: Interview the user relentlessly about a plan or design until reaching shared understanding, resolving each branch of the decision tree. Records each resolved decision into the DevOS Throughline's Decision Ledger when one exists. Use when the user wants to stress-test a plan, get grilled on their design, mentions "grill me", or as the DevOS grill stage.
---

Interview me relentlessly about every aspect of this plan until we reach a shared understanding. Walk down each branch of the design tree, resolving dependencies between decisions. For each question, provide your recommended answer.

If a question can be answered by exploring the codebase, explore the codebase instead. This is the single highest-leverage rule here — a question you could have answered yourself costs the human a round trip and returns nothing.

## Ask in rounds

Ask in **dependency-ordered rounds**, not one question at a time.

A round is every open question whose answer does not depend on another open question. Ask those together, take one reply covering all of them, then build the next round from what those answers unlocked.

- Number questions continuously across the whole session — Q1–Q4 in round one, Q5–Q7 in round two — so replies can address them by number and out of order.
- Never put two questions in the same round when one's answer would change the other's framing. That dependency is exactly what rounds preserve and a flat question-dump destroys.
- Later rounds build on earlier answers. Do not restate resolved ground.
- Keep each question short. A round is read all at once, so length compounds — four terse questions land, four paragraphs do not.
- Give your recommended answer for every question. Most rounds should be answerable with "yes to all but Q3."
- Three to five questions per round is the working range. Past that, split the round.

**Why:** one-at-a-time ends every session with a run of questions that are all agreements — "agree, agree, agree" — each costing a full model round trip. Rounds collapse those into one reply. The tradeoff is more reading per round, which terse questions pay down.

The dependency ordering is what makes this safe. Dumping every question at once is faster still and produces incoherent answers, because half the questions are premature.

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
