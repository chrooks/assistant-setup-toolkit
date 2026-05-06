# Build the Assistant Setup Toolkit Setup Wizard

> **2026-05-06:** Canonical Assistant Source moved from `.claude/` to `canonical/`. Historical references to `.claude/` as the source directory in this plan now map to `canonical/`. The `.claude/` directory is now reserved for repo-local Claude Code project config.

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan follows the ExecPlan requirements in `~/.codex/PLAN.md`. Keep this file self-contained: a future contributor should be able to implement the feature from this document alone, without reading the original chat.

## Purpose / Big Picture

After this change, a user can clone this repository on macOS or Windows and run one command to install the Assistant Setup Toolkit for Claude Code, Codex CLI, or both. The Setup Wizard will guide the user through a Default Install or Custom Install, fetch External Sources, apply local Toolkit Components from the Canonical Assistant Source after those External Sources so local skills win conflicts, back up Assistant Homes before writing, record Install Receipts, verify the result, and print Next Steps for manual actions such as Claude Desktop skill uploads or MCP Server secrets.

The observable outcome is a working command, `npm run setup`, plus a direct command, `npx tsx scripts/setup.ts`, that can run in dry-run mode against the real repository. A user should be able to run `npm run setup -- --claude --codex --default --dry-run` and see a clear plan of target homes, external fetches, generated projections, payload writes, backup locations, receipt paths, verification checks, and next steps without changing their machine.

## Progress

- [x] (2026-05-06 16:05Z) Created the PRD at `feature_requests/installation-wizard-prd.md` and domain glossary at `CONTEXT.md`.
- [x] (2026-05-06 16:05Z) Recorded the Default Install precedence rule: External Sources are prepared first, then local Toolkit Components from the Canonical Assistant Source are applied afterward so local skills win conflicts.
- [x] (2026-05-06 16:05Z) Wrote this initial ExecPlan.
- [x] (2026-05-06 17:22Z) Add the Node and TypeScript project scaffolding needed to run and test the Setup Wizard.
- [x] (2026-05-06 17:28Z) Add a YAML Installation Manifest that replaces or pairs with the current human-readable `PLUGINS.md`.
- [x] (2026-05-06 17:28Z) Implement the domain model and manifest parser.
- [x] (2026-05-06 17:35Z) Implement Target Projection generation from `.claude/` to Codex views.
- [x] (2026-05-06 17:35Z) Implement Assistant Payload building with external-first, local-last precedence.
- [x] (2026-05-06 17:35Z) Implement write planning, backups, Safe Merge, Overwrite Install, Prune Install, and Install Receipts.
- [x] (2026-05-06 17:47Z) Implement MCP Server planning and Next Steps without silently installing or running servers.
- [x] (2026-05-06 17:47Z) Implement the CLI flags and Setup Profile parsing.
- [x] (2026-05-06 17:47Z) Implement CLI orchestration, verification, and dry-run output.
- [x] (2026-05-06 17:47Z) Hit acceptance target: `npm run setup -- --claude --codex --default --dry-run` works.
- [x] (2026-05-06 17:54Z) Implement External Source fetch planning and Skill Artifact planning.
- [x] (2026-05-06 17:54Z) Add integration tests with fake Assistant Homes (6 integration tests).
- [x] (2026-05-06 17:54Z) Update README with Setup Wizard docs, flags, write behaviors, and structure.
- [x] (2026-05-06 17:54Z) Run final verification and fill in Outcomes & Retrospective.

## Surprises & Discoveries

- Observation: There is no configured issue tracker metadata in this repository, so the PRD was published locally with `Status: needs-triage`.
  Evidence: Searching for issue tracker or triage configuration found only local skill artifacts and no project tracker config.
- Observation: `PLUGINS.md` currently mixes Plugins, Skills, and MCP Servers in human prose.
  Evidence: `PLUGINS.md` lists UI/UX Pro Max, Caveman, Everything Claude Code, Matt Pocock skills, Codex for Claude Code, Playwright MCP, and Context7 together.
- Observation: This repository already has separate shell and PowerShell installers, plus separate Claude-to-Codex projection scripts.
  Evidence: Existing files include `scripts/install.sh`, `scripts/install.ps1`, `scripts/create-codex-dir.sh`, and `scripts/create-codex-dir.ps1`.

## Decision Log

- Decision: Implement the Setup Wizard in Node + TypeScript using `tsx`.
  Rationale: The wizard must run on macOS and Windows from one implementation, support interactive prompts and flags, and most target users already have Node if they use Claude Code or Codex CLI.
  Date/Author: 2026-05-06 / Codex, from user answers.

- Decision: Use `.claude/` as the Canonical Assistant Source and regenerate `.codex/` and `.agents/` as Target Projections.
  Rationale: The user wants one source of truth and wants to avoid drift at all costs.
  Date/Author: 2026-05-06 / Codex, from user answers.

