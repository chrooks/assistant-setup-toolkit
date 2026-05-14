# Add Claude HowTo Extension Advisor Skill

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan must be maintained in accordance with `canonical/PLAN.md`, which is projected to Assistant Homes as `PLAN.md`. An Assistant Home is a user-level install destination owned by, or discovered by, an assistant.

## Purpose / Big Picture

The Assistant Setup Toolkit is a portable collection of instructions, skills, hooks, manifests, and installers that configures coding assistants consistently across machines. This change adds one advisory Skill that teaches future assistants how to use the local `claude-howto` repository when making decisions about assistant extensions.

A Skill is a portable agent instruction package rooted at `SKILL.md`. A Plugin is an installable assistant extension that may bundle Skills, metadata, tools, or app-specific integration files. After this change, work on Skills, Plugins, hook scripts, MCP Servers, the Installation Manifest, and Setup Wizard extension behavior has a concise, local reference that points to the useful `claude-howto` guidance without copying that repository wholesale.

The user-visible proof is a Setup Wizard dry run showing the new Skill and its reference file in the Codex Target Projection, plus Skill Artifact planning for the new Skill. A Target Projection is a generated target-specific view of canonical toolkit files.

## Progress

- [x] (2026-05-14 00:00Z) Created this ExecPlan before implementation.
- [x] (2026-05-14 02:07Z) Added a focused test for the advisory Skill contract and confirmed it failed before the Skill files existed.
- [x] (2026-05-14 02:07Z) Added `canonical/skills/assistant-extension-advisor/SKILL.md`.
- [x] (2026-05-14 02:07Z) Added `canonical/skills/assistant-extension-advisor/references/claude-howto-extension-map.md`.
- [x] (2026-05-14 02:07Z) Added a short router note to `canonical/CLAUDE.md`.
- [x] (2026-05-14 02:07Z) Fixed Setup Wizard Skill discovery to recurse into nested support-file directories after the Codex dry run exposed that nested `references/` files were treated as directories.
- [x] (2026-05-14 02:09Z) Ran focused tests, typecheck, Setup Wizard dry runs, full test suite, and diff checks. All passed.

## Surprises & Discoveries

- Observation: The existing Setup Wizard dynamically discovers `canonical/skills/<name>/...` and projects Skills into `.agents/skills/` for Codex. No Setup Wizard TypeScript change is needed for this first slice.
  Evidence: `src/setup/index.ts` calls `discoverSkillDirs(repoRoot)` and passes the result into `planCodexProjection`, which maps Skill files under `.agents/skills/`.

- Observation: `discoverSkillDirs` only listed direct children before this implementation. A nested `references/` directory was returned as a file-like entry, causing `npm run setup -- --codex --default --dry-run` to fail with `EISDIR: illegal operation on a directory, read`.
  Evidence: The dry-run output printed `regenerate .agents/skills/assistant-extension-advisor/references from canonical/skills/assistant-extension-advisor/references`, then failed while reading a directory.

## Decision Log

- Decision: Add an advisory Skill rather than a new Installation Manifest kind.
  Rationale: The request is to make `claude-howto` inform future decisions, not to fetch or install `claude-howto` as an External Source. A Skill is the narrowest existing mechanism for reusable decision guidance.
  Date/Author: 2026-05-14 / Codex

- Decision: Use `user-invocable: false`.
  Rationale: The Skill should inform future assistant work automatically when relevant rather than adding another user-facing slash command.
  Date/Author: 2026-05-14 / Codex

- Decision: Keep exact Claude Code schema claims conservative and source-backed.
  Rationale: `claude-howto` is a useful local reference but may lag official docs. The Skill should say to refresh official Claude Code docs before encoding hard schema details.
  Date/Author: 2026-05-14 / Codex

- Decision: Make a minimal Setup Wizard discovery fix despite the original v1 assumption of no TypeScript changes.
  Rationale: The planned reference file path is nested under `references/`, and the existing discovery path could not project or package nested Skill support files. Recursing with the existing `walkDir` helper preserves the intended Canonical Assistant Source shape and does not alter manifest, schema, or fetch behavior.
  Date/Author: 2026-05-14 / Codex

## Outcomes & Retrospective

Implementation is complete. The first red test failed for missing files, which matched the intended TDD cycle. The Skill, reference map, router note, and recursive Skill support-file discovery are present. Verification passed: focused advisory test, planned projection/artifact/integration tests, full test suite, typecheck, both Setup Wizard dry runs, and `git diff --check`.

The one material deviation from the initial plan is the `src/setup/index.ts` discovery fix. It was necessary because the planned nested `references/` file exposed a pre-existing gap in Skill support-file discovery. The fix is additive and applies to all Skills with nested support files.

