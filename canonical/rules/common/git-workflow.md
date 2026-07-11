# Git Workflow

## Branching — Solo-Dev Default

Chris works solo in almost every repo. **Default: commit directly to `main`. No feature branches, no PRs.**

- Branches and PRs exist mostly to coordinate multiple people — that value is absent solo, so the ceremony is pure friction.
- The thing that actually protects future-you is **commit hygiene, not branches.** Keep each commit one logical scope; `/commit` splits mixed work — lean on it. Every future-regret scenario (`git bisect`, clean `git revert`, readable `git log`/blame, auto-changelog) is solved by scoped commits, none by branches.
- Self-review the diff (`/code-review`) before pushing instead of using a PR as the gate.

**Branch only for these real cases:**
- **Mechanical isolation** — parallel agents / worktrees (devfleet) that would otherwise collide on `main`.
- **Deploy gate** — once a repo auto-deploys from `main` and you don't want half-done work shipping. Prefer **release tags on `main`** over a long-lived `develop` branch unless a true staging/prod split exists.
- **Throwaway experiment** you expect to delete wholesale (`git stash` is often lighter).

Do NOT nudge Chris toward branches or PRs outside these cases.

## Push Discipline

- **Push after every commit by default** — Chris works across multiple devices; an unpushed commit is invisible on the next machine.
- When Chris says he is **switching computers**: commit, push, and leave a durable pointer to the next piece of work (a note on the relevant tracker issue, or `/handoff`) so the other machine's session can pick up cold.

## Commit Message Format
```
<type>: <description>

<optional body>
```

Types: feat, fix, refactor, docs, test, chore, perf, ci

Note: Attribution disabled globally via ~/.claude/settings.json.

## Pull Request Workflow

Only relevant for the branch cases above (deploy-gated repos, or collaborative repos) — not solo `main` work. When creating PRs:
1. Analyze full commit history (not just latest commit)
2. Use `git diff [base-branch]...HEAD` to see all changes
3. Draft comprehensive PR summary
4. Include test plan with TODOs
5. Push with `-u` flag if new branch

> For the full development process (planning, TDD, code review) before git operations,
> see [development-workflow.md](./development-workflow.md).
