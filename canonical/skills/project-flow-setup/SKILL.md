---
name: project-flow-setup
description: Configure a repository for the project-flow workflow by auditing repo-local docs and GitHub setup, writing workflow docs from templates, and applying issue, milestone, label, and Project setup. Use when adopting /to-issues and /roadmap or when project-flow docs are missing.
argument-hint: "[audit|docs|apply] [repo]"
disable-model-invocation: true
---

# Project Flow Setup

`/project-flow-setup` configures a repository so the project-management Skills share the same local Contract.

## Boundary

- `/project-flow-setup` configures a repository for the workflow.
- `/to-issues` creates, updates, and closes issue records.
- `/roadmap` chooses, prioritizes, sequences, and reshapes work.
- `/scope` decides whether to implement, plan, or grill.
- `/implement` implements selected ready work.
- `/verification-loop` proves the work.
- `/prep-pr` packages the final diff for review or PR.

Do not use this Skill to decide the next work item, create issue records from product plans, implement code, close issues, or prepare a PR. Route those actions to the owning Skill.

## Invocation Forms

Parse arguments positionally.

- Bare `/project-flow-setup` -> guided setup. Audit, then write the missing docs and apply the missing GitHub setup, then recommend the next workflow command.
- `/project-flow-setup audit [repo]` -> read-only inspection and report.
- `/project-flow-setup docs [repo]` -> write or update repo-local workflow docs from bundled templates.
- `/project-flow-setup apply [repo]` -> inspect GitHub setup, then create the missing labels, milestones, and Project fields. See the Approval Boundary in Apply Mode.

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
3. Write any missing `docs/agents/` file from the templates.
4. If the repo is GitHub-backed, inspect labels, milestones, and Projects.
5. Apply the missing GitHub setup per the Approval Boundary in Apply Mode.
6. Report what was done and what still needs the human.
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

Always name `project`, never `read:project`. `read:project` lists Projects but cannot create one or set its fields, so recommending it costs a second round trip — the exact human interruption this Skill exists to avoid.

Audit mode must not write files and must not mutate GitHub.

## Docs Mode

Write repo-local docs from the bundled templates.

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

GitHub Project field mutation requires Project IDs, item IDs, and field IDs. Discover the IDs and apply the field changes; report the IDs used.

Do not assume a stable native `gh` sub-issue command. Prefer native sub-issues only if the project guidance provides a proven command. Otherwise use normal issue records with a `Parent` section and a parent issue comment.

### Label taxonomy reconciliation

Reconcile labels without asking. The `type:` prefixed family is the taxonomy the Skills read; GitHub's stock labels are not.

1. Create every missing label from `templates/triage-labels.md`.
2. Migrate stock labels onto their `type:` equivalent, then delete the stock label — `enhancement` → `type:feature`, `bug` → `type:bug`, `documentation` → `type:docs`. Migrate across `--state all` so closed issues keep their taxonomy.
3. Delete the remaining unused GitHub defaults (`good first issue`, `help wanted`, `invalid`, `question`, `wontfix`, `duplicate`) unless issues currently carry them.

A label carrying no issues is a free delete. One that does gets migrated first. Neither is a question worth asking.

### Approval boundary

Setting up project flow is plumbing, not a design decision. Run it to completion.

**Apply without asking:** creating labels, writing `docs/agents/` files, label reconciliation above, creating a Project or its fields, adding milestones the user named.

**Stop and ask:** deleting a label that still carries issues and has no `type:` equivalent, closing or deleting issue records, anything touching a remote other than `origin`, and any command needing an auth scope the token lacks — surface the exact `gh auth refresh -s <scope>` line, since only the human can run it.

## Output Shape

For guided and audit modes, respond with:

```text
Project-flow setup read:
- Docs: project-flow missing, issue-tracker present, triage-labels missing
- GitHub: labels present, milestones missing, Project needs project auth scope
- Recommended next: /project-flow-setup docs
```

For apply mode, report what was done, not what is proposed:

```text
Project-flow setup applied:
- Labels: created type:feature, type:bug, needs-scope; migrated 10 issues off `enhancement`; deleted 9 stock labels
- Project fields: Status, Priority, Size, Mode created
- Milestones: none (none named)
- Needs you: gh auth refresh -s read:project
- Recommended next: /roadmap next
```

List anything the human must run under a `Needs you:` line. Keep it to commands only they can execute.

## Rules

- Use repo-local `CONTEXT.md` Lexicon terms when present.
- Prefer repo-local docs over defaults once they exist.
- Run setup to completion; gate only what the Approval Boundary names.
- Keep this Skill setup-focused. Route operational work to `/to-issues`, `/roadmap`, `/scope`, `/implement`, `/verification-loop`, or `/prep-pr`.
