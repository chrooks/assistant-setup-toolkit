# Development Workflow

> This file extends [common/git-workflow.md](./git-workflow.md) with the full feature development process that happens before git operations.

The Feature Implementation Workflow describes the development pipeline: research, planning, TDD, code review, and then committing to git.

## Feature Implementation Workflow

0. **Research & Reuse** _(mandatory before any new implementation)_
   - **GitHub code search first:** Run `gh search repos` and `gh search code` to find existing implementations, templates, and patterns before writing anything new.
   - **Library docs second:** Use Context7 or primary vendor docs to confirm API behavior, package usage, and version-specific details before implementing.
   - **Web search last:** reach for broader web research or discovery only after GitHub search and primary docs come up short.
   - **Check package registries:** Search npm, PyPI, crates.io, and other registries before writing utility code. Prefer battle-tested libraries over hand-rolled solutions.
   - **Search for adaptable implementations:** Look for open-source projects that solve 80%+ of the problem and can be forked, ported, or wrapped.
   - Prefer adopting or porting a proven approach over writing net-new code when it meets the requirement.

1. **Plan First**
   - Route through `/scope` — it decides whether to `/implement` directly, `/plan` an ExecPlan, or `/grill-me` first
   - Identify dependencies and risks
   - Break down into phases

2. **TDD Approach**
   - Use the `/tdd` skill
   - Write tests first (RED)
   - Implement to pass tests (GREEN)
   - Refactor (IMPROVE)

3. **Code Review**
   - Use `/code-review` (or `/review-fanout` for larger diffs) immediately after writing code
   - Address CRITICAL and HIGH issues
   - Fix MEDIUM issues when possible

4. **Commit & Push**
   - Detailed commit messages
   - Follow conventional commits format
   - See [git-workflow.md](./git-workflow.md) for commit message format and PR process

5. **Pre-Review Checks**
   - Verify all automated checks (CI/CD) are passing
   - Resolve any merge conflicts
   - Ensure branch is up to date with target branch
   - Only request review after these checks pass

## Proof Before Done

Work that changes runtime behavior is done only when the affected flow has been driven for real — UI changes get driven in a browser (`/verify`; Playwright screenshot or assertion). A compile, lint, or unit-test pass is not proof.

- Applies equally to subagent-returned work: never relay an agent's "done" without driving the flow first.
- Lead the completion report with the proof, then the change detail.

Case: ~12 "I don't see it / still broken" corrections in one Cornerstone cycle (2026-07 loop audit).

## Close the Loop

After completing a unit of work, proactively do (or offer in one line) the capture pass — do not wait to be asked:

- **Tracker**: update the issue being worked, create issues for side ideas, close what's verified (`/to-issues`).
- **Docs**: update runbooks/docs in docs repos when the work changed how something operates.
- **Memory**: save non-obvious learnings that will matter next session.
