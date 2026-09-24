# Git Workflow

## Branching — solo-dev default

The user works solo in almost every repo. **Commit directly to `main`. No feature branches, no PRs.**

- Branches and PRs coordinate people. Solo, they are only friction.
- Commit hygiene protects future work, not branches. Keep each commit to one logical scope; `/commit` splits mixed work. Scoped commits make `git bisect`, `git revert`, and `git log` useful.
- Review the diff yourself (`/code-review`) before you push.

**Branch only for these cases:**
- **Mechanical isolation:** parallel agents or worktrees that would collide on `main`.
- **Deploy gate:** a repo that auto-deploys from `main`. Prefer release tags on `main` over a long-lived `develop` branch.
- **Throwaway experiment** you expect to delete. `git stash` is often lighter.

Do not push the user toward branches or PRs outside these cases.

## Push discipline

- **Push after every commit.** The user works on several devices, and an unpushed commit is invisible on the next one.
- When the user says they are **switching computers**: commit, push, and leave a pointer to the next piece of work (a tracker-issue note or `/handoff`).

## Commit message format
```
<type>: <description>

<optional body>
```

Types: feat, fix, refactor, docs, test, chore, perf, ci. Attribution is disabled globally in `~/.claude/settings.json`.

## Pull requests

Only for the branch cases above. Read the full commit history (`git diff <base>...HEAD`), write a full summary with a test plan, and push a new branch with `-u`.
