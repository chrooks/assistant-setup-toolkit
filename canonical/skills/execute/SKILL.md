---
name: execute
description: Execute ready work by choosing and running the right Skill workflow from user-level assistant instructions.
argument-hint: "<ready task or selected /scope option>"
disable-model-invocation: true
---

# Execute

Use this Skill when the user chooses `/execute`, says to "just do it", or
selects the ready-to-work option from `/scope`.

## Purpose

Turn a ready request into the right concrete workflow. Do not treat `/execute`
as a replacement for the other Skills. Treat it as a short routing step that
reads the user-level `## Right Skill, Right Job` section, chooses the matching
Skill workflow, and then starts that workflow.

## Process

1. Read the user-level assistant instructions:
   - Read `~/.claude/CLAUDE.md` when running in Claude Code.
2. Invoke the `## Right Skill, Right Job` section from that file.
3. Choose the matching workflow:
   - Use `/impeccable` for design/frontend work.
   - Use `/tdd` when implementing a feature, especially testable logic.
   - Use `/verification-loop` after implementing a feature.
   - Use `/commit` when it is time to commit work to version control.
   - Use `/diagnose` for difficult bugs.
   - If no other Skill has been invoked for the request, use `/find-skill` to
     choose the best, most relevant Skill before starting.
4. State the selected workflow in one short sentence.
5. Start the selected workflow immediately unless it requires a user decision
   point.

## Rules

- Do not ask the user to choose again when the request is already ready to do.
- Do not skip verification after implementation.
- Do not commit until the work compiles and the relevant tests pass.
- Keep `/execute` thin; put detailed behavior in the concrete Skill that owns
  the work.
