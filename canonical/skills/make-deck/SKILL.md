---
name: make-deck
description: Generate a native, text-editable PowerPoint deck (.pptx) from markdown or a demo plan via Pandoc and a reference template. Use when the user asks to make a deck, build slides, create a PowerPoint, turn a plan or outline into slides, or invokes /make-deck — including on a /prep-demo plan.
argument-hint: "<source plan/outline/file, or deck topic>"
disable-model-invocation: false
---

# Make Deck

Turn content into a `.pptx` the user can open, tweak, and iterate on in PowerPoint. Every element must stay text-editable — never use image-based exporters (Marp `--pptx`, screenshots-as-slides).

## Inputs

The argument is the source: a file path, a /prep-demo plan in the conversation, an outline, or a bare topic. With a /prep-demo plan, slides carry the Show beats; the timed walkthrough stays the speaker track. With only a topic, draft the outline first and confirm it in one exchange before generating.

## Process

1. **Write `deck.md`** next to the source (or in the current project): one `# H1` per section slide, `## H2` per content slide, sparse bullets under each. `:::notes` blocks become speaker notes. One idea per slide; cut before compressing.
2. **Resolve the reference template**, in order:
   - `~/.claude/deck-theme.pptx` — the user's polished theme. It lives outside the synced skills tree so installs never clobber it.
   - If missing, scaffold the starter once:
     `pandoc -o ~/.claude/deck-theme.pptx --print-default-data-file reference.pptx`
     Then tell the user in one line: open it in PowerPoint, set fonts, colors, and layouts on the slide master, save. Every future deck inherits it.
3. **Generate:**
   `pandoc deck.md -o deck.pptx --reference-doc ~/.claude/deck-theme.pptx`
4. **Report** the output path, and remind the user the deck is fully editable — tweak by hand in PowerPoint, or ask here for a regeneration with changes. Keep `deck.md` as the source of truth for regenerations.

## Guardrails

- Pandoc is the only dependency; it runs on restricted machines as a standalone binary. If `pandoc` is not on PATH, say so and hand back `deck.md` so the deck can be generated on another machine.
- Do not restyle inside `deck.md` with raw XML or per-slide hacks — theme changes belong in `deck-theme.pptx`.
- Slides are visual anchors, not the script. Speaker content belongs in notes or the demo plan.
