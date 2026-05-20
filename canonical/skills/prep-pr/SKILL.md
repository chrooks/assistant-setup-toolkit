---
name: prep-pr
description: Prepare a pull request for human review by creating or finding the PR, running review-fanout, posting review feedback, fixing actionable concerns, pushing commits, and updating the PR. Use when the user asks to prep a PR, ready a PR, run a PR review loop, review-fanout a PR, or fix-forward from PR feedback.
argument-hint: "[base-branch]"
disable-model-invocation: false
allowed-tools: Read, Edit, Bash, Grep, Glob
---

# Prep PR

Prepare a pull request for human review:

1. Create or find the PR.
2. Run `/review-fanout`.
3. Post review feedback as PR comments.
4. Fix actionable concerns.
5. Push commits and update the PR.
6. Link the PR for human review.

## Inputs

Parse arguments positionally from the user's invocation (works on both Claude Code and Codex CLI — do not rely on `$ARGUMENTS` substitution alone):

- First token = base branch override (matches `argument-hint: "[base-branch]"`). Default `main` if absent.

Then infer or collect:

- Current branch and whether it is suitable for a PR.
- PR state: existing PR for the current branch or new PR needed.
- Review scope: default diff from base branch to current branch.
- Verification evidence: tests, lint, build, type checks, diff checks.

## Preconditions

Before creating or updating a PR:

1. Run:

   ```bash
   git status --short --branch --untracked-files=all
   git branch --show-current
   git rev-parse --abbrev-ref --symbolic-full-name @{u}
   gh auth status
   ```

2. If the current branch is `main`, `master`, or otherwise not a sensible PR branch, stop and ask the user whether to create a new branch.

3. If there are uncommitted changes, decide whether they belong in the PR:
   - If yes, use the project commit workflow or `/commit`.
   - If unclear, ask the user.
   - Do not stash or discard user changes unless explicitly asked.

4. Push the branch before PR creation:

   ```bash
   git push -u origin HEAD
   ```

## Create Or Find PR

1. Check for an existing PR:

   ```bash
   gh pr view --json number,title,url,state,baseRefName,headRefName
   ```

2. If no PR exists, create one:

   ```bash
   gh pr create --base main --head "$(git branch --show-current)" --title "<title>" --body "<body>"
   ```

3. PR body should include:
   - Summary
   - Verification
   - Review-fanout status when available

## Review-fanout

Invoke `/review-fanout` with:

- Diff scope: `git diff <base>...HEAD`
- Verification evidence already collected
- Any user-stated risk focus
- Any files or assumptions that deserve challenge

Review paths must remain read-only. Do not fix while reviewers are running.

## Post Review Feedback

After `/review-fanout` returns:

1. Post one PR comment with the report:

   ```bash
   gh pr comment <number> --body-file <report-file>
   ```

2. If a concern points to a precise changed file and line, optionally add inline review comments with:

   ```bash
   gh pr review <number> --comment --body "<summary>"
   ```

Prefer one clear summary comment when line-level comments would be noisy or the exact changed line is unstable.

## Fix Concerns

For each actionable concern:

1. Decide the right workflow:
   - Use `/tdd` for testable behavior changes or missing coverage.
   - Use `/diagnose` for failing checks or unclear root cause.
   - Use a focused direct fix for small mechanical concerns.

2. Implement only the concerns that are concrete enough to act on.

3. Add or update tests where behavior changed.

4. Run targeted verification first, then broader verification when risk warrants it.

## Update PR

After fixes:

1. Commit the fix-forward changes:

   ```bash
   git diff --check
   git add <paths>
   git commit -m "<type>(<scope>): <summary>"
   ```

2. Push:

   ```bash
   git push
   ```

3. Update PR body:

   ```bash
   gh pr edit <number> --body "<updated body>"
   ```

4. Add a PR comment summarizing fixes:

   ```bash
   gh pr comment <number> --body "<fix summary and verification>"
   ```

## Final Response

Return exactly this Markdown shape (omit empty bullets, do not add prose around it):

```md
- **PR:** <url>
- **Review-fanout comment:** <url>
- **Fix-forward commits:** <sha1>, <sha2>
- **Verification:** <one-line summary of runs + pass/fail>
- **Residual risk / blocked:** <none | text>
```

Keep the final response short and human-review oriented.
