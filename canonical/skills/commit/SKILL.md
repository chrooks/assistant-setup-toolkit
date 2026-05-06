---
name: commit
description: Stage and commit changes with a conventional commit message. Reviews the current diff and staged files, writes a commit message, and confirms before committing. Use when asked to commit, save changes, or create a git commit.
argument-hint: "[optional message hint or scope]"
disable-model-invocation: true
---

# Commit Workflow

## Current State

Branch: !`git branch --show-current`

Staged files:
!`git diff --cached --name-status`

Unstaged changes:
!`git diff --name-status`

Untracked files:
!`git ls-files --others --exclude-standard`

Full diff (staged + unstaged):
!`git diff HEAD`

Recent commits (for message style reference):
!`git log --oneline -5`

## Instructions

1. Review the diff above. If nothing is staged, determine what should be staged based on the unstaged/untracked files and stage them — but DO NOT stage: `.env`, `*.local`, secrets, or unrelated changes.

2. Write a conventional commit message:
   - Format: `<type>(<optional scope>): <description>`
   - Types: feat, fix, refactor, docs, test, chore, perf, ci
   - Keep the subject line under 72 characters
   - Add a body if the change needs context beyond the subject
   - If the user passed `$ARGUMENTS`, use it as a hint for the scope or message

3. Show the user:
   - Which files will be staged
   - The proposed commit message

4. STOP and ask for confirmation before running `git commit`.

5. On confirmation, commit. Report the commit hash when done.
