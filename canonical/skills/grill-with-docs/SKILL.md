---
name: grill-with-docs
description: Grilling session that challenges your plan against the existing domain model, sharpens terminology, and updates documentation (LEXICON.md, ADRs) inline as decisions crystallise. Use when user wants to stress-test a plan against their project's language and documented decisions.
---

<what-to-do>

Run a `/grilling` session, applying the domain-awareness material below throughout.

`grilling` is fetched from upstream and carries the interview itself — including
the rule that **facts** get looked up while **decisions** come to the human. Do not
restate it here; read that skill.

**Override, same as `/grill-me`:** ask in **dependency-ordered rounds**, not one
question at a time. A round is every open question whose answer does not depend on
another open question — ask those together (3–5 per round), take one reply covering
all of them, then build the next round from what those answers unlocked. Number
questions continuously across the session (Q1–Q4, then Q5–Q7) and give your
recommended answer for every question. Never put two questions in the same round
when one's answer would change the other's framing — sequence those across rounds.

</what-to-do>

<supporting-info>

## Domain awareness

During codebase exploration, also look for existing documentation:

### File structure

Most repos have a single context:

```
/
├── LEXICON.md
├── docs/
│   └── adr/
│       ├── 0001-event-sourced-orders.md
│       └── 0002-postgres-for-write-model.md
└── src/
```

If a `CONTEXT-MAP.md` exists at the root, the repo has multiple contexts. The map points to where each one lives:

```
/
├── CONTEXT-MAP.md
├── docs/
│   └── adr/                          ← system-wide decisions
├── src/
│   ├── ordering/
│   │   ├── LEXICON.md
│   │   └── docs/adr/                 ← context-specific decisions
│   └── billing/
│       ├── LEXICON.md
│       └── docs/adr/
```

Create files lazily — only when you have something to write. If no `LEXICON.md` exists, create one when the first term is resolved — unless a legacy `CONTEXT.md` already holds the project's Lexicon; keep updating that file under its existing name. If no `docs/adr/` exists, create it when the first ADR is needed.

### Path overrides

Before writing ADRs, check if `.cowork/config.yaml` exists and has an `adr_dir` key. If so, use that path instead of `docs/adr/`. If missing or malformed, use the default.

### Index update (standalone invocation)

After writing files, if `.cowork/index.md` exists, update the **Source-of-truth documents** section: add/update the `LEXICON.md` entry and any new ADR entries. Update the header timestamp. If `.cowork/index.md` does not exist, skip — no-op.

## During the session

### Challenge against the Lexicon

When the user uses a term that conflicts with the existing language in `LEXICON.md`, call it out immediately. "Your Lexicon defines 'cancellation' as X, but you seem to mean Y — which is it?"

### Sharpen fuzzy language

When the user uses vague or overloaded terms, propose a precise canonical term. "You're saying 'account' — do you mean the Customer or the User? Those are different things."

### Discuss concrete scenarios

When domain relationships are being discussed, stress-test them with specific scenarios. Invent scenarios that probe edge cases and force the user to be precise about the boundaries between concepts.

### Cross-reference with code

When the user states how something works, check whether the code agrees. If you find a contradiction, surface it: "Your code cancels entire Orders, but you just said partial cancellation is possible — which is right?"

### Update LEXICON.md inline

When a term is resolved, update `LEXICON.md` right there. Don't batch these up — capture them as they happen. Use the format in [LEXICON-FORMAT.md](./LEXICON-FORMAT.md).

Don't couple `LEXICON.md` to implementation details. Only include terms that are meaningful to domain experts.

### Offer ADRs sparingly

Only offer to create an ADR when all three are true:

1. **Hard to reverse** — the cost of changing your mind later is meaningful
2. **Surprising without context** — a future reader will wonder "why did they do it this way?"
3. **The result of a real trade-off** — there were genuine alternatives and you picked one for specific reasons

If any of the three is missing, skip the ADR. Use the format in [ADR-FORMAT.md](./ADR-FORMAT.md).

</supporting-info>
