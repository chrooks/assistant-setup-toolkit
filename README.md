# Assistant Setup Toolkit

A portable collection of instructions, skills, hooks, manifests, and installers that configures coding assistants consistently across machines. Clone this repo on any machine and run the **Setup Wizard** to install for Claude Code, Codex CLI, or both.

## Quick Start

```bash
npm install
npm run setup
```

That's it. The Setup Wizard walks you through every choice interactively and is the recommended path for almost everyone.

### What the wizard asks

1. **Assistant Targets** — Claude Code, Codex CLI, or both.
2. **Setup mode** — Default Install (everything) or Custom Install (pick components).
3. **External Sources** — checkbox list of skills and plugins from `manifests/install.yaml` (find-skills, impeccable, caveman, etc.). Leave empty to skip them all.
4. **Write behavior** — Safe Merge, Overwrite, or Prune (see below).
5. **Dry-run?** — preview planned writes without touching the filesystem.
6. **Confirm summary** — review and proceed.

External Sources are cloned with `git clone --depth 1` into a per-run temp dir, mapped into your Assistant Home, then cleaned up. Local content from `canonical/` always wins conflicts.

### Write Behaviors

- **Safe Merge** (default): Copies missing files, skips existing conflicts. Never deletes unrelated files.
- **Overwrite Install**: Replaces conflicting selected payload files. Does not delete unrelated files.
- **Prune Install**: Installs the payload and removes toolkit-owned files from previous installs that are no longer selected. Only removes files tracked in an Install Receipt.

All non-dry-run writes create a timestamped backup before modifying an Assistant Home.

### After install

The wizard prints **Next Steps** for actions it cannot automate:
- Manual desktop skill upload (Skill Artifacts in `artifacts/*.zip`)
- MCP Server configuration requiring secrets or confirmation

It also writes an **Install Receipt** at `<assistant-home>/.assistant-setup-toolkit/receipt.json` listing every installed file — needed later for safe Prune Install.

## Non-interactive / scripted install

For CI, dotfiles repos, or anyone who wants to skip the prompts, every wizard choice has an equivalent flag:

```bash
# Both targets, all components, defaults
npm run setup -- --claude --codex --default

# Single target, dry-run preview
npm run setup -- --claude --default --dry-run

# Pick specific External Sources only
npm run setup -- --claude --default --sources find-skills,impeccable

# Skip all External Sources
npm run setup -- --claude --default --no-sources
```

### Flags

| Flag | Description |
|------|-------------|
| `--claude` | Select Claude Code as an Assistant Target |
| `--codex` | Select Codex CLI as an Assistant Target |
| `--default` | Default Install — all Toolkit Components, Safe Merge |
| `--custom` | Custom Install — choose components interactively |
| `--dry-run` | Preview planned writes without changing anything |
| `--overwrite` | Overwrite Install — replace conflicting payload files |
| `--prune` | Prune Install — remove stale toolkit-owned files |
| `--symlink` | Use symlinks where supported |
| `--sources <ids>` | Comma-separated External Source IDs to install |
| `--no-sources` | Skip all External Sources |
| `--no-fetch` | Skip External Source fetching entirely |
| `--yes` | Skip confirmation prompts |

## Iteration Loop (resync after edits)

When you edit a skill, hook, or instruction in the **Canonical Assistant Source** (`canonical/`), both **Assistant Homes** (`~/.claude/`, `~/.codex/`) need the update. Two helpers automate this:

```bash
# One-shot: push canonical/ to both Assistant Homes
npm run sync

# Watcher: auto-resync on every save
npm run sync:watch
```

Both expand to a non-interactive Setup Wizard run with `--claude --codex --default --no-fetch --yes`. `--no-fetch` skips External Source git clones since edits are local; `--yes` skips confirmation prompts. Skill Artifact ZIPs in `artifacts/` are rebuilt each run.

`sync:watch` uses `chokidar-cli` against `canonical/**` and `manifests/**`. Run it in a background terminal during iteration; edits to `canonical/skills/wym/SKILL.md` (or any tracked file) trigger an immediate resync.

## Project Flow Workflow

