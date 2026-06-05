---
name: explain
description: "Explain concepts in a three-layer caveman sandwich: terse TLDR, short human explanation, and a best-fit visual — a caveman ASCII diagram by default, or a /table (comparative data) or /diagram (architecture, flows, processes) when that fits the concept better. Use when the user invokes /explain, asks to explain a concept, or wants a concise Lexicon-grounded explanation."
argument-hint: "<concept>"
---

# /explain — Caveman Sandwich Concept Explainer

Explains any concept as a caveman sandwich: caveman tldr on top, human language in middle, a best-fit visual on bottom. No prompts, immediate output.

## Invocation

`/explain <concept>`

## Output Format

Always this structure, always all three layers in this order:

```
## [Concept], explained

### TLDR
[One-line caveman summary — `/caveman full` style]

### Human
[1-2 paragraph human-readable explanation, optionally with analogy]

### Visual
[Best-fit visual: caveman ASCII diagram by default — or a `/table` / `/diagram` when the concept fits those better]
```

## Layer Rules

### TLDR (top bread — caveman)
- Invoke `/caveman full` conventions for this layer.
- 1 sentence, no articles, no filler, no hedging.
- Captures what concept IS and why it matters.
- Pattern: `[thing] [action] [reason].`

### Human (filling — normal prose)
- 1-2 paragraphs max.
- Full sentences, normal English, no caveman compression here.
- No jargon unless concept is technical, then define inline.
- Lead with what it IS, then why it matters.
- May include short analogy inline if it creates an "aha" moment. Analogy must be structurally accurate (map parts to parts), not surface-level. Pick from everyday life, not other technical domains.

### Visual (bottom bread — pick the form)
This layer is the visual aid. Pick the single best-fit form for the concept; do not stack all three.

- **Default — caveman ASCII diagram.** Terse, scannable in 5 seconds, `/caveman full` conventions. Best for small structures, trees, and quick flows.
  - Tree diagrams: `├──` and `└──`  ·  Box diagrams: `┌─┐ │ │ └─┘`  ·  Arrow flows: `──▶` and `──┤`
  - Technical terms stay exact. Terse labels, no filler words.
- **Comparative or multi-attribute concept** (options, trade-offs, a matrix, "X vs Y") → render a `/table md` instead of ASCII.
- **Structural or process concept** (architecture, a pipeline, a user flow, a sequence, a state machine) richer than ASCII can carry → use `/diagram md` (ASCII sketch + auto-rendered Mermaid). Offer `/diagram html` if Chris will want to click through it.
- 2-4 caveman bullet takeaways below the visual are fine.

## Behavior

- No confirmation prompts. `/explain X` → sandwich immediately.
- If concept ambiguous, pick most likely interpretation in context. Note alternatives at bottom.
- Keep total output under ~40 lines. Brevity is point.
- Default to in-chat visuals (ASCII, `/table md`, `/diagram md`) so the sandwich stays immediate; only reach for `/table html` or `/diagram html` when Chris will want to explore interactively.
- If project has `CONTEXT.md`, check it for domain-specific definitions of concept.
- If concept is a Lexicon term, use Lexicon definition as ground truth for Human layer.

## Example

`/explain Lineup Combinations`

```
## Lineup Combinations, explained

### TLDR
Lineup = 5 players on court. Team bigger than 5 = score every C(N,5) group, rank best.

### Human
In Cornerstone, a Lineup is exactly 5 players on the court together — the atomic
unit the engine scores. When a Team has more than 5 players, the engine evaluates
every possible group of 5. These are Lineup Combinations: all C(N,5) ways to choose
5 players from N. A 9-player Rotation produces 126 combinations. A 12-player Roster
produces 792. Each one gets scored independently.

Think of it like a band with 9 musicians but only 5 can play a set at once. Lineup
Combinations are every possible 5-person set list. The sound check (engine) ranks
them; the best-sounding combo becomes your opening act (Starting Lineup).

### Visual
Team size → Lineup Combinations
├── 5 players  → C(5,5) = 1     → score direct
├── 9 players  → C(9,5) = 126   → score all, rank cohesion
└── 12 players → C(12,5) = 792  → score all, rank cohesion

Engine score at Lineup level (5).
Bigger Team = more combos = richer eval.
Starting Lineup = first 5 slots, not always best combo.
```
