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
| `knowledge-sync.sh` | Auto-sync knowledge files to Obsidian vault on write |

## Development

```bash
npm install
npm run typecheck    # TypeScript check
npm test             # Run all tests
npm test -- domain   # Run specific test file
```

See `CONTEXT.md` for the domain glossary and `feature_requests/installation-wizard-plan.md` for the ExecPlan.
