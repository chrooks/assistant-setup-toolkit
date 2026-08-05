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
Run `npm run setup -- --help` for this table at the terminal. Unknown flags are a hard error, so a typo tells you rather than silently dropping into prompts.

| Flag | Description |
|------|-------------|
| `--claude` | Select Claude Code as an Assistant Target |
| `--codex` | Select Codex CLI as an Assistant Target |
| `--default` | Default Install — all Toolkit Components, Safe Merge |
| `--custom` | Custom Install — choose components interactively |
| `--write <behavior>` | `safe-merge` (default), `overwrite`, or `prune` |
| `--dry-run` | Preview planned writes without changing anything |
| `--symlink` | Use symlinks where supported |
| `--sources <ids>` | Comma-separated External Source IDs to install |
| `--no-sources` | Skip all External Sources |
| `--no-fetch` | Skip External Source fetching entirely |
| `--preset <name>` | Apply a Preset from `manifests/presets.yaml` |
| `--visual-plans <v>` | `local-files`, `self-hosted`, or `none` |
| `--artifacts` | Build Skill Artifact ZIPs (off by default — see below) |
| `--yes` | Skip confirmation prompts |
| `--quiet` | Print errors only |
| `--help` | Show the flag reference |

### Run output

The console shows a per-step summary; the full narration goes to a run log under `.setup/logs/`, linked in the footer. The 10 newest logs are kept.

```
Setup Wizard — dry-run · Default Install · Safe Merge · preset server
Targets: Claude Code -> ~/.claude
Preset: server (from Install Receipt)
    variants.visual-plans = self-hosted — visual-plan/visual-recap via the Plan MCP
    variants.machine = server — installs rules/machine.md from canonical/machines/server/rules.md

  Sources    0 to fetch, 8 skipped, 2 manual (MCP)
  Writes     0 would write, 163 would skip, 0 would remove
  Hooks      0 would add, 10 already present
  Artifacts  skipped (pass --artifacts to build ZIPs)
  Verify     5/5 checks passed
```

When a Preset is active, the run names it, says whether it came from `--preset` or the machine's Install Receipt, and lists what it changed — each Variant with its actual consequence, not just its value. A field a CLI flag overrode is marked `[overridden by flag]`.

### Skill Artifacts are opt-in

`--artifacts` builds one ZIP per skill under `artifacts/` for manual upload to desktop or web assistants. It is **off by default**: an ordinary install writes straight into an Assistant Home and never uploads a ZIP anywhere, so building ~50 archives every run was pure cost. ZIPs are written with JSZip, so no platform `zip` binary is required.

## Iteration Loop (resync after edits)

When you edit a skill, hook, or instruction in the **Canonical Assistant Source** (`canonical/`), both **Assistant Homes** (`~/.claude/`, `~/.codex/`) need the update. Two helpers automate this:

```bash
# One-shot: push canonical/ to both Assistant Homes
npm run sync

# Watcher: auto-resync on every save
npm run sync:watch
```

Both expand to a non-interactive Setup Wizard run with `--claude --codex --default --write overwrite --no-fetch --yes`. `--no-fetch` skips External Source git clones since edits are local; `--yes` skips confirmation prompts. Skill Artifact ZIPs are **not** rebuilt — add `--artifacts` when you actually need them.

`sync:watch` uses `chokidar-cli` against `canonical/**` and `manifests/**`. Run it in a background terminal during iteration; edits to `canonical/skills/wym/SKILL.md` (or any tracked file) trigger an immediate resync.

## Project Flow Workflow

See [docs/project-flow-how-to.md](docs/project-flow-how-to.md) for the `/project-flow-setup` workflow and the daily loop across `/scope`, `/to-issues`, `/roadmap`, `/implement`, `/verification-loop`, and `/prep-pr`.

## Structure