- Decision: During a Default Install, prepare External Sources first, then overlay local Toolkit Components from the Canonical Assistant Source.
  Rationale: Some local skills intentionally override outside skills with the same names, so local repository choices must win conflicts.
  Date/Author: 2026-05-06 / Codex, from user note.

- Decision: Support Claude Code and Codex CLI as the first automated Assistant Targets.
  Rationale: CLI Assistant Homes are discoverable and automatable; Claude Desktop skill upload appears to require ZIP artifacts and manual UI upload, so automated desktop installation is out of scope.
  Date/Author: 2026-05-06 / Codex, from research note and user answers.

- Decision: Make Safe Merge the default write behavior, with explicit Overwrite Install and Prune Install modes.
  Rationale: Assistant Homes may contain personal files. Default behavior must be conservative, while advanced users still need controlled replacement and cleanup.
  Date/Author: 2026-05-06 / Codex, from user answers.

- Decision: Prune Install may remove only toolkit-owned files proven by an Install Receipt.
  Rationale: Prune should remove stale toolkit files without deleting arbitrary user-owned files.
  Date/Author: 2026-05-06 / Codex, from user answers.

## Outcomes & Retrospective

### 2026-05-06 — Initial implementation complete

**Acceptance target:** `npm run setup -- --claude --codex --default --dry-run` — **PASS**. Output lists both targets, all three homes, fetch plan, target projections, payload precedence, verification checks, and Next Steps. States dry-run and no files written.

**Tests:** 12 test files, 54 tests — **ALL PASS** on macOS (Darwin 24.6.0). 6 integration tests use temporary fake Assistant Homes with real filesystem operations.

**Typecheck:** `tsc --noEmit` — **CLEAN**, zero errors.

**What shipped:**
- 12 `src/setup/` modules: domain, manifest, paths, projection, payload, write-plan, cli, mcp, next-steps, verify, receipts, artifacts, external-sources, index
- YAML Installation Manifest with all 8 External Sources
- Full dry-run CLI with acceptance output
- README rewritten for Setup Wizard

**What's deferred:**
- Actual network fetching of External Sources (planning only)
- Actual ZIP artifact generation (planning only)
- Actual file apply/write (write-plan produces the plan, apply module not yet wired)
- Interactive prompts via @inquirer/prompts (flags-only for now)
- Windows/macOS CI (GitHub Actions workflow not yet created)
- Legacy script wrapper updates (install.sh, install.ps1 still independent)

## Code Review Findings

Populated after code review — leave blank until review is complete.

### High Risk

### Medium Risk

### Low Risk

## Context and Orientation

This repository is the Assistant Setup Toolkit: a portable collection of assistant instructions, skills, hooks, manifests, and installers. The important domain words are defined here so the implementation can use them consistently.

An Assistant Target is a supported assistant runtime that the toolkit can configure. The first automated Assistant Targets are Claude Code and Codex CLI. An Assistant Home is a user-level install destination owned by, or discovered by, an assistant. Claude Code uses `~/.claude`. Codex CLI uses `~/.codex` for Codex configuration and `~/.agents` for shared agent skills; both are Assistant Homes.

The Canonical Assistant Source is `.claude/`, the repository directory edited directly for shared assistant instructions and skills. Target Projections are generated target-specific views of the canonical files. `.codex/` and `.agents/` are Codex Target Projections and must be regenerated from `.claude/` before Codex installation.

The Setup Wizard is the interactive and flag-driven installer. It builds Assistant Payloads, where a payload is the selected set of Toolkit Components prepared for one Assistant Home. Toolkit Components include instructions, plans, hooks, commands, skills, settings, and manifests.

The Installation Manifest is a structured YAML source list that tells the Setup Wizard which External Sources are available. An External Source is a remote repository or URL that can provide Skills, Plugins, MCP Servers, or other Toolkit Components. A Skill is a portable agent instruction package rooted at `SKILL.md`. A Plugin is an installable assistant extension that may bundle skills, metadata, tools, or app-specific integration files. An MCP Server is an external tool server that an assistant can connect to through the Model Context Protocol.

Safe Merge is the default install behavior. It backs up existing Assistant Homes and copies selected payload files without deleting unrelated existing files. Overwrite Install replaces conflicting selected payload files without deleting unrelated files. Prune Install installs the selected payload and removes toolkit-owned files that are no longer selected or present. Toolkit-owned files are files written by a previous Setup Wizard run and recorded in an Install Receipt. An Install Receipt is a timestamped machine-readable record stored inside each Assistant Home under `.assistant-setup-toolkit/receipt.json`.

Existing relevant files:

