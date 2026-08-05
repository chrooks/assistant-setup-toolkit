---
name: wym
description: "wym (\"what you mean?\") explains a concept in three sentences or fewer of plain layman English, then offers to drill deeper. Drill mode returns the full sandwich: a plain-English intro that frames the concept, a short human explanation, a best-fit visual, and a terse caveman TLDR last as the takeaway (visual form deferred to ~/.claude/skills/visualize/visual-picker.md). Use when the user invokes /wym, says 'wym' / 'what do you mean', asks to explain a concept, or wants a concise Lexicon-grounded explanation. Also the per-topic illustrator that /walkthrough calls one topic at a time, always in drill mode."
argument-hint: "<concept> [drill]"
---

# /wym — Concept Explainer

Answers "what you mean?" in three sentences or fewer, then offers to go deeper.
The deeper form is a sandwich: a plain-English **intro** that frames the concept on top,
human language and a best-fit **visual** in the middle, and a caveman **TLDR** on the
bottom as the compressed takeaway the reader keeps.

| Mode | Trigger | Output |
|---|---|---|
| **Quick** — default | `/wym <concept>` | 3 sentences or fewer, plain layman English, then the drill offer |
| **Drill** | The user replies `drill` · `/wym <concept> drill` · another Skill calls `/wym` | The full sandwich — Intro · Human · Visual · TLDR |

## Invocation

`/wym <concept>` · `/wym <concept> drill`

## Quick mode — the default

- **Three sentences or fewer.** Plain layman English. No headings, no visual, no caveman.
- Assume no familiarity with the domain. Define an unavoidable term inline, in one short clause.
- **Answer the question.** Quick mode is a complete short answer, not a teaser for drill mode.
- Close with exactly this line, on its own, and write nothing after it:

      Enter **drill** to go deeper.

## Drill mode

Reached three ways: the user replies `drill`, the user invokes `/wym <concept> drill`, or another
Skill calls `/wym` — `/walkthrough` always needs the full sandwich per topic.

Always this structure, always all four parts in this order:

```
## [Concept], explained

### Intro
[One plain-English sentence that SETS UP the concept — what we are about to unpack, not a verdict. Closest-to-human framing, NOT caveman.]

### Human
[1-2 paragraph human-readable explanation, optionally with analogy]

### Visual
[Best-fit visual: caveman ASCII diagram by default — or a `/table` / `/diagram` when the concept's shape fits those better]

### TLDR
[One-line caveman takeaway — `/caveman full` style — the compressed thing the reader keeps]
```

## Layer Rules

### Intro (top bread — plain English, the frame)
- Plain, close-to-human language. NOT caveman — save the word-economy for the TLDR.
- 1 full sentence that **sets up** the concept — names what we are about to unpack. A frame, NOT a verdict.
- Explain the concept as plainly as possible; do not resolve or conclude here (that is the TLDR's job at the bottom).

### Human (filling — normal prose)
- 1-2 paragraphs max.
- Full sentences, normal English, no caveman compression here.
- No jargon unless concept is technical, then define inline in one short clause.
- Lead with what it IS, then why it matters.
- May include short analogy inline if it creates an "aha" moment. Analogy must be structurally accurate (map parts to parts), not surface-level. Pick from everyday life, not other technical domains.

### Visual (filling — pick the form via the shared rule)
This is the visual aid. Pick the single best-fit form for the concept's shape; do not stack
forms. **Defer the "which form" decision to the shared picker** —
[`~/.claude/skills/visualize/visual-picker.md`](~/.claude/skills/visualize/visual-picker.md) — and
honor its guardrails (representational not decorative, integrate labels, ~2-sentence-cell
limit, light expertise taper). Do not restate that cheat sheet here.

- **Default — caveman ASCII diagram.** Terse, scannable in 5 seconds, `/caveman full` conventions. Best for small structures, trees, and quick flows.
  - Tree diagrams: `├──` and `└──`  ·  Box diagrams: `┌─┐ │ │ └─┘`  ·  Arrow flows: `──▶` and `──┤`
  - Technical terms stay exact. Terse labels, no filler words.
- When the shared rule points to a comparative/multi-attribute shape → render a `/table md` instead of ASCII.
- When it points to a richer structural/process shape than ASCII can carry → use `/diagram md` (ASCII sketch + auto-rendered Mermaid). Offer `/diagram html` if the user will want to click through it.
- 2-4 caveman bullet takeaways below the visual are fine.

### TLDR (bottom bread — caveman, the takeaway)
- Invoke `/caveman full` conventions for this layer.
- 1 sentence, no articles, no filler, no hedging.
- Captures what the concept IS and why it matters — the compressed line the reader keeps (recency).
- Pattern: `[thing] [action] [reason].`

## Behavior

- No confirmation prompts. `/wym X` → quick answer immediately; `drill` → sandwich immediately.
- The drill offer is the only prompt wym ever writes. It is an offer, not a question — never wait for it, never ask a follow-up instead.
- The intro frames; the TLDR lands last. Never open with the conclusion — that is the TLDR's job at the bottom.
- If concept ambiguous, pick most likely interpretation in context. Note alternatives at bottom.
- Keep drill output under ~40 lines. Brevity is point.
- Default to in-chat visuals (ASCII, `/table md`, `/diagram md`) so the sandwich stays immediate; only reach for `/table html` or `/diagram html` when the user will want to explore interactively.
- If project has `LEXICON.md`, check it for domain-specific definitions of concept.
- If concept is a Lexicon term, use Lexicon definition as ground truth for Human layer.

## Example — quick mode

`/wym Lineup Combinations`

```
A Lineup is the 5 players on the court together, and a Team usually carries more than 5.
Lineup Combinations are every possible group of 5 you could pick from that Team — 126 of
them for a 9-player Team. The engine scores each group so it can rank which 5 fit best.

Enter **drill** to go deeper.
```

## Example — drill mode

`drill`

```
## Lineup Combinations, explained

### Intro
A Team often has more than 5 players, so the engine has to decide which 5 belong on the court together.

### Human
In basketball analytics, a Lineup is exactly 5 players on the court together — the atomic
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

### TLDR
Lineup = 5 players on court. Team bigger than 5 = score every C(N,5) group, rank best.
```
