# write-skill Reference

Complete Claude Code skill feature surface for authored skills. See [SKILL.md](SKILL.md) for the workflow.

## Progressive Disclosure

Three loading levels — design skills around them:

| Level | When loaded | Budget | Content |
|-------|-------------|--------|---------|
| 1 — Metadata | Always at startup | ~100 tokens per skill; total capped at 1% of context or 8000 chars | YAML frontmatter `name` + `description` |
| 2 — Instructions | When skill triggered | Under ~5k tokens | SKILL.md body |
| 3 — Resources | As needed | Effectively unlimited | Bundled files (scripts, templates, examples, references) |

Push large material into Level 3. Keep Level 2 lean.

## Frontmatter — full surface

### Required

| Field | Constraint |
|-------|-----------|
| `name` | Lowercase + digits + hyphens, ≤64 chars. Cannot contain `anthropic` or `claude`. |
| `description` | What + "Use when [triggers]". ≤1024 chars. Front-load keywords — trimmed if total exceeds 8000 chars. |

### Optional

| Field | Purpose | Example |
|-------|---------|---------|
| `argument-hint` | Autocomplete in `/` menu | `"[filename] [format]"` |
| `disable-model-invocation` | `true` = user-only. Claude won't auto-invoke. Use for side-effect commands (`/commit`, `/deploy`, `/send-x`). | `true` |
| `user-invocable` | `false` = hidden from `/` menu, Claude-only. Use for background reference skills (style guides, conventions, persona context). | `false` |
| `allowed-tools` | Comma-separated tool allowlist; skips permission prompts | `Read, Grep, Glob, Bash(npm *)` |
| `model` | Per-skill model override | `opus`, `sonnet`, `haiku` |
| `effort` | Effort override | `low`, `medium`, `high`, `xhigh`, `max` |
| `context` | `fork` runs skill in isolated subagent context | `fork` |
| `agent` | Subagent type (with `context: fork`) | `Explore`, `Plan`, `general-purpose`, or custom |
| `shell` | Shell for `` \!`cmd` `` substitutions | `bash` (default), `powershell` |
| `hooks` | Skill-scoped lifecycle hooks (same format as global) | see below |
| `paths` | Glob patterns gating auto-activation | `"src/api/**/*.ts"` or YAML list |

### Invocation matrix

| Frontmatter | User can `/invoke` | Claude can auto-invoke |
|-------------|--------------------|------------------------|
| (default) | yes | yes |
| `disable-model-invocation: true` | yes | **no** |
| `user-invocable: false` | **no** | yes |

### Skill-scoped hooks

```yaml
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "${CLAUDE_SKILL_DIR}/scripts/validate.sh"
```

## Body features

### String substitutions

| Variable | Resolves to |
|----------|-------------|
| `$ARGUMENTS` | All args passed to the skill |
| `$0`, `$1`, `$N` / `$ARGUMENTS[N]` | Nth positional arg (0-based) |
| `${CLAUDE_SESSION_ID}` | Current session ID |
| `${CLAUDE_SKILL_DIR}` | Directory containing SKILL.md — use for bundled file refs |
| `${CLAUDE_EFFORT}` | Current effort level — branch on `[ "${CLAUDE_EFFORT}" = "max" ]` |

### Dynamic context injection

`` \!`command` `` runs at load time, output inlined before Claude sees it.

```md
## Repo state
- Branch: \!`git branch --show-current`
- PR diff: \!`gh pr diff`
- Changed files: \!`gh pr diff --name-only`
```

Default `bash`; switch with `shell: powershell` in frontmatter.

## Skill content types

**Reference** — background knowledge applied inline (conventions, persona, glossary). Often `user-invocable: false`.

**Task** — step-by-step actions with side effects. Often `disable-model-invocation: true` + `allowed-tools` restriction. May use `context: fork`.

## Bundled resources (Level 3)

```
skill-name/
├── SKILL.md           # required, Level 2
├── REFERENCE.md       # detailed docs (Level 3)
├── EXAMPLES.md        # usage examples (Level 3)
├── templates/
│   └── *.md
├── examples/
│   └── *.md
└── scripts/
    └── *.sh / *.py / *.js
```

Link from SKILL.md by relative path. Scripts invoked via Bash without loading their contents into context — token-cheap.

## Skill location precedence

| Type | Path | Scope |
|------|------|-------|
| Enterprise | Managed settings | All org users |
| Personal | `~/.claude/skills/<name>/SKILL.md` | Individual |
| Project | `./.claude/skills/<name>/SKILL.md` | Repo (via git) |
| Plugin | `<plugin>/skills/<name>/SKILL.md` | Where plugin enabled |

Conflicts resolve: **enterprise > personal > project**. Plugins use `plugin-name:skill-name` namespace — no conflict.

## Codex parity matrix

Codex CLI consumes only the open Agent Skills standard. Claude Code extensions are silently ignored by Codex projection.

| Field | Claude Code | Codex CLI |
|-------|-------------|-----------|
| `name` | ✅ | ✅ |
| `description` | ✅ | ✅ |
| SKILL.md body | ✅ | ✅ |
| `argument-hint` | ✅ | ❌ ignored |
| `disable-model-invocation` | ✅ | ❌ ignored |
| `user-invocable` | ✅ | ❌ ignored |
| `allowed-tools` | ✅ | ❌ ignored |
| `model` / `effort` | ✅ | ❌ ignored |
| `context: fork` + `agent` | ✅ | ❌ ignored |
| `shell` | ✅ | ❌ ignored |
| `hooks` | ✅ | ❌ ignored |
| `paths` | ✅ | ❌ ignored |
| `$ARGUMENTS` / `$N` | ✅ | partial — varies by Codex version |
| `${CLAUDE_*}` vars | ✅ | ❌ |
| `` \!`cmd` `` dynamic context | ✅ | ❌ |
| Bundled resources | ✅ | ✅ |

**Guidance:** keep core skill behavior runnable with just `name` + `description` + body + bundled resources. Treat Claude-only fields as progressive enhancement, not load-bearing.

## Setup Wizard interaction

- **Create / update in canonical** → `npm run sync` (default mode, overwrite, no fetch).
- **Rename in canonical** → `npm run setup -- --claude --codex --default --write prune --yes`. Prune removes stale projected copies of the old folder.
- **Dry run** to inspect projection before writing → add `--dry-run`.
- Skill Artifacts: add `--artifacts` to build `artifacts/<name>.zip` (off by default) for manual upload to Claude.ai / desktop.

## Verification

After authoring:

- `npm run setup -- --codex --default --dry-run` — confirm projection plan shows `.agents/skills/<name>/`.
- Open Claude Code, type `/<name>` — verify the skill appears with the right `argument-hint`.
- Sample invocation — confirm `$ARGUMENTS` parses as designed.
- For `disable-model-invocation: true` — confirm Claude does not auto-invoke when description matches loosely.
- For Codex parity — open `.codex/skills/<name>/SKILL.md` and confirm the body works without Claude-only fields.