- `CONTEXT.md` contains the domain glossary and relationships.
- `feature_requests/installation-wizard-prd.md` contains the PRD.
- `feature_requests/installation-wizard-questions.md` contains answered clarifying questions.
- `.claude/CLAUDE.md`, `.claude/PLAN.md`, `.claude/hooks/`, `.claude/commands/`, and `.claude/skills/` are the Claude Canonical Assistant Source.
- `.codex/AGENTS.md`, `.codex/PLAN.md`, and `.agents/skills/` are existing Codex Target Projections.
- `scripts/create-codex-dir.sh` and `scripts/create-codex-dir.ps1` currently generate Codex Target Projections from `.claude/`.
- `scripts/install.sh` and `scripts/install.ps1` currently copy assistant directories into home directories.
- `scripts/get-skills.sh` currently downloads `SKILL.md` files and creates ZIP Skill Artifacts.
- `PLUGINS.md` is currently a human-readable source checklist and should be replaced or paired with a YAML Installation Manifest.
- `.mcp.json` currently contains one local MCP server entry named `forge_extension`.

There is no existing `package.json` in the repository at plan creation. Add Node project scaffolding as part of this work.

## Architecture Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Runtime | Node + TypeScript via `tsx` | One implementation can run on macOS and Windows and can support prompts, flags, filesystem work, and tests. |
| CLI entry point | `npm run setup`, with `npx tsx scripts/setup.ts` also supported | `npm run setup` is friendly after cloning; direct `tsx` is useful for lightweight runs. |
| Test runner | Vitest | It is fast, TypeScript-friendly, and works well for unit and integration tests around filesystem fixtures. |
| YAML parser | `yaml` npm package | The Installation Manifest should be human-editable YAML and parsed with a structured parser, not ad hoc string handling. |
| Argument parsing | A small parser such as `commander` or a local parser | Flags must be predictable; choose `commander` if dependencies are acceptable, otherwise keep a small local parser tested in isolation. |
| Prompts | A maintained prompt library such as `@inquirer/prompts` | Interactive choices should be accessible and cross-platform. Keep prompt code isolated so non-interactive tests can bypass it. |
| Validation | Zod | Manifest and domain object validation should fail fast with descriptive errors. |
| Source of truth | `.claude/` | Local edits happen once and Codex Target Projections are generated from the Canonical Assistant Source. |
| Install precedence | External Sources first, local Canonical Assistant Source last | Local skills and toolkit choices should override outside sources during a Default Install. |
| Desktop support | Generate Skill Artifacts and print Next Steps | Manual ZIP upload is the known supported path; do not pretend desktop installation is automated. |
| MCP support | Confirm and plan, do not silently install or run servers | MCP Servers can execute code or require secrets; setup must be explicit and safe. |

## File Changes

### New Files

- `package.json` — defines `setup`, `test`, `typecheck`, and helper scripts.
- `tsconfig.json` — TypeScript configuration for scripts and tests.
- `vitest.config.ts` — Vitest configuration.
- `manifests/install.yaml` — structured Installation Manifest for External Sources, replacing or pairing with `PLUGINS.md`.
- `scripts/setup.ts` — thin CLI entry point for the Setup Wizard.
- `src/setup/domain.ts` — domain types for Assistant Targets, Assistant Homes, Setup Profiles, Toolkit Components, write behaviors, Install Receipts, and Next Steps.
- `src/setup/manifest.ts` — YAML Installation Manifest parsing and validation.
- `src/setup/paths.ts` — repository and Assistant Home path resolution for macOS, Windows, and tests.
- `src/setup/projection.ts` — Target Projection generation from `.claude/` to `.codex/` and `.agents/`.
- `src/setup/payload.ts` — Assistant Payload building, including external-first and local-last precedence.
- `src/setup/write-plan.ts` — dry-run, Safe Merge, Overwrite Install, Prune Install, backup, symlink, and receipt planning.
- `src/setup/apply.ts` — applies a Write Plan to the filesystem.
- `src/setup/receipts.ts` — reads and writes Install Receipts.
- `src/setup/external-sources.ts` — fetches External Sources or reports clear fetch plans.
- `src/setup/artifacts.ts` — generates Skill Artifacts as ZIP files.
- `src/setup/mcp.ts` — plans MCP Server configuration and Next Steps.
- `src/setup/verify.ts` — Verification Step implementation.
- `src/setup/next-steps.ts` — formats target-specific Next Steps.
- `src/setup/cli.ts` — flags, prompts, and conversion to Setup Profiles.
- `src/setup/index.ts` — orchestration function for running the Setup Wizard.
- `tests/setup/*.test.ts` — unit and integration tests.
- `tests/fixtures/basic-toolkit/` — small fake repository fixture for tests.
- `.github/workflows/setup-wizard.yml` — macOS and Windows CI for typecheck and tests, if this repository uses GitHub Actions.

