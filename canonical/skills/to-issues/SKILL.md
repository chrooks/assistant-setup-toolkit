---
name: to-issues
description: Create, update, close, or break work into issue-tracker records or local TODO.md tasks using tracer-bullet vertical slices. Use when turning plans, specs, PRDs, TODOs, or existing issue context into issues, sub-issues, roll-ins, acceptance criteria, follow-up comments, verified closures, or local TODO.md entries.
argument-hint: "[local|update|close|sub-issues] <source|issue|path>"
disable-model-invocation: true
---

# To Issues

Use this Skill to create, update, and close issue records. It owns issue-record mutations around a source plan, task list, TODO, PRD, existing issue, or completed slice.

By default, this Skill publishes approved slices to the project issue tracker. With the `local` subcommand, update the project-root `TODO.md` instead and make no issue tracker mutations.

Local mode uses the bundled TODO.md format in [LOCAL-TODO-FORMAT.md](./LOCAL-TODO-FORMAT.md). Load that file only when local mode is active or when the user asks about the local TODO.md format.

In issue tracker mode, inspect `docs/agents/issue-tracker.md` and `docs/agents/triage-labels.md` when present. If they are missing, recommend `/project-flow-setup docs` before mutating issue records unless the user asks for a one-off issue-tracker change. Local mode does not require issue tracker setup.

## Boundary

- `/to-issues` creates, updates, and closes issue records.
- `/roadmap` chooses, prioritizes, sequences, and reshapes work.
- `/scope` decides whether to execute, plan, or grill.

Do not use `/to-issues` to decide what work matters next. Use `/roadmap` for that.

## Invocation forms

Parse arguments positionally from the user's invocation.

- `/to-issues <source...>` -> create mode. Break source material into new issue records.
- `/to-issues sub-issues <parent-issue> <source...>` -> sub-issue mode. Break source material into child issue records under a parent issue.
- `/to-issues update <issue> <source...>` -> update mode. Add or refine acceptance criteria, comments, checklist items, labels, milestone, Project fields, related links, or dependency notes on an existing issue record.
- `/to-issues close <issue...>` -> close mode. Close issue records only after verification evidence is present.
- `/to-issues local <source...>` -> local mode. Treat `local` as a subcommand, remove it from the source arguments, and update the project-root `TODO.md` instead of publishing issue tracker tickets.

If the user asks to "roll this into #123", "add this to #123", "comment this on #123", or "close #123", infer update or close mode even if they did not type the subcommand.

## Process

### 1. Gather context

Work from the conversation context first. If the user passes an issue reference, issue number, URL, or path, fetch it from the issue tracker and read the full body and comments.

In local mode, read issue references when needed for context, but do not create, comment on, label, close, or otherwise mutate issue tracker items.

### 2. Explore the codebase when useful

If issue titles, acceptance criteria, or verification commands depend on current code, inspect the repo before drafting. Use the project's Lexicon from `CONTEXT.md`, and respect ADRs in the relevant area.

### 3. Inspect existing work

Before drafting new work, inspect the existing work Surface for overlap, blockers, and dependencies.

In issue tracker mode, use the issue tracker commands from the project guidance. Prefer a broad issue list first, then fetch full bodies/comments for likely matches. Include open and recently closed issues when prior work may already cover the task.

In local mode, inspect project-root `TODO.md` if it exists. If it does not exist, plan to create it. Treat existing unchecked tasks, checked tasks, headings, and notes as existing work. Preserve checked items and user-written notes when updating the file.

For each incoming task, decide whether it is:

- **New issue / TODO task**: distinct work that should get its own issue record or local TODO entry.
- **Sub-issue**: child work that belongs under a parent issue record.
- **Roll into existing issue / TODO task**: better as an acceptance criterion, checklist item, comment, or local subtask on existing work.
- **Update existing issue**: an existing issue record needs clearer scope, metadata, dependencies, or acceptance criteria.
- **Close existing issue**: the work is complete and has verification evidence.
- **Duplicate / already covered**: no new issue needed unless the existing issue needs clarification.
- **Blocked by existing issue**: cannot start until an existing issue lands.
- **Blocks existing issue**: an existing issue should wait for this work.
- **Related only**: context worth referencing, but not a dependency.
- **Conflicts / supersedes**: the proposed task changes direction from an existing issue and needs human approval.

Use rich issue references whenever available: number, title, and link. Prefer `[#123 Issue title](https://tracker/issue/123)` over a bare `#123`. If links are not available, use `#123 Issue title`. In local mode, use stable `TODO.md` headings or task text as references. If there is no relevant existing work, say that explicitly.

### 4. Draft vertical slices

