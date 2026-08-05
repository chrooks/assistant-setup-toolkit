# Handoff Format

When a handoff is written to disk (only when genuinely needed — default is the copyable block), it lives in the harness config dir (`.claude/handoffs/` on Claude Code, `.codex/handoffs/` on Codex) with date-prefixed naming: `<YYYY-MM-DD>-<slug>.md`.

## Template

````md
# <Previous Convo Summary> -> <Next Step> Handoff

## READ THIS FIRST — THIS IS A BRIEFING, NOT A WORK ORDER
**Do not create, edit, or delete any file in this session until I tell you to start.**
Everything below is context. The steps are a proposed plan, not a task list to execute.

Your only job this turn:
1. Read this handoff.
2. Explore the repo for the context it points to.
3. Reply with your understanding of the current state and the direction you propose.
4. Stop and wait for my instruction.

## Context
Read and follow <plan-file> as the source of truth. Also respect <questions-file>.

## Current Implementation Status
- Completed <completed paragraph or milestone>.
- Added/updated:
  - <path>
  - <path>
- Focused tests currently pass for <area list>.

## Important Working Instructions
- <instruction>
- <instruction>

## Proposed Next 3 Steps — do not start these
1. <the next narrow step>
2. <the next narrow step>
3. <the next narrow step>

## Expectations For This Conversation
1. <expectation>
2. <expectation>

## Verification Baseline
Use the repo `.venv` interpreter. Preserve passing tests for:
- <test module>
- <test module>

---
**Reminder — do not implement anything yet.** Acknowledge this handoff, explore the repo, propose a direction, then wait.
````

## Section guidance

### The stop gate (top and bottom)
- Keep it in **both** places. Do not collapse it into one.
- The top copy is the one that works: it sets the mode before the reader meets the numbered steps. A directive that arrives only after a to-do list reads as a footnote to the list.
- Keep "do not start these" attached to the steps heading. The heading is where a model decides the message is a work order.
- Codex is the strictest test of this. If the handoff is being pasted into Codex, do not soften any of the three markers.

### Title line
- Format: `# <couple-word summary of previous convo> -> <next step> Handoff`
- Keep the summary to ~2-5 words and the next step short and concrete.

### Context
- Point to the source-of-truth files (plan, PRD, questions file).
- Reference `LEXICON.md` and relevant ADRs when they exist.

### Current Implementation Status
- Summarize only work that is **complete** — do not speculate.
- Mention files only when they belong to completed scope.
- Mention tests only when they actually passed.

### Important Working Instructions
- User instructions from the current session.
- Durable repo-level instructions that affect the next step.
- Carry forward prior handoff instructions unless explicitly replaced.

### Next 3 Steps
- Keep each step narrow enough that the next session can start immediately.
- If `$ARGUMENTS` were provided, use that as the first step's scope hint.

### Verification Baseline
- List focused tests that should remain green before and after the next step.
- Use repo-local `.venv` interpreter when that is the established environment.
