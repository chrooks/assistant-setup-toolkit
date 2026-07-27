---
name: grill-with-docs
description: Grilling session that challenges your plan against the existing domain model, sharpens terminology, and updates documentation (LEXICON.md, ADRs) inline as decisions crystallise. Use when user wants to stress-test a plan against their project's language and documented decisions.
upstream:
  repo: mattpocock/skills
  path: skills/engineering/grill-with-docs/SKILL.md
  ref: ed37663cc5fbef691ddfecd080dff42f7e7e350d
  relationship: wrapper
---

Run a `/grilling` session, using the `/domain-modeling` skill, with the changes below.

Both are fetched from upstream and carry the substance. `grilling` holds the
interview itself — relentless questioning, one branch of the decision tree at a
time, a recommended answer for every question, and the rule that **facts** get
looked up while **decisions** come to the human. `domain-modeling` holds the
doc-writing discipline — challenging terms against the glossary, sharpening fuzzy
language, stress-testing with concrete scenarios, cross-referencing against code,
and the three-part test for when a decision earns an ADR. Do not restate either
here; read those skills.

Everything below is deliberate local divergence. It lives here, in a file this
repo owns, precisely so both upstream skills can keep tracking upstream.

## Override: ask in rounds

Ask in **dependency-ordered rounds**, not one question at a time — `grilling`
says one at a time, and this overrides it, exactly as `/grill-me` does.

A round is every open question whose answer does not depend on another open
question. Ask those together, take one reply covering all of them, then build the
next round from what those answers unlocked.

- Number questions continuously across the whole session — Q1–Q4 in round one, Q5–Q7 in round two — so replies can address them by number and out of order.
- Never put two questions in the same round when one's answer would change the other's framing. That dependency is what rounds preserve and a flat question-dump destroys.
- Give your recommended answer for every question. Most rounds should be answerable with "yes to all but Q3."
- Three to five questions per round is the working range. Past that, split the round.

**Why the override:** one-at-a-time ends every session with a run of questions that
are all agreements, each costing a full model round trip. Rounds collapse those into
one reply, and the dependency ordering is what keeps that safe.

## Override: the glossary is `LEXICON.md`, not `CONTEXT.md`

`domain-modeling` names the project glossary `CONTEXT.md` throughout — the file
structure, the challenge-against-the-glossary rule, the update-inline rule, and
its `CONTEXT-FORMAT.md` reference. **Everywhere it says `CONTEXT.md`, read
`LEXICON.md`.**

One exception: when a repo already carries a legacy `CONTEXT.md` holding its
Lexicon, keep updating that file under its existing name rather than splitting the
glossary across two files. Create `LEXICON.md` only when neither exists.

Use the format in [LEXICON-FORMAT.md](./LEXICON-FORMAT.md) rather than upstream's
`CONTEXT-FORMAT.md`. For ADRs, upstream's `ADR-FORMAT.md` stands as written —
there is no local divergence there.

The `CONTEXT-MAP.md` multi-context convention is upstream's and unchanged; a repo
with several contexts still points at them from that file.
