---
name: write-skill
description: Create, update, or rename agent skills in the Canonical Assistant Source (or directly at project/user scope), then run the Setup Wizard to install across all Assistant Targets. Detects existing skills to update or rename in place. Teaches authored skills to use the full Claude Code skill frontmatter surface (argument-hint, disable-model-invocation, user-invocable, allowed-tools, model, effort, context:fork, agent, shell, hooks, paths) while keeping Codex CLI parity. Use when the user wants to create a new skill, modify an existing skill, or rename a skill.
argument-hint: "[rename|project|local|user] <name> [change]"
disable-model-invocation: true
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
---

# Write Skill

Side-effectful: writes files in `canonical/` and may run the Setup Wizard. User-invoked only.

See [REFERENCE.md](REFERENCE.md) for the full Claude Code skill feature surface, Codex parity matrix, and frontmatter spec.

For the **craft** of the skill body — predictability, leading words, information hierarchy, completion criteria, and the failure modes (premature completion, sediment, sprawl, no-op) — consult the `writing-great-skills` skill. This skill covers the mechanics; that one covers whether the body is good.

## Invocation forms

Arguments are parsed positionally from the user's invocation. Works the same in both runtimes.

- `/write-skill <name>` → create new skill in canonical, then run Setup Wizard.
- `/write-skill <existing-name> <change…>` → update existing skill.
- `/write-skill rename <old> to <new>` → rename across canonical + Target Projections.
- `/write-skill project <name>` or `/write-skill local <name>` → scope to current project only. Skip canonical.
- `/write-skill user <name>` → scope to user Assistant Home only. Skip canonical.

## Detect intent

Parse the user's invocation arguments positionally (first token, second token, …). Works the same in both runtimes — do not rely on substitution syntax; read the user's literal message text after the skill name.

1. First token:
   - `rename` → rename mode; second token = old name, fourth token = new name (skip the literal `to`).
   - `project` / `local` / `user` → scope override; second token = skill name.
   - else → first token = skill name; remaining tokens = change description (update mode) or empty (create mode).
2. If name matches an existing skill in any search root → **update mode**; else → **create mode**.
3. Search roots (in order): `<TOOLKIT_PATH>/canonical/skills/`, `./.claude/skills/`, `./.agents/skills/`, `~/.claude/skills/`, `~/.agents/skills/`.

## Toolkit path (configurable)

1. `$TOOLKIT_PATH` env var
2. `~/Development/Software/Repositories/toolkit` (default)
3. Prompt user if neither exists

Canonical Assistant Source path = `<TOOLKIT_PATH>/canonical/skills/<name>/`.

## Target paths

| Scope | Claude Code | Codex CLI |
|-------|-------------|-----------|
| canonical (default) | `<TOOLKIT_PATH>/canonical/skills/<name>/` — Setup Wizard projects to both Assistant Homes | same |
| project / local | `./.claude/skills/<name>/` | `./.agents/skills/<name>/` |
| user | `~/.claude/skills/<name>/` | `~/.agents/skills/<name>/` |

For `project` and `user` scopes, write to **both** Assistant Target paths so the skill works on both runtimes. Codex CLI reads skills from `.agents/skills/` (Agent Skills open standard), not `.codex/skills/`.

## Process

### Create mode

1. Resolve scope + toolkit path.
2. Gather requirements:
   - Task/domain + trigger terms (front-load in description — Level 1 metadata budget = 1% of context or 8000 chars total across all skills).
   - **Skill type**: Reference (background knowledge, set `user-invocable: false`) vs Task (action, often set `disable-model-invocation: true` if side-effectful).
   - **Optional frontmatter to wire in** — ask which of these apply (see [REFERENCE.md](REFERENCE.md) for full details):
     - `argument-hint` — autocomplete in `/` menu
     - `disable-model-invocation: true` — user-only (deploy/commit/send-style side effects)
     - `user-invocable: false` — background-only (Claude-invoked reference)
     - `allowed-tools` — tool allowlist
     - `model` / `effort` — model + effort override
     - `context: fork` + `agent` — isolated subagent execution
     - `hooks` — skill-scoped lifecycle hooks
     - `paths` — glob-gated auto-activation
   - Bundled resources: scripts, templates, examples, references.
