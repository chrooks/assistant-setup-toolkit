---
name: project-flow-setup
description: Configure a repository for the project-flow workflow by auditing its GitHub setup and applying the missing issue, milestone, label, and Project setup. The workflow Contract lives in bundled defaults that /roadmap and /to-issues read in place; a repo only gets a docs/agents/ file when it deviates. Use when adopting /to-issues and /roadmap, when a repo has no type: labels, or when a repo needs to deviate from the default workflow.
argument-hint: "[audit|override|apply] [repo]"
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

- Bare `/project-flow-setup` -> guided setup. Audit, then apply the missing GitHub setup, then recommend the next workflow command. Writes no repo files.
- `/project-flow-setup audit [repo]` -> read-only inspection and report.
- `/project-flow-setup override [repo] [doc]` -> copy a bundled default into `docs/agents/` so the repo can deviate from it. Only on explicit request.
- `/project-flow-setup apply [repo]` -> inspect GitHub setup, then create the missing labels, milestones, and Project fields. See the Approval Boundary in Apply Mode.

If no repo is provided, use the current working directory.

## Defaults, and repo-local Overrides

The workflow Contract lives in three defaults bundled beside this Skill:

- [project-flow.md](./defaults/project-flow.md)
- [issue-tracker.md](./defaults/issue-tracker.md)
- [triage-labels.md](./defaults/triage-labels.md)

**These are read in place, not copied into repos.** `/roadmap` and `/to-issues` read them from the installed Skill at `~/.claude/skills/project-flow-setup/defaults/<name>.md`. A repo that follows the default workflow needs no repo-local doc at all.

A repo-local `docs/agents/<name>.md` is an **Override**: it shadows the default of the same name completely, and it stops tracking upstream changes to that default. Write one only when the repo genuinely deviates — a different issue tracker, a different label taxonomy, extra `gh` recipes. A file byte-identical to its default is pure duplication; delete it rather than maintain it.

## Guided Setup

Bare `/project-flow-setup` is the guided setup path.

1. Audit repo-local Overrides and GitHub setup.
2. Summarize what exists and what is missing.
3. If the repo is GitHub-backed, inspect labels, milestones, and Projects.
4. Apply the missing GitHub setup per the Approval Boundary in Apply Mode.
5. Report what was done and what still needs the human.
6. End with the next useful workflow command: usually `/roadmap next`, `/to-issues <source>`, or `/scope <idea>`.

Guided setup does not write `docs/agents/` files. The defaults already carry the Contract; a repo only earns a file when it deviates.

## Audit Mode

Use read-only checks.

Inspect:

- Project Lexicon: `LEXICON.md`
- Repo-local Overrides: any of `docs/agents/project-flow.md`, `docs/agents/issue-tracker.md`, `docs/agents/triage-labels.md` that exist
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

**Setup is "done" when the labels exist, not when a doc exists.** The presence of a `type:` label family is the signal — `gh label list --json name` returning no `type:` prefixed label means the repo has never been set up. A missing `docs/agents/` file means nothing; the default covers it.

Report any Override that is byte-identical to its bundled default as removable — it is duplication that will silently desync on the next Skill update.

Audit mode must not write files and must not mutate GitHub.

## Override Mode

`/project-flow-setup override [repo] [doc]` copies one bundled default into `docs/agents/` so the repo can deviate from it. Run it only when the user asks for an Override, or when they describe a deviation that needs one.

Use this mapping:

- `defaults/project-flow.md` -> `docs/agents/project-flow.md`
- `defaults/issue-tracker.md` -> `docs/agents/issue-tracker.md`
- `defaults/triage-labels.md` -> `docs/agents/triage-labels.md`

If no `doc` is named, ask which one deviates rather than writing all three.

Preserve user edits when updating an existing Override. If a file has generated markers, replace only the generated block. Otherwise show a diff-style summary and ask before overwriting meaningful content.

After writing, say in one line that the file now shadows its default and will not track upstream changes to it.

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

1. Create every missing label from `defaults/triage-labels.md`, or from the repo's Override of it when one exists.
2. Migrate stock labels onto their `type:` equivalent, then delete the stock label — `enhancement` → `type:feature`, `bug` → `type:bug`, `documentation` → `type:docs`. Migrate across `--state all` so closed issues keep their taxonomy.
3. Delete the remaining unused GitHub defaults (`good first issue`, `help wanted`, `invalid`, `question`, `wontfix`, `duplicate`) unless issues currently carry them.

A label carrying no issues is a free delete. One that does gets migrated first. Neither is a question worth asking.

### Approval boundary

Setting up project flow is plumbing, not a design decision. Run it to completion.

**Apply without asking:** creating labels, label reconciliation above, creating a Project or its fields, adding milestones the user named.

**Stop and ask:** writing a `docs/agents/` Override (a repo deviating from the default is a decision, not plumbing), deleting a label that still carries issues and has no `type:` equivalent, closing or deleting issue records, anything touching a remote other than `origin`, and any command needing an auth scope the token lacks — surface the exact `gh auth refresh -s <scope>` line, since only the human can run it.

## Output Shape

For guided and audit modes, respond with:

```text
Project-flow setup read:
- Contract: defaults, no repo Overrides
- GitHub: no type: labels (never set up), milestones missing, Project needs project auth scope
- Recommended next: /project-flow-setup apply
```

For apply mode, report what was done, not what is proposed:

```text
Project-flow setup applied:
- Labels: created type:feature, type:bug, needs-scope; migrated 10 issues off `enhancement`; deleted 9 stock labels
- Project fields: Status, Priority, Size, Mode created
- Milestones: none (none named)
- Overrides: none written (repo follows the defaults)
- Needs you: gh auth refresh -s project
- Recommended next: /roadmap next
```

List anything the human must run under a `Needs you:` line. Keep it to commands only they can execute.

## Rules

- Use repo-local `LEXICON.md` Lexicon terms when present.
- Read the bundled defaults; a repo-local `docs/agents/` Override wins for the doc it shadows.
- Write an Override only for a real deviation. Never write one to "complete" setup.
- Run setup to completion; gate only what the Approval Boundary names.
- Keep this Skill setup-focused. Route operational work to `/to-issues`, `/roadmap`, `/scope`, `/implement`, `/verification-loop`, or `/prep-pr`.
