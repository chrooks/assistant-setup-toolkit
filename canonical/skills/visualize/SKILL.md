---
name: visualize
description: "Pick the best-fit visual for a concept's shape and render it — the umbrella router over /table, /diagram, /figure, and inline ASCII/tree. Use when a concept has a shape a visual carries (a comparison, a process, an architecture, a state machine, a hierarchy, a number-story), when the user invokes /visualize, says 'visualize this' / 'show me this', or asks for the best way to picture something. Routes the form choice through the shared visual-picker rule; it does not re-derive the cheat sheet."
argument-hint: "<concept or data to visualize>"
---

# /visualize — Best-Fit Visual Router

One umbrella for "show me this." Given a concept, pick the single best-fit form for its
**shape**, then render it with the concrete skill that owns that form. This skill is a
thin router — it does **not** restate the picker logic.

## Invocation

```
/visualize <concept or data>
```

No confirmation prompts. `/visualize X` → pick the form, render it immediately.

## How It Routes

1. **Read the shape.** Consult the single source of truth —
   [`~/.claude/rules/common/visual-picker.md`](~/.claude/rules/common/visual-picker.md) —
   match the concept's shape to a form in its cheat sheet. (Do not re-derive the table here;
   that rule owns it.)
2. **Render with the form's skill:**
   - Comparison / multi-attribute, or looking up exact values → **`/table`** (`md` for a quick read-only table, `html` for sort/filter/search).
   - Quantitative shape — trend, magnitude comparison, ranking, distribution, correlation → **`/figure`** (`md` for inline ASCII bars, `html` for an interactive D3 chart).
   - Architecture, pipeline, user flow, sequence, state machine → **`/diagram`** (`md` for ASCII + Mermaid, `html` for an interactive graph).
   - Hierarchy / part-whole, or a short parallel/sequential set → an **inline ASCII tree or list** (no separate file).
   - Genuine narrative, nuance, or "why" → **prose** — say so and skip the visual.
3. **Introduce the figure in the sentence before it**, then render.

## Guardrails

All guardrails live in the shared rule — representational not decorative, integrate labels,
the ~2-sentence-cell limit, and the light expertise taper. Honor them; do not duplicate them.
When the concept has no visual-carrying shape, render nothing and explain in prose.

## Relationship to the other visual skills

- `/table`, `/figure`, and `/diagram` are the concrete renderers `/visualize` routes to — call them directly when the form is already obvious.
- `/wym` and `/walkthrough` defer the same "which form" decision to the same shared rule, so a concept is visualized the same way wherever it surfaces.
