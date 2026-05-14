---
name: commit
description: "Stage and commit work with logical commit splitting, conventional commit messages, verification, and gitignore triage. Use when asked to commit, save changes, or create a git commit."
argument-hint: "[confirm] [message hint or scope]"
---

# Commit Workflow

Use this Skill to turn the current worktree into one or more clean commits.

## Current State

Branch and summary:
!`git status --short --branch`

Staged files:
!`git diff --cached --name-status`

Unstaged changes:
!`git diff --name-status`

Untracked files:
!`git ls-files --others --exclude-standard`

Ignored files summary:
!`git status --ignored --short`

Tracked diff:
!`git diff HEAD`

Staged whitespace check:
!`git diff --cached --check`

Recent commits (for message style reference):
!`git log --oneline -5`

## Instructions

1. Review every staged, unstaged, and untracked file before staging. If the worktree contains more than one logical scope of work, split the work into separate commits and handle one commit at a time. Do not mix unrelated changes just because they are present.

2. Decide the current commit set:
   - Prefer files that form one reviewable behavior, fix, refactor, doc update, test update, or tooling change.
   - Use `git add <path>` or `git add -p` so only that commit set is staged.
   - If unrelated files are already staged, unstage only those files and leave their contents intact.
   - Continue with additional commits for remaining scopes unless the user asked for only one.

3. Apply gitignore judgment before staging:
   - Never stage secrets, credentials, private keys, tokens, `.env`, `.env.*`, `*.local`, or machine-private settings.
   - Do not stage generated outputs, caches, dependency directories, build output, coverage output, local database files, or assistant runtime projections unless the user explicitly asks and the repo already treats them as source.
   - If an untracked file is durable source, test data, documentation, configuration, or a required template, commit it instead of hiding it.
   - If files should be local-only, update `.gitignore` with the narrowest durable pattern that matches them. If you change `.gitignore`, let the caller know exactly which pattern or entry changed.

4. Verify the staged commit set before committing:
   - Run `git diff --cached --check`.
   - Run the smallest project-relevant verification command when obvious from repo docs or package scripts.
   - If verification is too expensive or blocked, say what was skipped and why.

5. Write a conventional commit message:
   - Format: `<type>(<optional scope>): <description>`
   - Types: feat, fix, refactor, docs, test, chore, perf, ci
   - Keep the subject line under 72 characters
   - Add a body if the change needs context beyond the subject
   - If the user passed `$ARGUMENTS`, use it as a hint for the scope or message
   - Treat `confirm` in `$ARGUMENTS` as an option, not as message text

6. Commit behavior:
   - Default: Do not ask for message confirmation by default. Commit once the commit set is staged, verified, and the message is chosen.
   - `/commit confirm`: show the staged files and proposed message, then stop and ask before running `git commit`.

7. After each commit, report the commit hash, message, and files included. If additional logical scopes remain in the worktree, continue with the next commit set or clearly report what remains.