### Modified Files

- `CONTEXT.md` — already updated with the Default Install precedence rule; update again if terms change during implementation.
- `feature_requests/installation-wizard-prd.md` — already updated with the Default Install precedence rule; update if scope changes.
- `README.md` — document `npm run setup`, flags, dry-run, Default Install, Custom Install, write behaviors, and Next Steps.
- `PLUGINS.md` — either convert to a pointer to `manifests/install.yaml` or keep as a human explanation generated from the manifest.
- `scripts/install.sh` — keep as a compatibility wrapper that calls `npm run setup` or deprecate with a clear message.
- `scripts/install.ps1` — keep as a compatibility wrapper that calls `npm run setup` or deprecate with a clear message.
- `scripts/create-codex-dir.sh` — either wrap the TypeScript Target Projection module or keep temporarily as a compatibility helper.
- `scripts/create-codex-dir.ps1` — either wrap the TypeScript Target Projection module or keep temporarily as a compatibility helper.
- `scripts/get-skills.sh` — either wrap the TypeScript External Source and Skill Artifact flow or keep temporarily as a compatibility helper.
- `.gitignore` — ensure generated fetch caches, test temp directories, and local backups are ignored.

### Deleted Files

- No file deletion is required for the first implementation. Old shell and PowerShell scripts should remain as wrappers or compatibility helpers until the TypeScript Setup Wizard is proven.

## Data & API Changes

No database or HTTP API changes.

Add a repository-local YAML Installation Manifest at `manifests/install.yaml`. The manifest should be structured and validated. Use this shape unless implementation discovers a better minimal shape:

    version: 1
    externalSources:
      - id: matt-pocock-skills
        name: Matt Pocock Skills
        kind: skill-pack
        url: https://github.com/mattpocock/skills
        default: true
        targets: [claude-code, codex-cli]
        notes:
          - Includes engineering and productivity skills.
      - id: find-skills
        name: find-skills
        kind: skill
        url: https://github.com/vercel-labs/skills/tree/main/skills/find-skills
        default: true
        targets: [claude-code, codex-cli]
      - id: ui-ux-pro-max
        name: UI/UX Pro Max
        kind: skill-or-plugin
        url: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill
        default: true
        targets: [claude-code, codex-cli]
      - id: everything-claude-code
        name: Everything Claude Code
        kind: plugin
        url: https://github.com/affaan-m/everything-claude-code
        default: true
        targets: [claude-code]
      - id: codex-plugin-cc
        name: Codex for Claude Code
        kind: plugin
        url: https://github.com/openai/codex-plugin-cc
        default: true
        targets: [claude-code]
        installWhen:
          assistantTargetExists: claude-code
      - id: playwright-mcp
        name: Playwright MCP
        kind: mcp-server
        url: https://github.com/microsoft/playwright-mcp
        default: false
        targets: [claude-code, codex-cli]
        requiresConfirmation: true
      - id: context7
        name: Context7
        kind: mcp-server
        url: https://github.com/upstash/context7#installation
        default: false
        targets: [claude-code, codex-cli]
        requiresConfirmation: true
        requiredSecrets:
          - CONTEXT7_API_KEY

The manifest parser should allow unknown future fields only if they are namespaced or explicitly documented. Unknown top-level fields should fail validation with a descriptive error.

Add Install Receipts inside Assistant Homes at `.assistant-setup-toolkit/receipt.json`. The receipt shape should be:

    {
      "schemaVersion": 1,
      "toolkit": "code-assistant-context",
      "installedAt": "2026-05-06T16:05:00.000Z",
      "assistantTarget": "claude-code",
      "assistantHome": "/Users/example/.claude",
      "setupProfile": {
        "mode": "default",
        "writeBehavior": "safe-merge",
        "components": ["instructions", "plans", "hooks", "commands", "skills", "settings", "manifests"]
      },
      "files": [
        "CLAUDE.md",
        "PLAN.md",
        "skills/feature/SKILL.md"
      ]
    }

Receipt `files` paths are relative to the Assistant Home. Prune Install may only remove paths listed in a previous receipt and only after creating a backup.

## Plan of Work

Start by adding the Node project scaffolding. Create `package.json`, `tsconfig.json`, and `vitest.config.ts`. The `setup` script should run `tsx scripts/setup.ts`, `test` should run Vitest, and `typecheck` should run `tsc --noEmit`. Install dependencies only after the files are added: TypeScript, tsx, Vitest, Zod, YAML parsing, a CLI argument parser, and a prompt library. If network access is unavailable, add the files and document the dependency install command in Outcomes & Retrospective, then ask for network approval when running the install command.

