# Branch: instruction

The request is a universal conversational rule — it applies in every repository, in every session, regardless of which files are open. It becomes a section in `canonical/INSTRUCTIONS.md`.

This is the **most expensive** destination in the routing table. Everything in this file loads into every context window, every session, forever. That is why it has a budget and the other branches do not.

## First: is it really an instruction?

Three cheaper destinations sit next to this one. Check them before spending budget.

- **Tied to a file type or directory?** That is a `paths:`-gated rule — [authoring-rule.md](authoring-rule.md). Free.
- **A correction or a non-obvious learning?** That is auto-memory. Recalled on relevance, costs nothing standing.
- **Must fire 100% of the time, mechanically?** That is an instruction **and** a hook — see the belt-and-suspenders rule in [SKILL.md](SKILL.md) and [authoring-hook.md](authoring-hook.md).

Only a rule that is universal, conversational, and needed unprompted in every session earns a place here.

## The budget check — run it before writing

`canonical/INSTRUCTIONS.md` documents its own ceiling in an HTML comment at the top: a soft limit of about **120 lines**, past which a new rule must displace one the model now follows by default.

Count first:

    wc -l canonical/INSTRUCTIONS.md

Under the ceiling with room for the addition → write it and move on. At or over the ceiling, or the addition would cross it → run displacement.

## Displacement — propose, never pick

When the file is at or over its ceiling, adding a rule requires removing one. **Propose two or three displacement candidates and let the user choose.** Do not pick for them.

This is a taste decision about what the assistants should care about, which is the user's side of the Division of Responsibility. Silently evicting a rule they still want is the failure this gate exists to prevent.

Present each candidate with what it costs and what happens if it goes:

> `INSTRUCTIONS.md` is at 118 of ~120 lines, so this needs a displacement. Candidates:
>
> - **Voice dictation input** (6 lines) — relocate to `canonical/rules/common/`. Still loads, just not standing.
> - **Code style** (4 lines) — mostly duplicated by `common/coding-style.md`, which is already `@`-imported.
> - **Performance** (3 lines) — the model follows this by default now; safe to delete outright.
>
> Which goes?

### Prefer relocation over deletion

Rules under `canonical/rules/` have no line budget. So the default displacement is a **move, not a delete**: lift the section out of `INSTRUCTIONS.md` and into a file under `canonical/rules/`, gated by `paths:` when it is language- or file-specific.

Relocation preserves the guidance at zero standing cost. Deletion loses it permanently.

Delete outright only when the model **demonstrably** follows the rule by default now — meaning you can point at behavior, not merely assume it. When in doubt, relocate. It is the reversible option.

Note the asymmetry: relocating to a `paths:`-gated rule narrows *when* the guidance loads. If the rule genuinely needs to apply in every conversation, relocation to an always-on rule still costs an `@` import line in `INSTRUCTIONS.md` — a smaller cost than the full section, but not zero. Say which of the two you are proposing.

## House style for instruction edits

Recorded in the file's own maintenance comment, and it applies to rules and skills too:

- **Minimize tokens.** Every word ships in every context window.
- **State the positive action.** "Lead with the answer" beats "don't bury the answer."
- **One concept per bullet.** Bullets are how this file is read and retained.
- **Failure-derived beats speculative.** Add a rule *after* the mistake actually happened, not in anticipation of it.
- **Annotate hard-won rules with a `Case:` line** — one line naming the incident that produced it. It tells a future reader why the rule is worth its lines.

## Create

1. Run the budget check. Displace first if needed, with the user's pick.
2. Write the section. Match the surrounding shape — an `## H2` heading, then bullets. Put it where it belongs topically, not at the end.
3. Re-count: `wc -l canonical/INSTRUCTIONS.md`. Confirm you are under the ceiling.
4. Install with `npm run sync`.

## Update

Read the section first. Edit in place. Tightening an existing rule is always cheaper than adding a new one — check whether the request is really an amendment to something already there before opening a new section.

## Remove

Removing an instruction needs no displacement gate — it frees budget rather than spending it. Still confirm once, because a removed instruction stops applying everywhere immediately. Then `npm run sync`; instructions are file content rather than a separate installed artifact, so no prune is needed.

## Codex parity

`canonical/INSTRUCTIONS.md` installs as `~/.claude/CLAUDE.md` for Claude Code and projects to `~/.codex/AGENTS.md` for Codex CLI, with `@` import paths rewritten for the target. Write Claude paths; the projection handles the rest.
