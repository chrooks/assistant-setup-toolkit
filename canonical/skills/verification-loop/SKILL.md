---
name: verification-loop
description: "Comprehensive post-change verification with optional explanatory reporting and delegated review fan-out."
origin: ECC
---

# Verification Loop Skill

A comprehensive verification system for coding sessions. Use it after code
changes to prove the work, explain what changed, and optionally delegate
parallel review to `/review-fanout` before deciding whether to fix forward with
`/tdd` or `/diagnose`.

## When to Use

Invoke this Skill:
- After completing a feature or significant code change
- Before creating a PR
- After refactoring
- When quality gates or user-facing behavior need a final check

## Verification Phases

Run the phases that match the project. Prefer project scripts from `AGENTS.md`,
`package.json`, `pyproject.toml`, or nearby documentation over generic commands.

### Phase 1: Build Verification

```bash
npm run build
# OR
pnpm build
```

If the build fails, stop the verification run, mark the work `NOT READY`, and
recommend the next workflow. Only fix immediately when the current user request
already authorizes repair work.

### Phase 2: Type Check

```bash
# TypeScript projects
npx tsc --noEmit

# Python projects
pyright .
```

Report all type errors. If critical errors remain, mark the work `NOT READY`
and recommend the next workflow. Only fix immediately when the current user
request already authorizes repair work.

### Phase 3: Lint Check

```bash
# JavaScript/TypeScript
npm run lint

# Python
ruff check .
```

### Phase 4: Test Suite

```bash
npm test
```

Report:
- Total tests: X
- Passed: X
- Failed: X
- Coverage: X%, if available

### Phase 5: Security Scan

Use the project's security tooling when present. If none exists, do a focused
manual pass over the diff for:
- Secrets, API keys, tokens, credentials, or private URLs
- Unsafe user-input handling
- Missing auth, permission, or ownership checks
- New logs that expose sensitive data
- Dependency or script changes that alter trust boundaries

### Phase 6: Diff Review

```bash
git status --short --untracked-files=all
git diff HEAD --stat
git diff HEAD --check
git ls-files --others --exclude-standard
```

Review each changed file for:
- Unintended changes
- Missing error handling
- Potential edge cases
- Missing or mismatched tests
- Drift from the project's `CONTEXT.md` Lexicon

Diff coverage rules:
- `git diff HEAD` covers staged and unstaged tracked files.
- `git ls-files --others --exclude-standard` lists untracked files that diff
  commands do not include.
- Review every untracked file directly, or use `git diff --no-index` against
  `/dev/null` for a patch-style view of a new single file.

## Explain-Style Code Report Offer

After the core verification phases, ask the user whether they want an
`/explain`-style code report for the code that was written.

If they accept, use the `/explain` Skill's three-layer shape and adapt it to the
diff:

```markdown
## Code report, explained

[1-2 paragraphs in human language: what changed, why it matters, and how to see
it working.]

### Analogy
[A structurally accurate analogy that maps the changed parts to the analogy.]

### Caveman
[A terse ASCII or arrow-flow summary, scannable in 5 seconds.]
```

Keep the report source-faithful:
- Ground it in the actual diff, tests, and user-visible behavior.
- Correct Lexicon misuse or missing established terms from `CONTEXT.md` briefly.
- Do not add speculative benefits that the code does not deliver.

## Optional Review Fan-Out

After offering the code report, ask whether the user wants a concurrent review
fan-out.

If they accept, invoke `/review-fanout` with:
- The current diff scope
- The verification evidence from this run
- Any user-stated risk focus
- Any files, behaviors, or assumptions that need extra challenge

Paste the returned concern synthesis and next workflow recommendation into the
verification report. If they decline, mark review fan-out as declined.

## Fix-Forward Offer

After diff review or `/review-fanout` concern synthesis, offer the next workflow
based on the concern shape:
- Offer `/tdd` when the fix is a planned behavior change, testable logic, or
  missing test coverage.
- Offer `/diagnose` when the issue is a failing check, unclear root cause,
  regression, flaky behavior, or hard-to-reproduce bug.

Do not start `/tdd` or `/diagnose` unless the user asks you to proceed.

## Output Format

After running the selected phases, produce a verification report:

```markdown
VERIFICATION REPORT
===================

Build:     [PASS/FAIL/SKIPPED]
Types:     [PASS/FAIL/SKIPPED] (X errors)
Lint:      [PASS/FAIL/SKIPPED] (X warnings)
Tests:     [PASS/FAIL/SKIPPED] (X/Y passed, Z% coverage if available)
Security:  [PASS/FAIL/SKIPPED] (X issues)
Diff:      [X files changed]

Overall:   [READY/NOT READY] for PR

Issues to Fix:
1. ...
2. ...

Code Report Offer:
[Asked / accepted / declined / skipped]

Review Fan-Out:
[Asked / accepted / declined / skipped]

Next Workflow:
[/tdd recommended | /diagnose recommended | none]

Acceptance Criteria:
1. [Concrete thing user can verify manually — e.g., "run X and see Y"]
2. [Another checkable outcome]
3. ...
```

## Acceptance Criteria

After the verification report, list concrete acceptance criteria the user can
manually verify. Each criterion should be:

- **Observable** — the user can check it themselves without reading code.
- **Specific** — names the file, command, URL, or UI element to inspect.
- **Binary** — clearly passes or fails, no judgment calls.

Derive criteria from:
- What the user asked for in the original request.
- What files were created, changed, or deleted.
- What behavior changed (commands to run, pages to visit, outputs to compare).
- What tests were added and what they prove.

Keep the list short — 3 to 8 items. If the change is trivial (rename, config
tweak), 1-2 items is fine.

## Continuous Mode

For long sessions, run verification every 15 minutes or after major changes:

```markdown
Set a checkpoint:
- After completing each function
- After finishing a component
- Before moving to the next task
```

## Integration with Hooks

This skill complements PostToolUse hooks but provides deeper verification.
Hooks catch immediate issues; this skill provides comprehensive review,
explanatory reporting, and optional multi-reviewer synthesis.
