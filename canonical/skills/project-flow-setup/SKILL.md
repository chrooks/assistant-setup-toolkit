---
name: project-flow-setup
description: Configure a repository for the project-flow workflow by auditing repo-local docs and GitHub setup, writing workflow docs from templates, and proposing approval-gated issue, milestone, label, and Project setup. Use when adopting /to-issues and /roadmap or when project-flow docs are missing.
argument-hint: "[audit|docs|apply] [repo]"
disable-model-invocation: true
---

# Project Flow Setup

`/project-flow-setup` configures a repository so the project-management Skills share the same local Contract.

## Boundary

- `/project-flow-setup` configures a repository for the workflow.
- `/to-issues` creates, updates, and closes issue records.
- `/roadmap` chooses, prioritizes, sequences, and reshapes work.
- `/scope` decides whether to execute, plan, or grill.
- `/execute` implements selected ready work.
- `/verification-loop` proves the work.
- `/prep-pr` packages the final diff for review or PR.

Do not use this Skill to decide the next work item, create issue records from product plans, implement code, close issues, or prepare a PR. Route those actions to the owning Skill.

## Invocation Forms

Parse arguments positionally.

- Bare `/project-flow-setup` -> guided setup. Audit first, summarize missing pieces, offer docs, offer GitHub setup, wait for approval before each write or mutation, then recommend the next workflow command.
- `/project-flow-setup audit [repo]` -> read-only inspection and report.
- `/project-flow-setup docs [repo]` -> write or update repo-local workflow docs from bundled templates after approval.
- `/project-flow-setup apply [repo]` -> inspect GitHub setup, propose issue labels, milestones, and Project field changes, then wait for approval before applying them.

If no repo is provided, use the current working directory.

## Templates

Bundled templates live beside this Skill:

- [project-flow.md](./templates/project-flow.md)
- [issue-tracker.md](./templates/issue-tracker.md)
- [triage-labels.md](./templates/triage-labels.md)

Write them to these repo-local paths:

- `docs/agents/project-flow.md`
- `docs/agents/issue-tracker.md`
- `docs/agents/triage-labels.md`

Preserve user edits when updating existing docs. If a file has generated markers, replace only the generated block. Otherwise show a diff-style summary and ask before overwriting meaningful content.

## Guided Setup

Bare `/project-flow-setup` is the guided setup path.

1. Audit repo-local docs and GitHub setup.
2. Summarize what exists and what is missing.
3. If docs are missing, ask whether to write `docs/agents/project-flow.md`, `docs/agents/issue-tracker.md`, and `docs/agents/triage-labels.md`.
4. If the repo is GitHub-backed, ask whether to inspect labels, milestones, and Projects.
5. Propose GitHub setup changes as commands or explicit actions.
6. Do not mutate GitHub or local files without explicit approval.
7. End with the next useful workflow command: usually `/roadmap next`, `/to-issues <source>`, or `/scope <idea>`.

## Audit Mode

Use read-only checks.

Inspect:

- Project Lexicon: `CONTEXT.md`
- Workflow docs: `docs/agents/project-flow.md`, `docs/agents/issue-tracker.md`, `docs/agents/triage-labels.md`
- Git remote shape: `git remote -v`
- GitHub auth and host status: `gh auth status`
- Issue labels: `gh label list`
- Milestones: `gh api repos/:owner/:repo/milestones --paginate`
- Projects: `gh project list --owner <owner-or-org>`

If `gh project` reports missing scope, tell the user to run:

```bash
gh auth refresh -s project
```

Audit mode must not write files and must not mutate GitHub.

## Docs Mode

Write repo-local docs from the bundled templates after approval.

Use this mapping:

- `templates/project-flow.md` -> `docs/agents/project-flow.md`
- `templates/issue-tracker.md` -> `docs/agents/issue-tracker.md`
- `templates/triage-labels.md` -> `docs/agents/triage-labels.md`

After writing, summarize the docs created or updated and recommend `/roadmap next` when there are existing issue records, or `/to-issues <source>` when the repo still needs issue records.

## Apply Mode

Use GitHub only when the repo has a GitHub remote and `gh` is authenticated.

Propose setup for:

- Labels for issue taxonomy.
- Milestones for release or goal buckets.
- A GitHub Project board or table.
- Project fields for status, priority, size, and mode.

Recommended Project fields:

```text
Status: Inbox, Backlog, Ready, In Progress, Blocked, Review, Done
Priority: P0, P1, P2, P3
Size: XS, S, M, L
Mode: AFK, HITL
```

GitHub Project field mutation requires Project IDs, item IDs, and field IDs. Prefer reporting the exact discovered IDs and proposed commands before asking for approval.

Do not assume a stable native `gh` sub-issue command. Prefer native sub-issues only if the project guidance provides a proven command. Otherwise use normal issue records with a `Parent` section and a parent issue comment.

Do not mutate GitHub without explicit approval.

## Output Shape

For guided and audit modes, respond with:

```text
Project-flow setup read:
- Docs: project-flow missing, issue-tracker present, triage-labels missing
- GitHub: labels present, milestones missing, Project needs project auth scope
- Recommended next: /project-flow-setup docs
```

For apply mode, respond with:

```text
Proposed GitHub changes:
- Create missing labels: type:feature, type:bug, needs-scope
- Create or update Project fields: Status, Priority, Size, Mode
- Add starter milestones only if the user names them

Approval needed before running these commands.
```

## Rules

- Use repo-local `CONTEXT.md` Lexicon terms when present.
- Prefer repo-local docs over defaults once they exist.
- Keep GitHub operations approval-gated.
- Keep this Skill setup-focused. Route operational work to `/to-issues`, `/roadmap`, `/scope`, `/execute`, `/verification-loop`, or `/prep-pr`.
