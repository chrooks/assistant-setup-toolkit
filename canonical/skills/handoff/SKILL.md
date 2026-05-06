---
name: handoff
description: Create a copyable markdown handoff or continuation prompt for the next Claude Code session. Use when work spans multiple sessions, when the user asks for a handoff or session summary, or when the next conversation needs the current plan, constraints, verification baseline, and next concrete step preserved.
argument-hint: "[optional next step or scope to carry forward]"
disable-model-invocation: true
---

# Handoff Workflow

Use this workflow to package the current session into one immediately usable markdown block for the next session.

## Current Context

Branch:
!`git branch --show-current`

Changed files:
!`git status --short`

## Instructions

1. Identify the source of truth for the work.
   - Prefer an active plan file and matching questions file, usually under `feature_requests/`.
   - Treat the plan and questions files as authoritative for scope, completed work, pending work, acceptance criteria, and constraints.

2. Detect whether this session already started from an earlier handoff.
   - Look for a structured user message with sections like `Context`, `Current Implementation Status`, `Important Working Instructions`, `Next 3 Steps`, `Expectations for this Conversation`, or `Verification Baseline`.
   - Carry forward prior working instructions unless the current session explicitly replaced them.

3. Reconstruct the current implementation state conservatively.
   - Read the active plan, inspect the changed files, and summarize only work that is complete.
   - Mention created or updated files only when they belong to completed scope.
   - Mention tests only when they actually passed in this or a clearly referenced prior session.

4. Capture the instructions that must survive into the next session.
   - Include user instructions from the current session.
   - Include durable repo-level instructions that affect the next step.
   - Keep the list concise and actionable.

5. Define the next step narrowly.
   - If the user supplied `$ARGUMENTS`, use that as the requested next step or scope hint.
   - Otherwise, infer the next concrete step from the active plan and the latest user direction.
   - Keep the next step narrow enough that the next session can start immediately without drifting into later phases if needed.

6. Add a verification baseline.
   - List the focused tests that should remain green before and after the next step.
   - Use the repo-local `.venv` interpreter when that is the established environment.

7. Compose a title line.
   - Format: `# <couple-word summary of previous convo> -> <next step> Handoff`.
   - Keep the summary to ~2-5 words and the next step short and concrete.

8. Return exactly one fenced markdown code block when the user directly asked for a handoff.
   - Start with the `#` title line, then the `##` sections below.
   - Capitalize each section title (Title Case) and prepend `##`.
   - Add no extra commentary unless a one-sentence lead-in is genuinely helpful.

## Output Template

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
Acknowledge the receipt of thsi handoff, explore the repo for relevant context, propose a direction, and wait for further instruction.
If the next step sounds like a non-trivial feature request, recommend the use of the `feature` skill.
````

## Guardrails

- Prefer the user's own wording for goals and constraints when available.
- Do not speculate about work that was not implemented or verified.
- Do not silently drop constraints from an earlier handoff that still apply.
- Use repo-relative paths in the handoff body unless the user explicitly asks for absolute paths.
- When referring to specific files or lines of code. [include a link to the file](some/path/to/file):<line number start>-<line number end>
- Do not include internal chain-of-thought or speculation.
- Ask a concise follow-up only when the source-of-truth file, the exact next step, or the authority of a prior handoff cannot be inferred safely.