Next, write the domain model in `src/setup/domain.ts`. Keep this module independent from the filesystem. Define literal unions for Assistant Targets, write behaviors, component kinds, external source kinds, setup modes, and install actions. Define plain TypeScript interfaces for Setup Profile, Assistant Home, Assistant Payload, Payload File, Write Plan, Install Receipt, Verification Result, and Next Step. This is a deep module: it should expose stable types and small helpers, while hiding incidental CLI details.

Then write `src/setup/manifest.ts`. It should read `manifests/install.yaml`, parse it as YAML, validate it with Zod, and return normalized External Sources. It should fail fast with messages that name the manifest path and invalid field. Write tests before or alongside it using small YAML snippets. Include MCP Servers as first-class External Sources, not Plugins.

Create `manifests/install.yaml` from the current `PLUGINS.md` content. Preserve all sources currently listed: UI/UX Pro Max, Caveman, Everything Claude Code, Matt Pocock skills, find-skills, Codex for Claude Code, Playwright MCP, and Context7. Correct the spelling of Matt Pocock in the manifest. Keep `PLUGINS.md` as human-facing prose that points to the manifest or explains the curated list.

Implement path resolution in `src/setup/paths.ts`. It should accept an optional fake home path for tests. For real runs, use the user's home directory. Resolve Claude Code to `~/.claude`. Resolve Codex CLI to `~/.codex` and `~/.agents`. Expose helpers for receipt metadata paths, backup paths, artifact paths, and repository paths. Keep Windows path support by using Node `path` APIs rather than string concatenation.

Implement Target Projection generation in `src/setup/projection.ts`. Port the behavior of `scripts/create-codex-dir.sh` and `scripts/create-codex-dir.ps1`: `.claude/CLAUDE.md` becomes `.codex/AGENTS.md`, `.claude/PLAN.md` becomes `.codex/PLAN.md`, and `.claude/skills/` becomes `.agents/skills/` with text references rewritten from Claude conventions to Codex conventions. Preserve the frontmatter safety behavior for `description` and `argument-hint` fields in `SKILL.md`. Do not copy Claude commands or hooks into Codex projections unless a later decision says Codex supports them.

Implement `src/setup/external-sources.ts` with a safe first version. It should create a fetch workspace under an ignored directory such as `.setup-cache/external-sources/`. For GitHub tree URLs pointing to a skill folder, download or fetch the `SKILL.md` and store it as a local Skill. For full repositories, use `git clone` or `git -C pull` only after the user confirms fetching in interactive mode or passes a non-interactive fetch flag. If network commands fail, surface the External Source id, URL, command attempted, and retry guidance. The first implementation may plan fetches in dry-run without performing network operations.

Implement Skill Artifact generation in `src/setup/artifacts.ts`. The existing `scripts/get-skills.sh` behavior creates `artifacts/<skill-name>/SKILL.md` and `artifacts/<skill-name>.zip`. Recreate that behavior in TypeScript for selected Skills. The ZIP should contain the skill folder at the root, suitable for manual desktop or web upload. If adding a ZIP library, test archive contents. If avoiding a ZIP library initially, call the platform `zip` command on macOS and document that Windows artifact packaging needs the library before CI can pass.

Implement Assistant Payload building in `src/setup/payload.ts`. The builder receives the Setup Profile, normalized manifest sources, fetched local source paths, and the Canonical Assistant Source. It builds payload files for each Assistant Target and Assistant Home. The crucial ordering rule is external-first and local-last: prepare external Skills and Plugins first, then overlay local Toolkit Components from `.claude/` and generated Target Projections so local files win conflicts by relative path. The builder should record conflict decisions in the Write Plan so dry-run output can explain what won.

Implement write planning in `src/setup/write-plan.ts`. Given current filesystem state, Assistant Payloads, previous receipts, and write behavior, produce a Write Plan without writing files. For Safe Merge, copy missing files and skip conflicting files unless the conflict is between external and local payload entries, where local already won during payload building. For Overwrite Install, replace conflicting selected payload files. For Prune Install, remove only files listed in the previous Install Receipt that are absent from the new selected payload. For all non-dry-run writes, plan a timestamped backup before modifications. For symlink mode, plan symlinks only where safe and supported; if unsupported, produce a warning and fall back to copies only with explicit confirmation.

Implement applying write plans in `src/setup/apply.ts`. This module should create backups, create directories, copy files, create symlinks when requested, remove receipt-owned stale files during Prune Install, and write Install Receipts through `src/setup/receipts.ts`. Keep apply idempotent: running the same Default Install twice should not duplicate files or backups beyond the new timestamped backup for a real write. Dry-run must never write.

Implement verification in `src/setup/verify.ts`. It should check that planned files exist after apply, hooks are executable on non-Windows platforms, Codex Target Projections are current, receipts exist and include timestamps, and Skill Artifacts exist when generated. It should return structured results for tests and human-readable lines for CLI output.

