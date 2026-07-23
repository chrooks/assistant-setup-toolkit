---
name: implement
description: Implement ready work by choosing the right Skill workflow, then verify, review fan-out, fix forward with TDD, and commit. As the DevOS implement stage, runs as a Context-Encapsulated sub-agent at the Throughline's tier and returns a structured result. Use when the user chooses /implement, says "just do it", selects the ready-to-work option from /scope, or as the DevOS implement stage.
argument-hint: "<ready task or selected /scope option>"
disable-model-invocation: false
---

# Implement

Use this Skill when the user chooses `/implement`, says to "just do it", or
selects the ready-to-work option from `/scope`.

## Purpose

Turn a ready request into the right concrete workflow, then carry the work
through verification, review, fix-forward, and commit. Do not treat
`/implement` as a replacement for the other Skills. Treat it as a short routing
step that reads the user-level `## Right Skill, Right Job` section, chooses the
matching Skill workflow, and then starts that workflow.

## Process

1. Read the user-level assistant instructions:
   - Read `~/.claude/CLAUDE.md` when running in Claude Code.
   - Read `~/.codex/AGENTS.md` when running in Codex.
2. Invoke the `## Right Skill, Right Job` section from that file.
3. Choose the matching workflow:
   - Use `/impeccable` for design/frontend work. When you route here, keep the
     design brief (the UI intent you handed to `/impeccable`) so you can forward
     it downstream in step 7.
   - Use `/idea-to-design` for synthesizing ideas into concrete designs.
   - Use `/tdd` when implementing a feature, especially testable logic.
   - Use `/diagnose` for difficult bugs.
   - If no other Skill has been invoked for the request, use `/find-skill` to
     choose the best, most relevant Skill before starting.
4. State the selected workflow in one short sentence.
5. Start the selected workflow immediately unless it requires a user decision
   point.
6. **Stage 1 — spec compliance.** Before any quality review, check the
   completed work against the plan and acceptance criteria: did it build the
   *right thing*? A Stage 1 miss loops straight back to the worker Skill in
   step 3 — do not spend quality review on the wrong thing.
7. **Stage 2 — quality.** Next run `/verification-loop` against the completed
   change set, then run `/review-fanout` against the same diff scope
   and include the verification evidence. When the change touched the UI — or you
   routed to `/impeccable` in step 3 — forward the design brief so `/review-fanout`
   runs its design critique path.
8. If `/verification-loop` or `/review-fanout` finds actionable issues, fix them
   forward by concern shape: use `/tdd` for testable logic (add or update tests
   first), `/diagnose` for a bug or failing check, and `/impeccable` (a refine
   command) for a design concern from the design critique. Then rerun
   `/verification-loop` and `/review-fanout` for the repaired diff.
9. Use `/commit` only after verification and review fan-out are ready, or after
   the user explicitly accepts documented residual risk.

## DevOS: the implement stage

When the DevOS Conductor dispatches the implement stage, this Skill is meant to
run under **Context Encapsulation** — inside a sub-agent with its own context
window — so the main conversation receives only a small structured result, not
all the intermediate code. The Conductor dispatches it at the **Effort Tier**
recorded in the Throughline (`tier` + `effort`): `heavy → opus`, `light →
sonnet`, with **Sonnet 5 as the floor** — never below it. Effort
honesty: on Codex, `effort` is a real
runtime knob the Conductor sets on the dispatch; on Claude Code, which has no
per-sub-agent effort, the Conductor folds `effort` into the sub-agent prompt as
guidance. The sub-agent inherits the model strength either way.

Inside the sub-agent:

- Read the Throughline's `acceptance_criteria` so the work targets exactly what
  the prove stage will check. On a **re-entry after an assess bounce**, only the
  reopened criteria carry `status: pending` (the rest are already `pass`) — work
  only the `pending` ACs, and flag any passed AC your fix might have touched so
  prove re-checks it too.
- Detect bug-fix versus feature and route to the matching worker Skill as above.
- Do the work and the local checks.
- Review in two stages before returning: **spec compliance** against the
  `acceptance_criteria` first ("right thing"), quality second ("built well").
  Fix a spec miss before producing the result JSON — a wrong-thing result wastes
  a full Conductor round-trip.

Return the result as a single fenced JSON block — and nothing else outside it —
with at least these fields, which the Conductor (the sole writer of the
Throughline) writes back and uses to advance the run:

    ```json
    {
      "files_changed": ["path", ...],
      "tests": "what ran and the outcome",
      "artifacts": "evidence worth keeping",
      "ac_status": {"ac1": "pass", ...},
      "suggested_next_action": "/dev prove <issue>"
    }
    ```

- `files_changed` — paths touched.
- `tests` — tests added or run, and their outcome.
- `artifacts` — anything produced worth keeping (logs, screenshots). When the
  change touched the UI, include the design critique outcome here (detector
  verdict and any design concerns) so the Conductor can log it.
- `ac_status` — per acceptance criterion, a first-pass status.
- `suggested_next_action` — normally the prove stage (`/dev prove <issue>`).

The Conductor — not this Skill — edits the Throughline frontmatter and advances
the stage. Parallel implementations naturally coalesce at the prove stage.

## Rules

- Do not ask the user to choose again when the request is already ready to do.
- Do not skip verification after implementation.
- Do not skip review fan-out before committing.
- Do not commit until the work compiles, the relevant tests pass, and
  actionable review concerns are fixed or documented.
- Keep `/implement` thin; put detailed behavior in the concrete Skill that owns
  the work.