```
canonical/            # Canonical Assistant Source — distributable content
  INSTRUCTIONS.md     # Global instructions (installed to ~/.claude/CLAUDE.md, projected to Codex AGENTS.md)
  LEXICON.md          # Global Lexicon (installed to ~/.claude/LEXICON.md)
  PLAN.md             # ExecPlan format guide
  skills/             # 50+ distributable skill directories (SKILL.md each)
  hooks/              # Hook scripts (.js) + wiring.yaml manifest
  rules/              # Common/language rules → ~/.claude/rules/ and ~/.codex/rules/
  machines/           # Machine profiles — rules.md + skills/ per machine class (ADR-0003)
  config/             # *.example.* config templates (filled-in copies stay local)
docs/                 # ADRs, project-flow guides, agent docs
manifests/
  install.yaml        # Installation Manifest — External Sources
  presets.yaml        # Machine-class Presets (ADR-0002)
scripts/
  setup.ts            # Setup Wizard entry point
  get-skills.sh       # Skill packaging helper
src/setup/            # Setup Wizard modules
tests/setup/          # Test suite
```

Repo-local assistant config (`.claude/`, `.codex/`) and generated output (`artifacts/`, `.setup/`, `.exports/`, `.tasks/`) are gitignored.

### Canonical Assistant Source

`canonical/` is the single source of truth for distributable content. Codex CLI Target Projections are regenerated from `canonical/` into the gitignored `.setup/projections/` staging area before Codex installs. Edit `canonical/` for distributable content — never edit Target Projections directly. `.claude/` is reserved for repo-local Claude Code project config (project-scoped skills, rules); repo-root `.codex/` holds only project-scoped Codex config written by hook wiring.

### Installation Manifest

`manifests/install.yaml` lists External Sources the wizard can fetch: skills, plugins, and MCP servers. During a Default Install, external sources are prepared first, then local Toolkit Components from `canonical/` are applied last so local skills win conflicts.

## Skills

`canonical/skills/` holds 50+ skills, each a directory with a `SKILL.md` (plus optional scripts, templates, and references). They cover the development lifecycle (`/dev`, `/scope`, `/plan`, `/implement`, `/prove-it`, `/commit`), visuals (`/table`, `/diagram`, `/figure` — output lands in `.exports/<kind>/`), knowledge work (`/ingest`, `/lexicon`, `/handoff`), and more. The routing table lives in `canonical/INSTRUCTIONS.md` under "Right Skill, Right Job".

## Hooks

All hooks are Node scripts (`.js`) under `canonical/hooks/`, registered declaratively via `wiring.yaml`:

| Hook | Event | Purpose |
|------|-------|---------|
| `lexicon-reminder.js` | UserPromptSubmit | Re-inject the Lexicon + style reminder every turn (Claude-only; disable with `CLAUDE_LEXICON_REMINDER=0` or `touch ~/.claude/.lexicon-reminder.off`) |
| `quick-recap-reminder.js` | UserPromptSubmit | Nudge the TLDR + completion-status line on work-completing turns |
| `ship-mode-reminder.js` | UserPromptSubmit | Keep ship-mode posture active without drift |
| `devos-steering.js` | UserPromptSubmit | Re-anchor an active DevOS Throughline (`.tasks/*/throughline.md`) every turn |
| `notify-activity.js` | UserPromptSubmit | Stamp session activity so `claude-notify` knows whether you're present |
| `proxy-guard.js` | PreToolUse (Bash) | Block commands that would print proxy credentials (work machines) |
| `canonical-sync.js` | PostToolUse | Auto-run the Setup Wizard when `canonical/` changes so installs stay synced (disable with `CANONICAL_SYNC=0` or `touch .canonical-sync.off`) |
| `diagram-upkeep.js` | PostToolUse (Bash) | Living-diagram upkeep reminder after commits in repos carrying diagram models |
| `strategic-compact.js` | tool-use events | Suggest `/compact` at strategic thresholds instead of hitting auto-compact |
| `claude-notify.js` | Stop, Notification | Desktop banner / Pushover push when a turn finishes or input is needed |
| `environment-context.js` | SessionStart | Tell the assistant which machine it's actually on |
| `quiz-me.js` | SessionStart | Offer a recall quiz on the repo's previous conversation |

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

See `LEXICON.md` for the project Lexicon and `.tasks/installation-wizard/plan.md` for the ExecPlan.