3. Draft `SKILL.md` per [SKILL.md template](#skillmd-template) below; split Level 3 resources into bundled files. Apply the craft principles in `writing-great-skills` — favour leading words, keep one source of truth, push reference down the hierarchy, and write checkable completion criteria.
4. Write to target path(s).
5. If canonical scope → run Setup Wizard from `$TOOLKIT_PATH`:
   ```bash
   cd "$TOOLKIT_PATH" && npm run sync
   ```

### Update mode

1. Locate existing `SKILL.md` (canonical wins; else project/user copy).
2. Read current content + frontmatter.
3. Apply requested change. Preserve `name:` slug. If adding side-effect behavior, propose `disable-model-invocation: true`.
4. Write back.
5. If canonical edited → `npm run sync` to re-project.

### Rename mode

1. Locate existing skill folder.
2. `git mv <old> <new>` (or `mv` if untracked).
3. Update `name:` in frontmatter to new slug. Slug rules: lowercase + digits + hyphens, ≤64 chars, cannot contain `anthropic` or `claude`.
4. Grep refs across `canonical/`, `.claude/`, `.codex/`, `manifests/`, and update.
5. If canonical → run Setup Wizard with **prune** to remove stale projected copies:
   ```bash
   cd "$TOOLKIT_PATH" && npm run setup -- --claude --codex --default --prune --yes
   ```
   (`npm run sync` uses overwrite, which leaves the stale `<old>/` directory behind.)

## SKILL.md template

Dual-target safe. Open-standard fields (`name`, `description`, body) carry the skill on both Claude Code and Codex CLI. Other frontmatter fields are Claude Code progressive enhancement and are silently ignored by Codex projection.

```md
---
name: skill-name                # lowercase+digits+hyphens, ≤64 chars; required on both
description: What it does. Use when [specific triggers].  # ≤1024 chars; required on both
argument-hint: "<arg>"          # Claude Code only — ignored by Codex
disable-model-invocation: true  # Claude Code only — if side-effectful
allowed-tools: Read, Edit, Bash # Claude Code only — if restricting
---

# Skill Name

## Quick start
[Minimal working example. Parse args from the user's invocation positionally — works in both runtimes. If using Claude-Code-only `$ARGUMENTS` / `${CLAUDE_SKILL_DIR}` / `` \!`cmd` `` substitutions, either keep a fallback path or accept the feature only fires on Claude Code.]

## Workflows
[Step-by-step with checklists]

## Advanced
See [REFERENCE.md](REFERENCE.md).
```

## Description rules

The description is the **only thing the agent sees** when matching skills. ≤1024 chars. Third person. First sentence = what. Second sentence = "Use when [triggers]". Front-load trigger keywords — descriptions are trimmed when total exceeds the 8000-char budget.

Good: `Extract text and tables from PDF files, fill forms, merge documents. Use when working with PDFs.`
Bad: `Helps with documents.`

## When to add scripts

- Deterministic operation (validation, formatting)
- Same code repeatedly generated
- Errors need explicit handling

## When to split files (Progressive Disclosure Level 3)

- SKILL.md body approaches ~5k tokens (Level 2 budget)
- Distinct domains
- Rarely-needed advanced features
- Reference material readers may never need

## Codex CLI parity warning

Several frontmatter fields are Claude-Code-specific and ignored by Codex projection: `model`, `effort`, `context`, `agent`, `hooks`, `paths`, `disable-model-invocation`, `user-invocable`, `argument-hint`. If the skill must behave identically on both Assistant Targets, keep the core logic working with just `name` + `description` + body, and treat the rest as Claude Code progressive enhancement. See [REFERENCE.md](REFERENCE.md#codex-parity-matrix).

## Review checklist

- [ ] `name` slug valid (lowercase+digits+hyphens, ≤64, no `anthropic`/`claude`)
- [ ] Description has triggers ("Use when…"), ≤1024 chars, front-loaded keywords
- [ ] SKILL.md body under ~5k tokens
- [ ] Optional frontmatter chosen deliberately (not omitted by default)
- [ ] Side-effectful skills set `disable-model-invocation: true`
- [ ] Background-knowledge skills set `user-invocable: false`
- [ ] Tool-restricted skills set `allowed-tools`
- [ ] Bundled resources referenced by relative path
- [ ] Body checked against `writing-great-skills` failure modes (no premature-completion, duplication, sediment, sprawl, no-op)
- [ ] Codex-only path tested with `name` + `description` + body alone
- [ ] Correct target paths written per scope
- [ ] Wizard ran: `npm run sync` (create/update) or `--prune` (rename)
- [ ] Rename: all references updated