## Code Review Findings

Populated after code review.

### High Risk

### Medium Risk

### Low Risk

## Context and Orientation

The Canonical Assistant Source is `canonical/`, the directory edited directly and used to generate assistant-specific projections. The Setup Wizard is the interactive and flag-driven installer invoked with `npm run setup`. It turns selected Assistant Targets and Toolkit Components into installed Assistant Payloads. An Assistant Target is a supported assistant runtime that the toolkit can configure. A Toolkit Component is a user-selectable part of the toolkit that can be included in an Assistant Payload.

Current source guidance lives in `canonical/CLAUDE.md` and `canonical/CONTEXT.md`. The project Lexicon lives in `CONTEXT.md` and defines terms such as Skill, Plugin, Installation Manifest, Setup Wizard, External Source, MCP Server, Next Steps, and Target Projection. Skills live under `canonical/skills/<skill-name>/SKILL.md`; supporting reference files can live beside the Skill and are projected automatically.

The local reference repository is `/Users/cdbrooks/Development/Software/Repositories/claude-howto`. Its relevant areas are `03-skills/`, `06-hooks/`, `07-plugins/`, and `05-mcp/`. Use it as example-driven guidance, not as authoritative source code to copy. Official Claude Code docs should be refreshed before preserving exact schema details.

## Architecture Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Delivery mechanism | Advisory Skill | Existing mechanism for reusable, on-demand decision guidance. |
| Invocation | `user-invocable: false` | Automatic advisory behavior without a user-facing command. |
| Reference shape | One compact reference file | Keeps `SKILL.md` short and preserves Progressive Disclosure. |
| Setup Wizard code | Recursive Skill-file discovery only | Required because nested `references/` files were previously treated as directories. |

Progressive Disclosure means revealing detail only when it becomes relevant. Here it means `SKILL.md` stays small, while the longer `claude-howto` map is loaded only when the Skill needs it.

## File Changes

### New Files

- `feature_requests/claude-howto-extension-advisor-plan.md` - this source-of-record ExecPlan.
- `canonical/skills/assistant-extension-advisor/SKILL.md` - advisory Skill instructions.
- `canonical/skills/assistant-extension-advisor/references/claude-howto-extension-map.md` - compact mapping from `claude-howto` guidance to toolkit decisions.
- `tests/setup/assistant-extension-advisor.test.ts` - behavior-focused content test for the new Skill.

### Modified Files

- `canonical/CLAUDE.md` - add one router note telling future assistants to consult the advisory Skill when extension work is in scope.
- `src/setup/index.ts` - make Skill discovery recurse into nested support-file directories for projection and Skill Artifact planning.

### Deleted Files

- None.

## Data & API Changes

No data or API changes. `manifests/install.yaml`, `ExternalSourceKind`, schema, and fetch behavior are unchanged. The only Setup Wizard TypeScript change is recursive Skill support-file discovery in `src/setup/index.ts`, required for the planned nested `references/claude-howto-extension-map.md` file.

## Plan of Work

First, add a focused test that fails until the advisory Skill and reference map exist. The test should verify the public content contract: the Skill is named `assistant-extension-advisor`, is automatic-only with `user-invocable: false`, mentions the extension surfaces it advises on, and points to `references/claude-howto-extension-map.md`. The same test should verify the reference map contains the decision rules for Skill, Plugin, hook script, MCP Server, local plugin testing, security, and Next Steps.

Second, create the Skill under `canonical/skills/assistant-extension-advisor/`. The `SKILL.md` body should be short and directive. It should tell the assistant to load the reference map before making or reviewing extension decisions, use the project Lexicon terms, treat `claude-howto` as examples rather than canonical code, and refresh official Claude Code docs before locking exact schema details.

Third, create the reference map. It should summarize the useful local `claude-howto` paths and translate them into this repository's decision rules. It should explicitly state: use a Skill for one reusable workflow, a Plugin for bundled multi-component distribution, a hook script for event-triggered side effects, an MCP Server for live external tool or data access, and Next Steps for actions the Setup Wizard should surface but not execute.

Fourth, add one short router note to `canonical/CLAUDE.md` near the workflow guidance. It should only route future assistants to the Skill and must not duplicate the reference map.

Fifth, make `discoverSkillDirs` in `src/setup/index.ts` use the existing recursive `walkDir` helper. Return relative file paths such as `references/claude-howto-extension-map.md`, filter hidden path segments, and sort the list for deterministic projection and artifact planning.

## Concrete Steps

Run commands from `/Users/cdbrooks/Development/Software/Repositories/toolkit`.