See [docs/project-flow-how-to.md](docs/project-flow-how-to.md) for the `/project-flow-setup` workflow and the daily loop across `/scope`, `/to-issues`, `/roadmap`, `/implement`, `/verification-loop`, and `/prep-pr`.

## Structure

```
canonical/            # Canonical Assistant Source — distributable content
  CLAUDE.md           # Global instructions (installed to ~/.claude/CLAUDE.md)
  PLAN.md             # ExecPlan template
  skills/             # Distributable skill directories (SKILL.md each)
  commands/           # Claude Code commands
  hooks/              # Session hooks
.claude/              # Repo-local Claude Code config
  skills/             # Project-scoped skills (e.g., /ingest-skill)
  rules/              # Claude Code rules
manifests/
  install.yaml        # Installation Manifest — External Sources
scripts/
  setup.ts            # Setup Wizard entry point
  get-skills.sh       # Skill packaging helper
src/setup/            # Setup Wizard modules
tests/setup/          # Test suite
```

### Canonical Assistant Source

`canonical/` is the single source of truth for distributable content. Codex CLI files (`.codex/`, `.agents/`) are Target Projections regenerated from `canonical/` before Codex installs. Edit `canonical/` for distributable content — never edit Target Projections directly. `.claude/` is reserved for repo-local Claude Code project config (project-scoped skills, rules).

### Installation Manifest

`manifests/install.yaml` lists External Sources the wizard can fetch: skills, plugins, and MCP servers. During a Default Install, external sources are prepared first, then local Toolkit Components from `canonical/` are applied last so local skills win conflicts.

## Skills

| Skill | Description |
|-------|-------------|
| `/commit` | Stage and commit with a conventional commit message |
| `/feature <description>` | Full-cycle feature development: discovery, plan, TDD, review, commit |
| `/mode <socratic\|annotator\|standard>` | Switch learning mode for the session |
| `/handoff` | Generate a continuation prompt for the next session |

## Hooks

| Hook | Purpose |
|------|---------|
| `session-mode-loader.sh` | Restore persisted learning mode on session start |
| `session-mode-cleanup.sh` | Clear non-persisted mode on session end |
| `lexicon-reminder.sh` | Claude Code `UserPromptSubmit` hook: re-injects a Lexicon-enforcement reminder every turn (see `canonical/CLAUDE.md` Lexicon Usage). Codex CLI is intentionally not wired because it displays `additionalContext` in the transcript. Disable per session with `CLAUDE_LEXICON_REMINDER=0` or globally with `touch ~/.claude/.lexicon-reminder.off`. Wired automatically via `canonical/hooks/wiring.yaml`. |
| `canonical-sync.sh` | Project-level PostToolUse hook: when `canonical/` changes, runs the Setup Wizard quietly so Assistant Homes and Target Projections stay synced. Disable per session with `CANONICAL_SYNC=0` or per project with `touch .canonical-sync.off`. |

### Hook Wiring

`canonical/hooks/wiring.yaml` is a declarative manifest that tells the Setup Wizard which hook scripts to register against which lifecycle event in each Assistant Target's settings file. During `npm run setup`, after files are copied, the wizard:

- Loads `wiring.yaml` (returns silently if absent — wiring is opt-in).
- For each entry, idempotently merges a hook command into the right config file: `~/.claude/settings.json` for Claude Code, `~/.codex/hooks.json` for Codex CLI.
- For Codex CLI, also asserts `[features] hooks = true` in `~/.codex/config.toml` (Codex hooks are controlled by that flag).
- For entries with `scope: project`, writes project config instead: `.claude/settings.json`, `.codex/hooks.json`, and `.codex/config.toml`.

Idempotency is keyed on the rendered command string. Re-running the wizard never produces duplicate entries, and a hook wired manually before this manifest existed won't be re-added.

To add a new hook: drop the script in `canonical/hooks/`, add an entry to `wiring.yaml` (declare `file`, `event`, and `targets`), and re-run `npm run setup`.

## Development

```bash
npm install
npm run typecheck    # TypeScript check
npm test             # Run all tests
npm test -- domain   # Run specific test file
```

See `CONTEXT.md` for the project Lexicon and `feature_requests/installation-wizard-plan.md` for the ExecPlan.
