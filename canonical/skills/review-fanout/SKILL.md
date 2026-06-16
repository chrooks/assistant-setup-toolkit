---
name: review-fanout
description: "Concurrent read-only code review fan-out with actionable concern synthesis and fix-forward routing."
origin: ECC
---

# Review Fan-Out Skill

Run a concurrent, read-only review of the current change set and synthesize the
results into a short list of actionable concerns. Use this Skill manually when
the user asks for a parallel review, or from `/verification-loop` after the core
verification phases complete.

## When to Use

Invoke this Skill:
- When the user asks for concurrent, parallel, or multi-reviewer code review
- From `/verification-loop` after the code report offer
- Before a PR when implementation risk is higher than a single local review can
  comfortably cover
- After a refactor that changed ownership, tests, security behavior, or public
  behavior

## Inputs

Collect or infer:
- Diff scope: current worktree by default, including tracked and untracked files
- Verification evidence: build, type check, lint, test, security, and diff
  results when available
- User-stated risk focus, if any
- Any files, behaviors, or assumptions the user specifically wants challenged
- Design context, if any: a UI-touched signal or design brief forwarded from
  `/implement` or `/verification-loop` (e.g. the original `/impeccable` intent).
  Treat it as a booster that turns the design path on — never the only trigger.

If invoked from `/verification-loop`, reuse that Skill's diff scope and
verification evidence instead of recomputing them unless the evidence is stale.

## Diff Scope

Use these commands when a scope is not already supplied:

```bash
git status --short --untracked-files=all
git diff HEAD --stat
git diff HEAD --check
git diff HEAD
git ls-files --others --exclude-standard
```

Review every untracked file directly, or use `git diff --no-index` against
`/dev/null` for a patch-style view of a new single file.

## Design Diff Detection

After scoping the diff, decide whether the change touches the UI. Set
`uiTouched` when either is true:

- Any changed or untracked file matches a UI extension:
  `.tsx`, `.jsx`, `.vue`, `.svelte`, `.astro`, `.html`, `.css`, `.scss`.
- A design brief or UI-touched hint was forwarded from `/implement` or
  `/verification-loop`.

`uiTouched` gates the design review path below. When it is false, skip that path
silently — it is not a finding.

## Review Paths

Launch these paths concurrently when available:
- `code-reviewer` agent via ECC, focused on defects, security, maintainability,
  and missing tests.
- `/improve-codebase-architecture`, in review-only mode, focused on deepening
  opportunities, locality, leverage, and testability.
- `/codex:adversarial-review`, focused on challenging the implementation
  approach, design choices, tradeoffs, and assumptions.
- **Design critique** — run only when `uiTouched` (see Design Diff Detection).
  Run the lightweight deterministic detector over the changed markup:

  ```bash
  npx impeccable detect --json <changed .tsx/.jsx/.vue/.svelte/.astro/.html files or their dirs>
  ```

  Pass `--fast` when 200+ files are in scope. Exit `0` is clean, `2` means
  findings — read the JSON either way. This path is source-only: never launch a
  browser or headless Chrome. If only CSS/SCSS changed (no markup), the detector
  has nothing to scan — skip it and note the style-only diff as residual risk.
  If `npx impeccable` is unavailable, skip with the same note rule below.

Rules:
- Run available review paths in parallel where the assistant runtime supports
  it.
- Keep every review path read-only. Do not apply patches during review fan-out.
  The design critique detector is read-only; the matching `/impeccable` refine
  commands run later, in fix-forward, never here.
- Give every path the same diff scope, verification evidence, and risk focus.
- If one path is unavailable, say which one was skipped and continue with the
  available reviewers.
- Wait for available review results before synthesis unless the user explicitly
  chooses background-only review.

## Concern Synthesis

Deduplicate overlapping findings and list only concerns that are concrete enough
to act on. Prefer a short list of high-signal issues over exhaustive noise.

Fold design-detector findings into the same concern list — do not report them as
a separate review. Map each detector finding to a `Difficulty` and tag it as a
design concern so fix-forward can route it to `/impeccable`.

Use this exact shape for each synthesized concern:

```markdown
- **Issue:** [/caveman ultra synopsis]
  **Fix:** [How we can fix it]
  **Difficulty:** [Trivial|Simple|Moderate|Hard|Risky]
```

Difficulty values:
- `Trivial`: mechanical one-line or copy-only fix
- `Simple`: localized change with obvious tests
- `Moderate`: several files or behavior paths, still well-scoped
- `Hard`: broad design impact or unclear integration risk
- `Risky`: data loss, security, migration, or production-behavior risk

If review produces no actionable concerns, say so directly and name any residual
risk or unrun verification.

## Fix-Forward Offer

After concern synthesis, offer the next workflow based on the concern shape:
- Offer `/tdd` when the fix is a planned behavior change, testable logic, or
  missing test coverage.
- Offer `/diagnose` when the issue is a failing check, unclear root cause,
  regression, flaky behavior, or hard-to-reproduce bug.
- Offer `/impeccable` (a refine command — `polish`, `layout`, `harden`,
  `clarify`, etc.) when the concern is a design issue from the design critique:
  hierarchy, spacing, typography, color, copy, states, or an AI-slop tell.

Do not start `/tdd`, `/diagnose`, or `/impeccable` unless the user asks you to
proceed.

## Output Format

```markdown
REVIEW FAN-OUT REPORT
=====================

Scope:
[Diff scope reviewed]

Review Paths:
- code-reviewer: [completed / skipped: reason]
- /improve-codebase-architecture: [completed / skipped: reason]
- /codex:adversarial-review: [completed / skipped: reason]
- design critique (impeccable detect): [completed / skipped: not UI / unavailable]

Concerns:
- **Issue:** ...
  **Fix:** ...
  **Difficulty:** ...

Residual Risk:
[Any unreviewed area, unavailable path, or unrun verification]

Next Workflow:
[/tdd recommended | /diagnose recommended | /impeccable recommended | none]
```
