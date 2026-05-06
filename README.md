# Assistant Setup Toolkit

A portable collection of instructions, skills, hooks, manifests, and installers that configures coding assistants consistently across machines. Clone this repo on any machine and run the Setup Wizard to install for Claude Code, Codex CLI, or both.

## Quick Install

```bash
npm install
npm run setup -- --claude --codex --default
```

Preview what would happen without writing files:

```bash
npm run setup -- --claude --codex --default --dry-run
```

Or install for a single target:

```bash
npm run setup -- --claude --default
npm run setup -- --codex --default
```

## Setup Wizard

The Setup Wizard (`npm run setup`) is the recommended way to install the toolkit. It supports interactive and flag-driven setup.

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
| `--no-fetch` | Skip External Source fetching |
| `--yes` | Skip confirmation prompts |

### Write Behaviors

- **Safe Merge** (default): Copies missing files, skips existing conflicts. Never deletes unrelated files.
- **Overwrite Install** (`--overwrite`): Replaces conflicting selected payload files. Does not delete unrelated files.
- **Prune Install** (`--prune`): Installs the payload and removes toolkit-owned files from previous installs that are no longer selected. Only removes files tracked in an Install Receipt.

All non-dry-run writes create a timestamped backup before modifying an Assistant Home.

### Install Receipts

After a successful install, the wizard writes an Install Receipt at `<assistant-home>/.assistant-setup-toolkit/receipt.json`. This records which files were installed, enabling safe Prune Install later.

### Next Steps

After setup, the wizard prints Next Steps for actions it cannot automate:
- Manual desktop skill upload (Skill Artifacts in `artifacts/*.zip`)
- MCP Server configuration requiring secrets or confirmation

## Structure

```
.claude/              # Canonical Assistant Source — edit here
  CLAUDE.md           # Global instructions
  PLAN.md             # ExecPlan template
  skills/             # Skill directories (SKILL.md each)
  commands/           # Claude Code commands
  hooks/              # Session hooks
manifests/
  install.yaml        # Installation Manifest — External Sources
scripts/
  setup.ts            # Setup Wizard entry point
  install.sh          # Legacy shell installer
  install.ps1         # Legacy PowerShell installer
  create-codex-dir.sh # Legacy Codex projection script
src/setup/            # Setup Wizard modules
tests/setup/          # Test suite
```

### Canonical Assistant Source

`.claude/` is the single source of truth. Codex CLI files (`.codex/`, `.agents/`) are Target Projections regenerated from `.claude/` before Codex installs. Edit `.claude/` — never edit Target Projections directly.

### Installation Manifest

`manifests/install.yaml` lists External Sources the wizard can fetch: skills, plugins, and MCP servers. During a Default Install, external sources are prepared first, then local Toolkit Components from `.claude/` are applied last so local skills win conflicts.

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
| `knowledge-sync.sh` | Auto-sync knowledge files to Obsidian vault on write |

## Development

```bash
npm install
npm run typecheck    # TypeScript check
npm test             # Run all tests
npm test -- domain   # Run specific test file
```

See `CONTEXT.md` for the domain glossary and `feature_requests/installation-wizard-plan.md` for the ExecPlan.
