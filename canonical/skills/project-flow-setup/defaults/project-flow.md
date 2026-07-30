# Project Flow

This repository uses a project-management and development loop built around repo-local docs, GitHub issue records, milestones, Projects, and focused Skills.

## Skill Boundary

- `/project-flow-setup` configures a repository for the workflow.
- `/to-issues` creates, updates, and closes issue records.
- `/roadmap` chooses, prioritizes, sequences, and reshapes work.
- `/scope` decides whether to implement, plan, or grill.
- `/implement` implements selected ready work.
- `/verification-loop` proves the work.
- `/prep-pr` packages the final diff for review or PR.

## Where this Contract lives

These three docs ship as defaults bundled with the `project-flow-setup` Skill, at `~/.claude/skills/project-flow-setup/defaults/`:

- `project-flow.md` — this file
- `issue-tracker.md`
- `triage-labels.md`

`/roadmap` and `/to-issues` read them from there. A repository that follows this workflow needs no copy of them.

A repo-local `docs/agents/<name>.md` is an **Override** — it shadows the default of the same name and stops tracking upstream changes to it. Write one only for a real deviation: a different issue tracker, a different label taxonomy, extra `gh` recipes.

## First-Time Setup

Run:

```text
/project-flow-setup
```

Bare `/project-flow-setup` audits the repository, then creates the missing labels, milestones, and Project fields. It writes no repo files.

Direct setup commands:

```text
/project-flow-setup audit
/project-flow-setup apply
/project-flow-setup override <doc>
```

## Daily Loop

Start by choosing the next ready issue record:

```text
/roadmap next
```

Then run the implementation and proof loop:

```text
/implement #issue
/verification-loop
/to-issues close #issue
```

When the diff is ready:

```text
/prep-pr
```

## Fuzzy-Work Loop

For unclear ideas or broad requests:

```text
/scope "idea or request"
```

Then route to the selected workflow:

```text
/implement
/plan
/grill-me
```

Once the work has a clear plan, task list, or PRD:

```text
/to-issues <source>
/roadmap next
```

## Issue Tracker Shape

Use GitHub this way:

- Issues are issue records.
- Sub-issues break parent work into Vertical Slices.
- Milestones are goal or release buckets.
- Projects are the Kanban/status/priority Surface.
- Labels are taxonomy and routing metadata.

Recommended Project fields:

```text
Status: Inbox, Backlog, Ready, In Progress, Blocked, Review, Done
Priority: P0, P1, P2, P3
Size: XS, S, M, L
Mode: AFK, HITL
```

## Operating Rules

- Use `/to-issues update` when follow-up work appears during implementation.
- Use `/to-issues close` only after verification evidence exists.
- Use `/roadmap reprioritize` or `/roadmap board` when board status, milestone fit, priority, or blockers need reshaping.
- Use `/scope` again when an issue record is too vague to execute.