Implement MCP Server planning in `src/setup/mcp.ts`. It should read MCP Server External Sources from the manifest and produce Next Steps. For Context7, mention that an API key is required and do not write secrets. For Playwright MCP, mention confirmation is required before installing or running anything. If this repository's `.mcp.json` is selected as a Toolkit Component, treat it as a file payload; do not conflate that with installing external MCP Server processes.

Implement CLI orchestration in `src/setup/cli.ts`, `src/setup/index.ts`, and `scripts/setup.ts`. `scripts/setup.ts` should be tiny: import the runner, pass process arguments, and set the process exit code on failure. The CLI must support `--claude`, `--codex`, `--default`, `--custom`, `--dry-run`, `--overwrite`, `--prune`, `--symlink`, `--no-fetch`, and `--yes`. In interactive mode, prompt for Assistant Targets, Default Install or Custom Install, Toolkit Components, External Sources, write behavior, symlink mode, and confirmation before writing. In non-interactive mode, require at least one Assistant Target and either `--default` or enough options to produce a Setup Profile.

Finally update documentation and compatibility scripts. Update `README.md` with Quick Install instructions for `npm run setup`, examples for dry-run and target flags, and explanations of Safe Merge, Overwrite Install, Prune Install, Install Receipts, and Next Steps. Update `scripts/install.sh` and `scripts/install.ps1` to recommend or invoke the Node Setup Wizard. Keep `scripts/create-codex-dir.*` and `scripts/get-skills.sh` available initially, but document that the TypeScript wizard is the preferred path.

## Concrete Steps

Run all commands from the repository root:

    cd /Users/cdbrooks/Development/Software/Repositories/code-assistant-context

Create and inspect the Node scaffolding:

    npm install --save-dev typescript tsx vitest @types/node
    npm install zod yaml commander @inquirer/prompts
    npm run typecheck

Expected typecheck after scaffolding and before implementation may fail if `src/` does not exist yet. After implementation, it must pass with no TypeScript errors.

Run the test suite throughout implementation:

    npm test

Expected final output should be equivalent to:

    Test Files  all passed
    Tests       all passed

Exact counts will depend on the tests added.

Exercise the dry-run CLI after the first vertical slice:

    npm run setup -- --claude --default --dry-run

Expected behavior: the command prints a Claude Code Setup Profile, target Assistant Home `~/.claude`, planned backup path, planned payload files, receipt path, verification checks, and Next Steps. It must state that no files were written.

Exercise both Assistant Targets:

    npm run setup -- --claude --codex --default --dry-run

Expected behavior: the command includes Claude Code and Codex CLI. It should state that Codex Target Projections will be regenerated from `.claude/`, then show planned writes for `~/.codex` and `~/.agents`.

Exercise local-over-external precedence with a test fixture:

    npm test -- payload

Expected behavior: a test fixture with an external `skills/feature/SKILL.md` and a local `.claude/skills/feature/SKILL.md` proves the local Canonical Assistant Source file wins in the final Assistant Payload.

Exercise write behavior tests:

    npm test -- write-plan

Expected behavior: Safe Merge preserves unrelated files, Overwrite Install replaces selected payload conflicts, and Prune Install removes only stale files listed in a previous Install Receipt.

After implementation, run:

    npm run typecheck
    npm test
    npm run setup -- --claude --codex --default --dry-run

Record the output summary in `Outcomes & Retrospective`.

## Validation and Acceptance

The feature is accepted when a user can run the Setup Wizard in dry-run mode and see a complete, understandable installation plan without writing files. The command `npm run setup -- --claude --codex --default --dry-run` must mention Claude Code, Codex CLI, `~/.claude`, `~/.codex`, `~/.agents`, the Fetch Step, Target Projection generation, Safe Merge, planned backups, planned Install Receipts, Verification Step checks, and Next Steps.

The Default Install must apply external-first and local-last precedence. A test must demonstrate that when an External Source and the Canonical Assistant Source both provide the same Skill path, the local Canonical Assistant Source version wins. The dry-run output should mention the override so a user understands why the local skill was selected.

Safe Merge must not overwrite conflicting user files unless they are absent or selected behavior permits replacement. Overwrite Install must replace selected payload conflicts only. Prune Install must remove only files from a previous Install Receipt that are not in the new payload. All non-dry-run writes must create a timestamped backup before writing.

Codex Target Projections must be regenerated from `.claude/` before Codex payloads are built. A test must prove `CLAUDE.md` maps to `AGENTS.md`, `PLAN.md` maps to `PLAN.md`, and `.claude/skills` maps to `.agents/skills` with expected text rewrites.

The Installation Manifest must parse Skills, Plugins, and MCP Servers distinctly. Context7 must surface a Next Step about the required API key. Playwright MCP must surface a confirmation-oriented Next Step. The wizard must not silently install or run MCP Server processes.

