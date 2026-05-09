# /explain — Three-Layer Concept Explainer

Explains any concept in three layers: human language, visual analogy, and caveman diagram. No prompts, immediate output.

## Invocation

`/explain <concept>`

## Output Format

Always this structure, always all three layers:

```
## [Concept], explained

[1-2 paragraph human-readable explanation]

### Analogy
[Relatable comparison — structurally accurate, not just surface-level]

### Caveman
[ASCII diagram, terse, scannable in 5 seconds]
```

## Layer Rules

### `/caveman` one line definition.
- 1 sentence explanation of introducing topic. think of it as a tldr;

### Human language
- 1-2 paragraphs max
- No jargon unless the concept is technical, then define inline
- Lead with what it IS, then why it matters

### Analogy
- Must be structurally accurate, not just a surface metaphor
- Map the parts of the concept to parts of the analogy
- Should create an "aha" moment
- Pick analogies from everyday life, not other technical domains

### Caveman
Follow `/caveman` communication conventions:
- Technical terms stay exact
- Tree diagrams: `├──` and `└──`
- Box diagrams: `┌─┐ │ │ └─┘`
- Arrow flows: `──▶` and `──┤`
- Terse labels, no filler words
- Should compress the concept into something scannable in 5 seconds

## Behavior

- No confirmation prompts. `/explain X` → three layers immediately.
- If concept is ambiguous, pick most likely interpretation in context. Note alternatives at bottom.
- Keep total output under ~40 lines. Brevity is the point.
- If project has `CONTEXT.md`, check it for domain-specific definitions of the concept.
- If concept is a glossary term, use the glossary definition as the ground truth for the human layer.

## Example

`/explain Lineup Combinations`

```
## Lineup Combinations, explained

In Cornerstone, a Lineup is exactly 5 players on the court together — the atomic
unit the engine scores. When a Team has more than 5 players, the engine needs to
evaluate every possible group of 5. These are Lineup Combinations: all C(N,5)
ways to choose 5 players from N. A 9-player Rotation produces 126 combinations.
A 12-player Roster produces 792. Each one gets scored independently.

### Analogy
You have a band with 9 musicians but only 5 can play a set at once. Lineup
Combinations are every possible 5-person set list you could put on stage. The
sound check (evaluation engine) listens to each one and ranks them. The best-
sounding combo becomes your opening act (Starting Lineup).

### Caveman
Team size → Lineup Combinations
├── 5 players  → C(5,5) = 1     → score it directly
├── 9 players  → C(9,5) = 126   → score all, rank by cohesion
└── 12 players → C(12,5) = 792  → score all, rank by cohesion

Engine always score at Lineup level (5).
Bigger Team = more combos = richer evaluation.
Starting Lineup = first 5 slots, not necessarily best combo.
```
