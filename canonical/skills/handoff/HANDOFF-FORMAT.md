# Handoff Format

Handoffs live in `.cowork/handoffs/` and use date-prefixed naming: `<YYYY-MM-DD>-<slug>.md`.

## Template

````md
# <Previous Convo Summary> -> <Next Step> Handoff

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

## Next 3 Steps
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

**DO NOT PROCEED WITH IMPLEMENTING ANY NEXT STEPS YET**
Acknowledge the receipt of this handoff, explore the repo for relevant context, propose a direction, and wait for further instruction.
````

## Section guidance

### Title line
- Format: `# <couple-word summary of previous convo> -> <next step> Handoff`
- Keep the summary to ~2-5 words and the next step short and concrete.

### Context
- Point to the source-of-truth files (plan, PRD, questions file).
- Reference `CONTEXT.md` and relevant ADRs when they exist.

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

## Hybrid wrapper (when invoked by `/fork`)

When `/fork` calls this skill, it wraps the output with path-reference headers:

```markdown
<!-- /fork hybrid handoff — read referenced files for full depth -->
<!-- CONTEXT: CONTEXT.md -->
<!-- PRD: docs/prd/<slug>.md (if exists) -->

<handoff body>
```

The skill itself does not add these headers — `/fork` handles the wrapping in Step 8d.
