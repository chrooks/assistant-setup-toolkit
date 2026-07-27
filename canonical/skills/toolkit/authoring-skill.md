# Branch: Skill

The request is a repeatable multi-step workflow. It becomes a Skill.

For the **craft** of the body — predictability, leading words, information hierarchy, completion criteria, and the failure modes (premature completion, duplication, sediment, sprawl, no-op, negation) — consult the `writing-great-skills` Skill. This file covers the mechanics; that one covers whether the body is good.

For the full Claude Code frontmatter surface and the Codex parity matrix, see [REFERENCE.md](REFERENCE.md).

## Destinations by scope

Scope is stated by the user, never inferred from the current machine.

| Scope | Claude Code | Codex CLI |
|---|---|---|
| **canonical** (default) | `canonical/skills/<name>/` — the wizard projects to both Assistant Homes | same |
| **project** | `./.claude/skills/<name>/` | `./.agents/skills/<name>/` |
| **machine `<name>`** | `canonical/machines/<name>/skills/<skill>/` — the wizard installs it only where the `machine` Variant matches, with the prefix stripped | same |

For **project** scope, write to **both** target paths so the Skill works on both runtimes. Codex CLI reads skills from `.agents/skills/`, not `.codex/skills/`.

For **machine** scope, `canonical/machines/<name>/skills/<skill>/` is the whole mechanism — `src/setup/payload.ts` matches that path, gates on the run's resolved `machine` Variant, and installs at `skills/<skill>/` with the prefix removed. Nothing else needs configuring. Check which machine names exist under `canonical/machines/` before writing to a new one.

The motivating case: a Skill that searches Active Directory belongs to `canonical/machines/work/skills/`, not to every machine.

## Create

1. Confirm the scope and resolve the destination from the table above.
2. Gather requirements:
   - Task or domain, plus the trigger terms. Front-load them in the description — the Level 1 metadata budget is about 1% of context, or 8000 characters across every installed Skill.
   - **Skill type.** Reference (background knowledge → `user-invocable: false`) or Task (an action → often `disable-model-invocation: true` when side-effectful).
   - **Optional frontmatter**, chosen deliberately rather than omitted by default. Ask which apply: `argument-hint`, `disable-model-invocation`, `user-invocable`, `allowed-tools`, `model`, `effort`, `context: fork` + `agent`, `hooks`, `paths`. [REFERENCE.md](REFERENCE.md) has the full detail on each.
   - Bundled resources: scripts, templates, examples, references.
3. Draft `SKILL.md` from the template below. Split Level 3 material into bundled files.
4. Write to the destination path or paths.
5. Install — `npm run sync` from the toolkit root for canonical and machine scope. Project scope needs no wizard run.

## Update

1. Locate the existing `SKILL.md`. Search order: `canonical/skills/`, `canonical/machines/*/skills/`, `./.claude/skills/`, `./.agents/skills/`, `~/.claude/skills/`, `~/.agents/skills/`. Canonical wins.
2. Read the current content and frontmatter before changing anything.
3. Apply the change. Preserve the `name:` slug. If the change adds side-effectful behavior, propose `disable-model-invocation: true`.
4. Write back, then `npm run sync` if canonical was edited.

## Rename

1. `git mv canonical/skills/<old> canonical/skills/<new>` — or plain `mv` if untracked.
2. Update `name:` in the frontmatter. Slug rules: lowercase, digits, and hyphens only; at most 64 characters; cannot contain `anthropic` or `claude`.
3. Grep for references across `canonical/`, `.claude/`, `.codex/`, and `manifests/`, and update each.
4. Install with **prune**, because `sync` uses overwrite and leaves the stale `<old>/` directory behind in each Assistant Home:

       npm run setup -- --claude --codex --default --write prune --yes

## Remove

Same prune command. Confirm the blast radius once before deleting, per the router's `remove` verb.

## SKILL.md template

Dual-target safe. The open-standard fields — `name`, `description`, and the body — carry the Skill on both Claude Code and Codex CLI. Everything else is Claude Code progressive enhancement, silently dropped by Codex projection.

    ---
    name: skill-name
    description: What it does. Use when [specific triggers].
    argument-hint: "<arg>"
    disable-model-invocation: true
    allowed-tools: Read, Edit, Bash
    ---

    # Skill Name

    ## Quick start
    Minimal working example. Parse arguments positionally from the user's
    invocation — that works in both runtimes.

    ## Workflows
    Step-by-step, with checklists.

    ## Advanced
    See REFERENCE.md.

## Description rules

The description is the **only thing the model sees** when matching Skills. At most 1024 characters. Third person. First sentence says what it does; second says "Use when [triggers]". Front-load the trigger keywords — descriptions get trimmed when the total exceeds the 8000-character budget.

Good: `Extract text and tables from PDF files, fill forms, merge documents. Use when working with PDFs.`

Bad: `Helps with documents.`

## When to bundle a script

- The operation is deterministic — validation, formatting, a fixed transform.
- The same code would otherwise be regenerated every run.
- Errors need explicit handling.

## When to split into a bundled file

- The `SKILL.md` body approaches roughly 5k tokens, the Level 2 budget.
- The material covers a distinct domain.
- It is an advanced feature most runs never reach.
- It is reference material the reader may never need.

## Codex parity warning

`model`, `effort`, `context`, `agent`, `hooks`, `paths`, `disable-model-invocation`, `user-invocable`, and `argument-hint` are Claude-Code-specific and ignored by Codex projection. If the Skill must behave identically on both targets, keep the core logic working with `name` + `description` + body alone and treat the rest as enhancement. See [REFERENCE.md](REFERENCE.md#codex-parity-matrix).

## Review checklist

- [ ] `name` slug valid — lowercase, digits, hyphens, ≤64 chars, no `anthropic` or `claude`
- [ ] Description has "Use when…" triggers, ≤1024 chars, keywords front-loaded
- [ ] Body under roughly 5k tokens
- [ ] Optional frontmatter chosen deliberately, not omitted by default
- [ ] Side-effectful Skills set `disable-model-invocation: true` unless there is a recorded reason not to
- [ ] Background-knowledge Skills set `user-invocable: false`
- [ ] Tool-restricted Skills set `allowed-tools`
- [ ] Bundled resources referenced by relative path
- [ ] Body checked against the `writing-great-skills` failure modes
- [ ] Codex-only path works with `name` + `description` + body alone
- [ ] Correct destination written for the stated scope
- [ ] Wizard ran — `npm run sync` for create and update, `--write prune` for rename and remove
