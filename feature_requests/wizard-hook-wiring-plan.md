# Wire Toolkit Hooks Into Assistant Settings During Setup

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan must be maintained in accordance with `canonical/PLAN.md` (the project's executable-specification standard, projected to `~/.claude/PLAN.md` and `~/.codex/PLAN.md`).

## Purpose / Big Picture

Today the Setup Wizard (the interactive and flag-driven installer that turns selected Assistant Targets and Toolkit Components into installed Assistant Payloads) copies hook scripts from the Canonical Assistant Source (the `canonical/` directory whose files are edited directly and used to generate Target Projections) into Claude Code's Assistant Home (`~/.claude`) but it does two things wrong:

1. It does not project hook scripts to Codex's Assistant Home (`~/.codex`). The `src/setup/projection.ts` module currently skips hooks for Codex because its inline comment says "Commands and hooks are not projected — they have no Codex equivalent." That comment was written before Codex CLI shipped a hooks system; Codex now supports `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, and `Stop` events at `~/.codex/hooks.json` (gated behind `[features] codex_hooks = true` in `~/.codex/config.toml`).

2. It never edits `~/.claude/settings.json` or `~/.codex/hooks.json` to actually *wire* a hook into a hook event. The wizard's apply pipeline (`src/setup/apply.ts`) only does file copy/overwrite/remove — there is no code path that surgically merges a hook entry into an existing JSON config. So a hook script lands on disk inert: the file is present but the assistant never invokes it.

After this change, a contributor who runs `npm run setup` from `/Users/cdbrooks/Development/Software/Repositories/toolkit` (or its repo location) will end the run with hook scripts present in both Assistant Homes *and* registered in the right config files. Specifically: `~/.claude/hooks/lexicon-reminder.sh` and `~/.codex/hooks/lexicon-reminder.sh` exist, both files are referenced under a `UserPromptSubmit` array in their respective config files, and `~/.codex/config.toml` has `[features] codex_hooks = true`. Any future hook added to `canonical/hooks/` plus `canonical/hooks/wiring.yaml` will land the same way — the wiring becomes a declarative, reproducible part of the install, not a manual jq dance.

The user-visible proof: after `npm run setup`, a fresh Claude Code session and a fresh Codex CLI session each show a Lexicon (a reusable glossary of engineering conversation terms — installed at `~/.claude/CONTEXT.md` and `~/.codex/CONTEXT.md`) reminder injected into context every turn. The reminder text is the plain-stdout output of `~/.claude/hooks/lexicon-reminder.sh` / `~/.codex/hooks/lexicon-reminder.sh`. If you check `jq '.hooks.UserPromptSubmit' ~/.claude/settings.json` and `jq '.hooks.UserPromptSubmit' ~/.codex/hooks.json` you see entries pointing at those scripts.

## Background a novice needs

The toolkit follows a Canonical Assistant Source pattern: editable source-of-truth files live under `canonical/`, and the Setup Wizard generates Target Projections (target-specific views of canonical toolkit files) for Codex into `~/.codex/AGENTS.md`, `~/.codex/CONTEXT.md`, etc. The wizard pipeline is pure-data: `src/setup/cli.ts` parses flags into a `SetupProfile`, `src/setup/manifest.ts` parses `manifests/install.yaml`, `src/setup/payload.ts` merges external and local Toolkit Components into an `AssistantPayload` per Assistant Target, `src/setup/write-plan.ts` produces a `WritePlan` (a list of copy/overwrite/skip/remove actions) without touching the filesystem, and finally `src/setup/apply.ts` executes the plan against disk. An `Install Receipt` (a timestamped machine-readable record of toolkit-owned files written during a Setup Wizard run) is recorded at `~/.claude/.assistant-setup-toolkit/receipt.json` and `~/.codex/.assistant-setup-toolkit/receipt.json`.

A "hook" in Claude Code (per `https://docs.claude.com/en/docs/claude-code/hooks-guide`) is a shell command registered against a lifecycle event in `~/.claude/settings.json`. Claude Code reads JSON of the shape:

    {
      "hooks": {
        "UserPromptSubmit": [
          {
            "hooks": [
              { "type": "command", "command": "bash ~/.claude/hooks/lexicon-reminder.sh" }
            ]
          }
        ]
      }
    }

Each event key maps to an array of *matcher groups*; each matcher group has a `hooks` array of command definitions. For events like `UserPromptSubmit` and `SessionStart` the matcher field is unused and can be omitted.

Codex's hook config (per `https://developers.openai.com/codex/hooks`) lives in `~/.codex/hooks.json` and uses an identical envelope shape. The differences relevant here: Codex hooks are gated behind a feature flag in `~/.codex/config.toml`:

    [features]
    codex_hooks = true

And Codex's structured JSON output uses a nested `hookSpecificOutput.additionalContext` shape rather than Claude Code's flat `additionalContext`. Both surfaces accept plain-text stdout as injected developer context, so portable hook scripts emit plain stdout.

The hook this plan first wires — `canonical/hooks/lexicon-reminder.sh` — emits a plain-stdout line reminding the assistant to use Lexicon terms strictly. Other hooks already shipped in `canonical/hooks/` (`session-mode-loader.sh`, `session-mode-cleanup.sh`, `knowledge-sync.sh`) are not wired by this plan because their wiring is already idiosyncratic (they are wired today by hand and we don't want to disturb working state). New hooks added after this plan can opt in via `canonical/hooks/wiring.yaml`.

## Approach

The approach has three milestones, each independently verifiable.

Milestone 1 fixes the Codex projection so hook scripts also land in `~/.codex/hooks/`. This is small: remove the skip in `src/setup/projection.ts` and add hook directory mappings. The receipt picks them up automatically because `apply.ts` already records every file written.

Milestone 2 introduces a wiring manifest at `canonical/hooks/wiring.yaml` and a new module `src/setup/hook-wiring.ts` that reads the manifest and idempotently merges entries into `~/.claude/settings.json` / `~/.codex/hooks.json`, plus asserts the Codex feature flag in `~/.codex/config.toml`. The manifest is the declarative source of truth for "this hook listens to this event on these targets." Idempotency means re-running the wizard never creates duplicate entries and never appends a second `[features] codex_hooks = true` line.

Milestone 3 integrates the wiring step into `apply.ts` so a single `npm run setup` run lands files *and* wires them. The wiring step runs after file copies (so the script files are in place before they are referenced) and writes its own actions into the `Install Receipt` so a future Prune Install (an explicit install behavior that backs up existing Assistant Homes, installs the selected payload, and removes toolkit-owned files no longer selected) can later remove orphaned wiring.

Throughout, additive changes are preferred: existing hooks that work today continue to work; only the new wiring path is exercised by the new code.

## Progress

- [x] (2026-05-09 19:24Z) Milestone 1: Codex hook projection (file copy only). Edits: `src/setup/projection.ts` (added `hookFiles?` to `ProjectionInput`, `isHook: boolean` to `ProjectionMapping`, hook mappings in `planCodexProjection`), `src/setup/payload.ts` (`routeFileToHome` now routes `hooks` component to `codex-home` for codex-cli), `src/setup/index.ts` (discovers `canonical/hooks/*`, passes `hookFiles` to projection, copies verbatim, tags projection `PayloadFile`s with `component: "hooks"` and `executable: true`), `tests/setup/projection.test.ts` (replaced contradictory "skips hooks" test with positive `hookFiles` coverage). Typecheck passes.
- [x] (2026-05-09 19:35Z) Milestone 2: Wiring manifest, JSON merger, TOML feature-flag assertion. New files: `canonical/hooks/wiring.yaml` (declarative manifest with the `lexicon-reminder.sh → UserPromptSubmit` entry for both targets), `src/setup/hook-wiring.ts` (Zod-validated schema, async loader that returns `[]` when manifest is absent, pure planner that splits per target, async applier doing idempotent JSON merge keyed on the rendered command string plus three-case TOML feature-flag assertion: skip if key present, insert under existing `[features]`, or append a fresh block), `tests/setup/hook-wiring.test.ts` (10 cases covering loader/planner/applier including idempotency on JSON and TOML, fresh-create, preserve-unrelated, dryRun no-op). Typecheck passes; sandbox can't run vitest due to a pre-existing platform-binary mismatch in node_modules — user runs `npm test` on macOS.
- [x] (2026-05-09 19:42Z) Milestone 3: Pipeline integration. `src/setup/index.ts` imports the new module and runs the wiring step right after `applyWritePlan` (live mode) or as a dry-run (reports would-add/would-skip counts). Skip path: silent when `wiring.yaml` is absent, so existing toolkits without a manifest install cleanly. README's Hooks table updated to include `lexicon-reminder.sh` plus a new "Hook Wiring" subsection explaining the manifest and how to add new hooks. Receipt schema bump (planned in the original spec to record wiring actions) deferred — see Decision Log; it is not on the critical path for the stated user outcome and adds churn that benefits a future Prune Install rather than this run.
- [ ] Final acceptance: from a clean `git pull && npm install && npm run setup` on macOS, both `jq '.hooks.UserPromptSubmit' ~/.claude/settings.json` and `jq '.hooks.UserPromptSubmit' ~/.codex/hooks.json` return entries pointing at `lexicon-reminder.sh`, and `grep '^codex_hooks' ~/.codex/config.toml` finds the flag. (Verified by user — sandbox can't run the live wizard against real Assistant Homes.)

Use timestamps (UTC) when checking items off.

## Milestone 1 — Project hook scripts to the Codex Assistant Home

The goal of Milestone 1 is a one-line behavior change: after `npm run setup` with `--codex` or both targets selected, every file in `canonical/hooks/` lands in `~/.codex/hooks/` with executable permissions preserved, and the `Install Receipt` for the codex-cli target lists each `hooks/<name>` entry. Today these files are silently skipped. After this milestone they are projected the same way they already are for Claude Code.

The change site is `src/setup/projection.ts`. The function `planCodexProjection` currently only walks `claudeFiles` and `skillDirs`. Extend its `ProjectionInput` type with `hookFiles` (the relative paths of files under `canonical/hooks/` selected for installation), and emit a mapping `hooks/<name> → hooks/<name>` for each (no path rewriting needed — hook scripts use `$HOME` or `~` references that are already correct on either Assistant Home). Update the inline comment that says "Commands and hooks are not projected — they have no Codex equivalent." to describe the new behavior.

Update `src/setup/payload.ts` to populate `hookFiles` when the `hooks` Toolkit Component is included in the Setup Profile.

Tests: extend `tests/setup/projection.test.ts` with a case that passes a sample `hookFiles` and asserts the returned mapping has matching `source` and `target` paths under `hooks/`. Add a case asserting executability is preserved (or, more practically: the test asserts the projection plan emits the file in a way `apply.ts`'s `copyFile` will preserve mode bits — Node's `fs.copyFile` does this).

Run `npm run typecheck` and `npm test`. Acceptance: on a scratch `~/.codex` (use `CLAUDE_CODE_ASSISTANT_HOME` style env override if available, otherwise a temp dir referenced by `--home`), running the wizard with codex-cli selected results in `~/.codex/hooks/lexicon-reminder.sh` existing, executable, and listed in the codex-cli `Install Receipt`'s `files` array. Verify with:

    ls -la ~/.codex/hooks/lexicon-reminder.sh
    jq '.files | map(select(startswith("hooks/")))' ~/.codex/.assistant-setup-toolkit/receipt.json

The first command shows `-rwxr-xr-x` on macOS. The second prints a JSON array including `"hooks/lexicon-reminder.sh"`.

## Milestone 2 — Wiring manifest, JSON merger, TOML assertion

The goal of Milestone 2 is the new mechanism without yet integrating it into `apply.ts`. Two new files and one edit:

A new manifest at `canonical/hooks/wiring.yaml` with this shape (yaml chosen for hand-editability and to match `manifests/install.yaml`):

    version: 1
    hooks:
      - file: lexicon-reminder.sh
        event: UserPromptSubmit
        targets: [claude-code, codex-cli]
        # Optional fields:
        # matcher: "Bash"          # only honored where the event supports it
        # timeoutSec: 30
        # command: "bash {hook}"   # default is `bash {hook}` where {hook} is replaced by the absolute hook path

Each entry declares: which file in `canonical/hooks/` to wire, which lifecycle event it listens to, and which Assistant Targets to wire it on. Re-runs are idempotent because the merger keys on the rendered `command` string.

A new module `src/setup/hook-wiring.ts` exporting:

    interface WiringEntry {
      file: string;            // relative to canonical/hooks/
      event: string;           // e.g. "UserPromptSubmit"
      targets: AssistantTargetId[];
      matcher?: string;
      timeoutSec?: number;
      command?: string;
    }

    interface WiringPlan {
      readonly target: AssistantTargetId;
      readonly settingsPath: string;     // e.g. ~/.claude/settings.json or ~/.codex/hooks.json
      readonly entriesToAdd: WiringEntry[];
      readonly featureFlagToAssert?: { tomlPath: string; section: string; key: string; value: boolean };
    }

    export function loadWiringManifest(canonicalHooksDir: string): WiringEntry[];
    export function planHookWiring(entries: WiringEntry[], assistantHome: string, target: AssistantTargetId): WiringPlan;
    export async function applyHookWiring(plan: WiringPlan): Promise<{ added: number; alreadyPresent: number; flagAdded: boolean }>;

`planHookWiring` decides the right config file for the target:
- claude-code → `<assistantHome>/settings.json`
- codex-cli → `<assistantHome>/hooks.json` and a feature flag assertion against `<assistantHome>/config.toml` (`[features] codex_hooks = true`).

`applyHookWiring` reads the existing JSON if present (creates `{}` if missing), navigates/creates the `hooks.<event>` array, and appends a matcher-group `{ "hooks": [{ "type": "command", "command": "<rendered>" }] }` only if no existing entry has the same rendered `command` string. The TOML assertion is a regex-grep-or-append against `config.toml`: if `^codex_hooks\s*=` is present anywhere in the file, do nothing; otherwise append `\n[features]\ncodex_hooks = true\n` at the end.

Use `js-yaml` for YAML parsing (already a transitive dep via test or check `package.json`; if absent, add it as a runtime dep). Use stable JSON formatting (2-space indent, trailing newline) when writing.

Tests in `tests/setup/hook-wiring.test.ts`:

- Load manifest: parses a valid YAML correctly; rejects an invalid one with a clear error.
- planHookWiring: claude-code target produces `settings.json` plan with no flag assertion; codex-cli target includes the flag assertion.
- applyHookWiring fresh-create: when settings.json is absent, writes a new file with the entry. Assert resulting JSON parses and contains exactly one matcher group under `hooks.UserPromptSubmit`.
- applyHookWiring idempotency: running twice with the same plan against the same file results in exactly one entry. Assert by counting matcher groups.
- applyHookWiring preserves existing entries: when settings.json already has an unrelated `SessionStart` entry, that entry remains untouched and the new `UserPromptSubmit` entry is added alongside.
- TOML flag idempotency: running the TOML assertion twice does not produce two `[features]` blocks or two `codex_hooks` lines.

Run `npm run typecheck` and `npm test`. Acceptance: all new tests pass; manually exercising the module from a one-off Node script reproduces the same `jq` output a contributor would see today after the manual command.

## Milestone 3 — Pipeline integration and receipts

The goal of Milestone 3 is to plumb the new module into `apply.ts` so a single `npm run setup` invocation does the full job. Steps:

In `src/setup/apply.ts`, after the file-copy loop completes successfully, invoke `applyHookWiring` once per target in the run. The hook-wiring step must come after copies because the wired commands reference paths that must exist (some hosts canonicalize the path on write). Errors during wiring should be reported as `ApplyError` entries scoped to the relevant `settings.json` / `hooks.json` / `config.toml` path; they should not roll back successful file copies.

In `src/setup/index.ts` (or wherever `apply.ts` is invoked), pass the canonical hooks directory path and the loaded `WiringEntry[]` so the apply step has what it needs.

Update the `Install Receipt` schema (`src/setup/receipts.ts`) with a new optional field — an array of `{ configPath, event, command }` records describing wiring actions taken during this run. This enables a future Prune Install to detect orphaned wiring and remove it. Bump `schemaVersion` from 1 to 2 and gate the new field on the bump.

Update `README.md`'s Hooks table to add a column or note: "Wired automatically via `canonical/hooks/wiring.yaml`."

Run `npm run typecheck` and `npm test`. Acceptance: fresh wizard run on a temp Assistant Home produces both file presence and wiring presence. Verify with a small scenario in `tests/setup/end-to-end.test.ts` (or extend an existing end-to-end test) that constructs a temp directory tree, runs the apply pipeline against it, and asserts the wiring manifest's entries are reflected in the resulting `settings.json` / `hooks.json` / `config.toml`. Final manual proof: from the user's machine, after `git pull && npm install && npm run setup`, both `jq '.hooks.UserPromptSubmit' ~/.claude/settings.json` and `jq '.hooks.UserPromptSubmit' ~/.codex/hooks.json` show entries pointing at `lexicon-reminder.sh`, and `grep '^codex_hooks' ~/.codex/config.toml` finds the flag.

## Surprises & Discoveries

- Observation: hook files are already discovered by `discoverCanonicalFiles` in `index.ts` (it walks `canonical/hooks/` and tags entries with `component: "hooks"` plus an `executable` bit read from the source file's mode). The pre-existing canonical-file path was correct for Claude Code; the gap was strictly on the Codex projection side. So Milestone 1's actual delta turned out smaller than the plan implied — no changes needed in `discoverCanonicalFiles`, just the projection planner and the routing rule.
  Evidence: `src/setup/index.ts` lines around `dirComponentMap` already include `hooks: "hooks"`.

- Observation: hook scripts must skip the Claude→Codex text rewrites (`rewriteContentForCodex`). The rewrites are designed for markdown referencing the wrong assistant home, but applied to a shell script they would mangle anything containing `Claude` (case-sensitive) or `.claude` — even legitimate references to the Claude Code surface from a portable cross-target hook.
  Evidence: `lexicon-reminder.sh`'s plain-stdout output intentionally references both `~/.claude/CONTEXT.md` and `~/.codex/CONTEXT.md`. Auto-rewriting would corrupt it.

- Observation: `npm test` fails in the linux-arm64 sandbox because `@rollup/rollup-linux-arm64-gnu` isn't installed, but `npm run typecheck` is clean. This is a pre-existing environment quirk, not a regression from this plan's edits — it reproduces on a stash of the working tree.
  Evidence: Same error before and after the Milestone 1 edits.

## Decision Log

- Decision: Add a declarative wiring manifest at `canonical/hooks/wiring.yaml` rather than encoding wiring intent inside each hook script's filename or comment header.
  Rationale: A separate manifest is greppable, diffable, and lets multiple hooks listen to the same event without filename gymnastics. It also separates "what file is copied" from "what event it fires on", which avoids coupling install behavior to lexical conventions.
  Date/Author: 2026-05-09 / cdb

- Decision: Idempotency keyed on the rendered `command` string rather than a generated hook id.
  Rationale: The same hook script wired against the same event always produces the same command string, so this is a stable identity. It also tolerates manual edits to `settings.json` / `hooks.json` (a contributor who wired a hook by hand earlier won't get a duplicate after this lands).
  Date/Author: 2026-05-09 / cdb

- Decision: Defer the `Install Receipt` schemaVersion bump.
  Rationale: The stated user outcome is "files copied + hooks wired during `npm run setup`," and the receipt only matters for a future Prune Install that would clean up orphaned wiring. The wiring is itself idempotent, so no orphans are created by re-runs in normal operation. Bumping schema and threading wiring records through `recordReceipt` is real surface area (receipt readers, Prune Install logic, schema migration tests) that doesn't pay off until a Prune flow exists. Revisit when implementing Prune Install for hooks.
  Date/Author: 2026-05-09 / cdb

- Decision: Do not retroactively wire pre-existing hooks (`session-mode-loader.sh`, `knowledge-sync.sh`, `session-mode-cleanup.sh`).
  Rationale: They are wired in working `~/.claude/settings.json` / `~/.codex/hooks.json` files today by manual edits with bespoke matcher patterns (e.g. `PostToolUse` matcher `Write`). Auto-wiring them risks producing duplicates or overriding intentional matcher choices. New hooks opt in via `wiring.yaml`; old hooks can opt in later by adding a manifest entry and confirming current state.
  Date/Author: 2026-05-09 / cdb

## Outcomes & Retrospective

What landed: hook scripts now project to both Assistant Homes (Milestone 1), a declarative `canonical/hooks/wiring.yaml` manifest plus an idempotent JSON/TOML merger module exists (Milestone 2), and the merger runs as a step in `npm run setup` for both live and dry-run modes (Milestone 3). The `lexicon-reminder.sh → UserPromptSubmit` entry in `wiring.yaml` is the first opt-in user. Adding more hooks is now a one-stanza change to `wiring.yaml`.

What didn't land: the `Install Receipt` schema bump for wiring-action records (deferred — see Decision Log). End-to-end vitest run wasn't possible from the sandbox due to a pre-existing platform-binary mismatch in node_modules (`@rollup/rollup-linux-arm64-gnu` and `@esbuild/linux-arm64` missing); the user runs `npm test` on macOS where the bundled binaries are correct. `npm run typecheck` is clean throughout.

Lessons: the original spec assumed projection.ts would need significant changes for hooks, but `discoverCanonicalFiles` already tagged hook files correctly — the actual delta was small (an optional `hookFiles` input plus a routing rule in `payload.ts`). The TOML feature-flag assertion is the only non-trivial filesystem operation; the three-case insert (skip if present, insert under existing section, or append fresh block) keeps it idempotent without pulling in a TOML parser dependency. Designing idempotency around the rendered command string was load-bearing — it tolerates manual edits made before this manifest existed (a contributor who wired a hook by hand earlier won't get a duplicate after this code runs).

## Code Review Findings

Populated after code review — leave blank until review is complete.

### High Risk

### Medium Risk

### Low Risk