### Manual Verification Steps

1. From the repository root, run `npm run setup -- --claude --codex --default --dry-run`.
2. Confirm the output says dry-run mode is active and no files were written.
3. Confirm the output lists Claude Code and Codex CLI as Assistant Targets.
4. Confirm the output lists `~/.claude`, `~/.codex`, and `~/.agents` as Assistant Homes.
5. Confirm the output states that External Sources are prepared before local Toolkit Components, and that local Canonical Assistant Source files win conflicts.
6. Confirm the output lists planned backups and Install Receipt paths under `.assistant-setup-toolkit/receipt.json`.
7. Confirm the output includes Verification Step checks for copied files, executable hooks, Target Projections, Install Receipts, and Skill Artifacts.
8. Confirm the output includes Next Steps for manual desktop skill upload and MCP Server secrets or confirmations.
9. Run `npm test` and confirm all tests pass.
10. Run `npm run typecheck` and confirm no TypeScript errors.

## Testing Plan

### Unit Tests

- Test domain normalization in `src/setup/domain.ts`: valid Assistant Targets, write behaviors, setup modes, and Toolkit Components.
- Test manifest parsing in `src/setup/manifest.ts`: valid sources, invalid top-level fields, invalid target compatibility, MCP Server secret requirements, and clear error messages.
- Test path resolution in `src/setup/paths.ts`: fake macOS home, fake Windows home, Assistant Home paths, receipt paths, backup paths, and artifact paths.
- Test Target Projection in `src/setup/projection.ts`: Claude-to-Codex filename mapping, text rewrites, skill frontmatter quoting, skipped commands, skipped hooks, and unchanged-file behavior.
- Test payload building in `src/setup/payload.ts`: Default Install components, Custom Install components, external-first local-last precedence, and conflict reporting.
- Test write planning in `src/setup/write-plan.ts`: Safe Merge, Overwrite Install, Prune Install, dry-run, backup planning, symlink planning, and unsupported symlink fallback.
- Test receipts in `src/setup/receipts.ts`: timestamped receipt writing, relative file paths, schema version, and reading previous receipts.
- Test artifact generation in `src/setup/artifacts.ts`: ZIP contents contain the skill folder root and `SKILL.md`.
- Test MCP planning in `src/setup/mcp.ts`: Context7 API key Next Step, Playwright confirmation Next Step, and no silent server execution.
- Test CLI normalization in `src/setup/cli.ts`: flags to Setup Profile, invalid non-interactive combinations, and default write behavior.

### Integration Tests

- Install Claude Code Default Install into a temporary fake home and verify files, receipt, backup, and verification result.
- Install Codex CLI Default Install into a temporary fake home and verify regenerated Target Projections are installed.
- Run dry-run against temporary fake homes and verify no files are written.
- Run Custom Install with selected Toolkit Components and verify only those components are included.
- Run Overwrite Install against a conflicting file and verify only selected payload conflicts are replaced.
- Run Prune Install with a previous receipt and verify only stale receipt-owned files are removed.
- Run a fixture where an External Source and local Canonical Assistant Source provide the same Skill path and verify local wins.

### E2E Tests

- No browser E2E tests are needed. The critical end-to-end flow is the CLI dry-run command `npm run setup -- --claude --codex --default --dry-run`, covered by an integration test and manual verification.

## Idempotence and Recovery

The Setup Wizard must be safe to run repeatedly. Dry-run never writes. Safe Merge can be repeated without deleting unrelated files. Overwrite Install can be repeated and should produce the same selected payload content each time. Prune Install can be repeated and should only remove files listed in the previous Install Receipt and absent from the new payload.

Every non-dry-run write creates a timestamped backup before changing an Assistant Home. If a write fails halfway, the user can restore from the newest backup directory. The backup location should be printed before writing and recorded in the command output. The plan should avoid destructive operations against real Assistant Homes during tests by using temporary fake home directories.

Network fetches should be retryable. Failed fetches must not corrupt existing Assistant Homes because fetch happens before payload apply. Fetch caches should live under an ignored local cache directory and can be safely deleted if they become inconsistent.

Prune Install must never delete files not listed in a previous Install Receipt. If there is no previous receipt, Prune Install should warn that there is nothing safe to prune and proceed as Safe Merge or stop for confirmation, depending on interactive mode.

## Artifacts and Notes

The existing PRD is at `feature_requests/installation-wizard-prd.md`. The answered questions are at `feature_requests/installation-wizard-questions.md`. The domain glossary is at `CONTEXT.md`.

