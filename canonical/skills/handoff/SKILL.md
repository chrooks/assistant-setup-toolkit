---
name: handoff
description: Create a copyable markdown handoff or continuation prompt for the next Claude Code session. Use when work spans multiple sessions, when the user asks for a handoff or session summary, or when the next conversation needs the current plan, constraints, verification baseline, and next concrete step preserved.
argument-hint: "[optional next step or scope to carry forward]"
disable-model-invocation: false
---

<what-to-do>

Package the current session into one immediately usable markdown block for the next session. Read `LEXICON.md` for domain vocabulary and `docs/adr/` for existing decisions — use the project's terminology in the handoff body.

If the user supplied `$ARGUMENTS`, use that as the requested next step or scope hint. Otherwise, infer the next concrete step from the active plan and latest user direction.

Return exactly one fenced markdown code block. Use the format in [HANDOFF-FORMAT.md](./HANDOFF-FORMAT.md). Add no extra commentary unless a one-sentence lead-in is genuinely helpful.

</what-to-do>

<supporting-info>

## Domain awareness

During handoff composition, look for existing documentation:

### File structure

```
/
├── LEXICON.md
└── docs/
    ├── adr/
    └── prd/
```

Read `LEXICON.md` for domain vocabulary — use the project's canonical terms in the handoff, not synonyms. Reference ADRs and PRDs by path when they're relevant to the next session's work.

### Path conventions

Default output is the copyable markdown block only — do NOT write a handoff file unless one is actually needed (the next session starts cold on another machine, or the user asks for a file). When a file is warranted, write it to `<harness-config-dir>/handoffs/<YYYY-MM-DD>-<slug>.md` in the project — `.claude/handoffs/` on Claude Code, `.codex/handoffs/` on Codex.

## Current context

Branch:
!`git rev-parse --is-inside-work-tree >/dev/null 2>&1 && git branch --show-current || echo "(not a git repo)"`

Changed files:
!`git rev-parse --is-inside-work-tree >/dev/null 2>&1 && git status --short || echo "(not a git repo)"`

## Process

1. Identify the source of truth for the work.
   - Prefer an active plan file and matching questions file, usually under the work's `.tasks/<issue#>-<slug>/` folder.
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
   - Keep the next step narrow enough that the next session can start immediately without drifting into later phases if needed.

6. Add a verification baseline.
   - List the focused tests that should remain green before and after the next step.
   - Use the repo-local `.venv` interpreter when that is the established environment.

## Guardrails

- Prefer the user's own wording for goals and constraints when available.
- Do not speculate about work that was not implemented or verified.
- Do not silently drop constraints from an earlier handoff that still apply.
- Use repo-relative paths in the handoff body unless the user explicitly asks for absolute paths.
- When referring to specific files or lines of code, [include a link to the file](some/path/to/file):<line number start>-<line number end>.
- Do not include internal chain-of-thought or speculation.
- Emit the stop gate in all three places the format calls for — the block under the title, the "do not start these" steps heading, and the closing reminder. The next session ignores the handoff's boundary when only the closing line survives.
- Ask a concise follow-up only when the source-of-truth file, the exact next step, or the authority of a prior handoff cannot be inferred safely.

</supporting-info>
