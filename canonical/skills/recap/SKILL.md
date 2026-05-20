---
name: recap
description: Package a conversation into dual-format recap artifacts: an incremental visual HTML recap for humans and a structured markdown recap for LLM context loading. Use when the user asks to recap, package the conversation, wrap this up, summarize the convo, make this digestible, give me a visual summary, convo recap, or wants both human-readable and machine-readable versions of a long or sprawling conversation.
argument-hint: "[optional short topic slug]"
disable-model-invocation: false
allowed-tools: Read, Write, Edit
---

# Recap

Produce a dual-format conversation recap:

1. **Visual recap** — an interactive HTML widget rendered inline, designed for incremental human consumption one section card at a time.
2. **LLM-digestible recap** — a structured markdown file optimized for loading as context in a future Claude or LLM session.

Both outputs are required. The visual recap helps the human review the conversation now; the markdown recap is the queryable artifact for priming the next session later.

## When To Trigger

Trigger on phrases like:

- "package this convo up"
- "give me a recap"
- "wrap this up visually"
- "summarize what we just talked about"
- "make this digestible"
- "I want a convo recap"
- "visual + LLM version"
- "I want this in two formats"

Also trigger proactively after long word-dump sessions where the user has done substantial verbal exploration and would clearly benefit from packaged output, even if they do not explicitly use a trigger phrase. Lean toward triggering. Under-triggering is the bigger risk.

## Execution

### Step 1: Sweep The Conversation

Identify and extract:

- **Threads** — distinct topical conversations running in parallel, using the user's Lexicon term "Convo Threads" if present.
- **Lexicon additions** — new vocabulary terms defined or used, distinguished into canonical prior-art terms and custom user-coined terms.
- **Principles / ethos** — design philosophy, frameworks, or rules of thumb articulated.
- **Decisions** — concrete commitments made during the conversation.
- **Action items** — TODOs, issues, and follow-ups, especially scoped to specific projects the user mentioned.
- **PRD seeds** — ideas for new projects, documents, or conversations to fork.
- **Open questions** — things explicitly left unresolved.

If the conversation references a `CONTEXT.md` or project doc, treat that vocabulary as authoritative and use it precisely in both outputs.

### Step 2: Produce The Visual Recap

If the runtime provides visualization tools, call `visualize:read_me` with modules `["interactive", "mockup"]` before the first `visualize:show_widget` call.

Then call `visualize:show_widget` with a vertical card stack:

- **Top nav row** — jump links to each section. Use anchor links and smooth scroll if JavaScript is included.
- **One card per section** — each card has a clear `h2` heading.
- **Bite-sized** — each card should be readable in about 30 seconds.
- **Color ramps** — use color to differentiate sections. Suggested ramps: `c-purple` for ethos, `c-teal` for Lexicon, `c-amber` for action items, `c-blue` for toolkit or structure, and `c-coral` for build backlog.
- **Design system compliance** — follow the visualization tool's design rules, including sentence case, no emoji, and no more than two font weights.

Required sections, omitting any that do not apply:

1. **TL;DR** — 2-3 sentence summary at the top.
2. **Design ethos / principles** — articulated philosophy as a grid of small cards.
3. **Lexicon** — terms defined, grouped by canonical vs. custom.
4. **Threads** — topical threads that ran in parallel.
5. **Action items** — TODOs and issues, with project tags.
6. **Toolkit / structural decisions** — taxonomy or framework decisions, if applicable.
7. **Build backlog** — PRD seeds, new projects, and next conversations to fork.

If visualization tools are unavailable, create a standalone HTML widget file alongside the markdown recap and present it as the visual recap artifact.

### Step 3: Produce The LLM-Digestible Recap

Create a markdown file at `/mnt/user-data/outputs/recap-[short-topic-slug].md`. If that directory is unavailable in the runtime, use the nearest user-visible output directory and state the path.

Use this structure:

```markdown
# Conversation recap: [Topic]

**Date:** YYYY-MM-DD
**Source:** Claude conversation
**Purpose:** Context loader for future Claude/LLM sessions

---

## TL;DR
[2-3 sentence summary]

## Threads
- **Thread A — [name]:** [1-sentence summary]
- **Thread B — [name]:** [1-sentence summary]

## Lexicon established

### Canonical terms (prior art)
| Term | Definition | Source |
|------|------------|--------|
| ... | ... | ... |

### Custom terms (user-coined)
| Term | Definition |
|------|------------|
| ... | ... |

## Principles / ethos articulated
1. **[Principle name]** — [one-paragraph definition with concrete implication]

## Decisions made
- [Decision 1]

## Open questions
- [Question 1]

## Action items
- [ ] [Item 1] — [project tag if applicable]

## PRD seeds / next conversations to fork
1. **[Seed name]** — [brief description + why it matters]

## Priming context for next session
[A short paragraph another Claude can read to instantly know where we left off. Write it as if handing off to a fresh session: explicit about state, what is decided, and what is open.]
```

### Step 4: Present Both Artifacts

If `present_files` is available, call it with the markdown recap and any generated HTML fallback file. If the Skill itself was created or changed in the same session, include `SKILL.md` too. The visual widget is already inline when `visualize:show_widget` is available.

In the response message:

- Briefly name the topic and point at both formats.
- Highlight 1-2 priority action items.
- Invite the user to act on any of them.

## Format Rules

- No fluff in either output. No "great conversation" intro.
- Match the user's voice when present. Preserve their idiom, terminology, and tone.
- The LLM-digestible markdown is for context loading, not casual re-reading. Write it as if priming a fresh Claude or LLM session.
- The visual recap is for incremental human consumption. Each card should be self-contained enough that the human can pause between cards.
- Preserve round-trip integrity. A future Claude or LLM reading only the markdown should be able to reconstruct enough context to resume the work meaningfully.
- Use authoritative Lexicon terms when present. Do not replace them with near synonyms.

## Anti-Patterns

- Do not produce a single huge wall of text in either format.
- Do not use emoji unless the user does.
- Do not editorialize about the conversation quality.
- Do not omit the LLM-digestible markdown.
- Do not use the visual widget as the canonical record. The markdown file is the queryable artifact.
- Do not lose user-coined terms. Preserve their exact phrasing in the Lexicon section.