Expected dry-run transcript shape:

    Assistant Setup Toolkit Setup Wizard
    Mode: dry-run
    Setup Profile: Default Install
    Write behavior: Safe Merge
    Assistant Targets:
      - Claude Code -> ~/.claude
      - Codex CLI -> ~/.codex, ~/.agents
    Fetch Step:
      - matt-pocock-skills: planned
      - find-skills: planned
      - playwright-mcp: next steps only
      - context7: next steps only, requires CONTEXT7_API_KEY
    Target Projections:
      - regenerate .codex/AGENTS.md from .claude/CLAUDE.md
      - regenerate .codex/PLAN.md from .claude/PLAN.md
      - regenerate .agents/skills from .claude/skills
    Payload precedence:
      - External Sources prepared first
      - Canonical Assistant Source applied last; local files win conflicts
    Planned writes:
      - no files written in dry-run
    Verification Step:
      - planned files
      - executable hooks
      - target projections
      - install receipts
      - skill artifacts
    Next Steps:
      - Upload generated Skill Artifacts manually where desktop/web upload is required.
      - Add required MCP Server secrets before enabling Context7.

## Interfaces and Dependencies

Use TypeScript modules with small, stable interfaces. The names below are prescriptive enough for tests and future callers, but the implementation may add helper types if needed.

In `src/setup/domain.ts`, define:

    export type AssistantTargetId = "claude-code" | "codex-cli";
    export type AssistantHomeId = "claude-home" | "codex-home" | "agents-home";
    export type SetupMode = "default" | "custom";
    export type WriteBehavior = "safe-merge" | "overwrite" | "prune";
    export type ComponentKind = "instructions" | "plans" | "hooks" | "commands" | "skills" | "settings" | "manifests" | "mcp";
    export type ExternalSourceKind = "skill" | "skill-pack" | "plugin" | "skill-or-plugin" | "mcp-server";

    export interface SetupProfile {
      mode: SetupMode;
      targets: AssistantTargetId[];
      components: ComponentKind[];
      writeBehavior: WriteBehavior;
      dryRun: boolean;
      fetch: boolean;
      symlink: boolean;
      yes: boolean;
    }

    export interface PayloadFile {
      relativePath: string;
      sourcePath: string;
      component: ComponentKind;
      origin: "external-source" | "canonical-source" | "target-projection";
      executable: boolean;
    }

    export interface AssistantPayload {
      target: AssistantTargetId;
      homeId: AssistantHomeId;
      files: PayloadFile[];
    }

    export interface InstallReceipt {
      schemaVersion: 1;
      toolkit: "code-assistant-context";
      installedAt: string;
      assistantTarget: AssistantTargetId;
      assistantHome: string;
      setupProfile: Pick<SetupProfile, "mode" | "components" | "writeBehavior">;
      files: string[];
    }

In `src/setup/manifest.ts`, define:

    export function loadInstallationManifest(path: string): Promise<InstallationManifest>;
    export function parseInstallationManifestYaml(yamlText: string, sourceName: string): InstallationManifest;

In `src/setup/projection.ts`, define:

    export interface ProjectionOptions {
      repoRoot: string;
      dryRun: boolean;
    }

    export function buildCodexTargetProjection(options: ProjectionOptions): Promise<ProjectionResult>;

In `src/setup/payload.ts`, define:

    export function buildAssistantPayloads(input: BuildPayloadInput): Promise<BuildPayloadResult>;

`buildAssistantPayloads` must document and test the precedence rule: External Sources are prepared first, then local Toolkit Components from the Canonical Assistant Source are applied last.

In `src/setup/write-plan.ts`, define:

    export function planWrites(input: PlanWritesInput): Promise<WritePlan>;

In `src/setup/apply.ts`, define:

    export function applyWritePlan(plan: WritePlan): Promise<ApplyResult>;

In `src/setup/verify.ts`, define:

    export function verifyInstallation(input: VerifyInstallationInput): Promise<VerificationResult>;

In `src/setup/index.ts`, define:

    export async function runSetupWizard(argv: string[], env?: Partial<NodeJS.ProcessEnv>): Promise<number>;

The CLI entry file `scripts/setup.ts` should call `runSetupWizard(process.argv.slice(2), process.env)` and set `process.exitCode` to the returned number. It should catch unexpected errors, print a descriptive message, and return exit code 1.

Use Node standard library modules for filesystem and paths: `node:fs/promises`, `node:path`, `node:os`, and `node:child_process` only where command execution is unavoidable. Prefer structured filesystem APIs over shell commands. Use shell commands only for Git fetches or temporary compatibility paths, and keep command construction explicit and tested.

## Revision Notes

- 2026-05-06 16:05Z: Initial ExecPlan created from `feature_requests/installation-wizard-prd.md`, `feature_requests/installation-wizard-questions.md`, and `CONTEXT.md`. Added the user's Default Install precedence note throughout the plan: External Sources are prepared first, then local Toolkit Components from the Canonical Assistant Source are applied afterward so local skills win conflicts.