1. Add the focused test, then run:

       npx vitest run tests/setup/assistant-extension-advisor.test.ts

   Expected before implementation: the test fails because the Skill files do not exist.

2. Add the canonical Skill, reference map, and router note.

3. Run:

       npx vitest run tests/setup/assistant-extension-advisor.test.ts

   Expected after implementation: the test passes.

4. Run the planned checks:

       npx vitest run tests/setup/projection.test.ts tests/setup/artifacts.test.ts tests/setup/integration.test.ts
       npm run typecheck
       npm run setup -- --codex --default --dry-run
       npm run setup -- --claude --default --dry-run

   The Codex dry run should print `regenerate .agents/skills/assistant-extension-advisor/SKILL.md` and the reference file. The Claude dry run should show planned Skill Artifact output including `assistant-extension-advisor.zip`.

Observed verification on 2026-05-14:

       npx vitest run tests/setup/assistant-extension-advisor.test.ts
       # 1 file passed, 3 tests passed

       npx vitest run tests/setup/projection.test.ts tests/setup/artifacts.test.ts tests/setup/integration.test.ts
       # 3 files passed, 23 tests passed

       npm run typecheck
       # tsc --noEmit passed

       npm test
       # 18 files passed, 119 tests passed

       npm run setup -- --codex --default --dry-run
       # printed regenerate .agents/skills/assistant-extension-advisor/SKILL.md
       # printed regenerate .agents/skills/assistant-extension-advisor/references/claude-howto-extension-map.md
       # printed [planned] assistant-extension-advisor.zip (2 file(s))

       npm run setup -- --claude --default --dry-run
       # printed [copy] ~/.claude/skills/assistant-extension-advisor/SKILL.md
       # printed [copy] ~/.claude/skills/assistant-extension-advisor/references/claude-howto-extension-map.md
       # printed [planned] assistant-extension-advisor.zip (2 file(s))

       git diff --check
       # passed with no output

## Validation and Acceptance

Acceptance is met when the new advisory Skill exists in the Canonical Assistant Source, its reference map captures the `claude-howto` decision guidance, the router note points future assistants to it, and the Setup Wizard dry runs prove projection and Skill Artifact planning.

The generated `.codex/` and `.agents/` files may change during dry-run verification because this Setup Wizard regenerates Target Projections before planning writes. Those generated files should be reviewed and kept only if they are part of the expected projection proof.

### Manual Verification Steps

1. Open `canonical/skills/assistant-extension-advisor/SKILL.md` and verify it is concise and points to `references/claude-howto-extension-map.md`.
2. Open `canonical/skills/assistant-extension-advisor/references/claude-howto-extension-map.md` and verify the decision rules cover Skills, Plugins, hook scripts, MCP Servers, local plugin testing, security, and Next Steps.
3. Run `npm run setup -- --codex --default --dry-run` and confirm the new Skill appears under `.agents/skills/assistant-extension-advisor/`.
4. Run `npm run setup -- --claude --default --dry-run` and confirm `assistant-extension-advisor.zip` appears in the Skill Artifact planning output.

## Testing Plan

### Unit Tests

- `tests/setup/assistant-extension-advisor.test.ts` checks the content contract of the new advisory Skill, reference map, and nested support-file discovery.
- Existing projection and artifact tests confirm the dynamic projection path still works.

### Integration Tests

- Existing setup integration tests cover payload assembly and projection behavior.

### E2E Tests

- No browser or UI E2E tests are needed. Manual Setup Wizard dry runs are the acceptance path.

## Idempotence and Recovery

This change is additive. Re-running Setup Wizard dry runs is safe. If generated projection files change unexpectedly, inspect `git diff` and keep only expected `.agents/skills/assistant-extension-advisor/` projection changes. Do not touch the pre-existing unrelated modification in `canonical/hooks/canonical-sync.sh`.

## Artifacts and Notes

Official docs refreshed during planning:

- Claude Code Skills docs: `https://code.claude.com/docs/en/skills`
- Claude Code Hooks docs: `https://code.claude.com/docs/en/hooks`
- Claude Code Plugins docs: `https://code.claude.com/docs/en/plugins`
- Claude Code Plugin Marketplaces docs: `https://code.claude.com/docs/en/plugin-marketplaces`
- Claude Code MCP docs: `https://code.claude.com/docs/en/mcp`

## Interfaces and Dependencies

No new runtime dependencies. Use existing Markdown files and existing Setup Wizard projection behavior. Skill discovery now walks nested support-file directories recursively. The new public interface is the Skill directory:

    canonical/skills/assistant-extension-advisor/
      SKILL.md
      references/claude-howto-extension-map.md
