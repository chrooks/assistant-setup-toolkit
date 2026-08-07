---
name: grill-with-docs
description: Grilling session that challenges your plan against the existing domain model, sharpens terminology, and updates documentation (LEXICON.md, ADRs) inline as decisions crystallise. Use when user wants to stress-test a plan against their project's language and documented decisions.
upstream:
  repo: mattpocock/skills
  path: skills/engineering/grill-with-docs/SKILL.md
  ref: 84fdeffd12f2ee307994d1eb6feb48173b6e0502
  relationship: wrapper
---

Run a `/grilling` session, using the `/domain-modeling` skill, with the changes below.

Both are fetched from upstream and carry the substance. `grilling` holds the
interview itself — the round-by-round frontier interview, numbered questions with
a recommended answer for each, and the rule that **facts** get looked up while
**decisions** come to the human. (The rounds behavior used to be a local override;
upstream adopted it in July 2026, so it now lives there.) `domain-modeling` holds the
doc-writing discipline — challenging terms against the glossary, sharpening fuzzy
language, stress-testing with concrete scenarios, cross-referencing against code,
and the three-part test for when a decision earns an ADR. Do not restate either
here; read those skills.

Everything below is deliberate local divergence. It lives here, in a file this
repo owns, precisely so both upstream skills can keep tracking upstream.

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