For create and sub-issue mode, break the source into tracer-bullet Vertical Slices. Each issue should be a thin end-to-end increment, not a horizontal Layer slice.

Slices may be `HITL` or `AFK`. HITL slices require human interaction, such as an architectural decision or design review. AFK slices can be implemented and merged without human interaction. Prefer AFK where possible.

<vertical-slice-rules>
- Each slice delivers a narrow but complete path through every required Layer.
- A completed slice is demoable or verifiable on its own.
- Prefer many thin slices over a few thick ones.
</vertical-slice-rules>

When a task should roll into existing work, do not draft it as a new issue or TODO task by default. Include it as a roll-in target and ask whether to add a comment, checklist update, issue-body update, or local TODO update.

### 5. Show dependency chart

Before asking for approval, show a compact dependency chart that includes:

- proposed new issue records
- proposed sub-issues and their parent issue
- relevant existing issue records
- proposed local TODO tasks when in local mode
- relevant existing TODO tasks when in local mode
- roll-in targets
- blocking relationships
- non-blocking related relationships when useful

Use a readable Markdown chart by default, so issue references can be linked:

- Parent issue: [#20 Build roadmap Skill](https://tracker/issue/20)
  - New sub-issue: Add Project field recommendations
- Existing blocker: [#9 Evaluation Version publishing](https://tracker/issue/9)
  - New: Retune Skill Tier values
- Roll into [#11 Update old admin dashboard](https://tracker/issue/11)
  - Task: Add landing-page status card

Use Mermaid only when the user's Surface is likely to render it well. Keep labels short.

### 6. Quiz the user

Present the proposed breakdown as a bulleted list, not a numbered list. Numbered proposals are easy to confuse with real issue numbers. For each slice or update, show:

- **Title**: short descriptive name
- **Mode**: new issue, sub-issue, update, roll-in, close, or local TODO
- **Type**: HITL / AFK when applicable
- **Blocked by**: which issue records must complete first
- **Existing work relation**: duplicate, roll-in target, blocked by, blocks, related, conflicts, supersedes, or none
- **User stories covered**: which user stories this addresses, if the source material has them

Ask only the questions needed to publish or update safely:

- Does the granularity feel right?
- Are the dependency relationships correct?
- Should any task roll into an existing issue instead of becoming a new issue?
- Should any slices be merged or split further?
- Are the correct slices marked as HITL and AFK?

Iterate until the user approves the issue-record changes.

### 7. Publish, update, or close

In issue tracker mode, apply only the approved issue-record changes.

For each approved new slice, publish a new issue record in dependency order. Use the issue body template below. These issues are considered ready for AFK agents, so publish them with the correct triage label unless instructed otherwise.

For sub-issues, prefer native issue-tracker parent/sub-issue support when the project guidance provides it. If the tracker or available CLI cannot create native sub-issues, create normal issue records with a `Parent` section and add a parent issue comment linking the created children.

For approved roll-ins and updates, do not create a new issue record. Add the agreed checklist item, body edit, metadata change, or comment to the target issue record.

Do not close issue records until verification evidence is present. When closing, add a concise closing comment that names the verification command, manual check, PR, commit, or release evidence. Do not close parent issues merely because sub-issues were created.

<issue-template>
## Parent

A reference to the parent issue on the issue tracker if this is a sub-issue or came from an existing parent issue. Otherwise omit this section.

## What to build

A concise description of this Vertical Slice. Describe the end-to-end behavior, not Layer-by-Layer implementation.

Avoid specific file paths or code snippets because they go stale fast. Exception: if a prototype produced a snippet that encodes a decision more precisely than prose can, inline only the decision-rich part and note that it came from a prototype.

## Acceptance criteria

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Blocked by

- A reference to the blocking issue record, if any

Or "None - can start immediately" if no blockers.

## Related issues

- A reference to related, blocked, blocking, duplicate, superseded, or superseding issue records, if any

Omit this section if there are no related issues beyond "Blocked by".
</issue-template>

## Local mode

In local mode, write the approved breakdown to project-root `TODO.md` using [LOCAL-TODO-FORMAT.md](./LOCAL-TODO-FORMAT.md).

- Do not publish issue tracker tickets.
- Do not comment on, label, close, or otherwise mutate issue tracker items.
- Create `TODO.md` if it does not exist.
- Preserve existing `TODO.md` content. If the file already contains `<!-- to-issues:begin -->` and `<!-- to-issues:end -->`, replace only that generated block. Otherwise append a `## To Issues` section.
- Preserve checked items and user-written notes when an existing TODO entry clearly matches an approved slice.
- Write slices in dependency order, blockers first.
- Use stable TODO titles so future `/to-issues local` runs can reference and update the same TODOs.
