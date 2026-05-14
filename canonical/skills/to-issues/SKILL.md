---
name: to-issues
description: Break a plan, spec, PRD, or TODO.md workflow into independently-grabbable issue tracker tickets or local TODO.md tasks using tracer-bullet vertical slices. Use when user wants to convert a plan into issues, create implementation tickets, populate TODO.md locally, or break down work into issues.
argument-hint: "[local] <plan|spec|prd|issue|path>"
disable-model-invocation: true
---

# To Issues

Break a plan into independently-grabbable issues or local TODO tasks using vertical slices (tracer bullets).

By default, this Skill publishes approved slices to the project issue tracker. With the `local` subcommand, update the project-root `TODO.md` instead and make no issue tracker mutations.

The issue tracker and triage label vocabulary should have been provided to you for default mode — run `/setup-matt-pocock-skills` if not. Local mode does not require issue tracker setup.

## Invocation forms

Parse arguments positionally from the user's invocation.

- `/to-issues <source...>` -> issue tracker mode.
- `/to-issues local <source...>` -> local mode. Treat `local` as a subcommand, remove it from the source arguments, and update `TODO.md` instead of publishing issue tracker tickets.

## Process

### 1. Gather context

Work from whatever is already in the conversation context. If the user passes an issue reference (issue number, URL, or path) as an argument, fetch it from the issue tracker and read its full body and comments.

In local mode, read issue references when needed for context, but do not create, comment on, label, close, or otherwise mutate issue tracker items.

### 2. Explore the codebase (optional)

If you have not already explored the codebase, do so to understand the current state of the code. Issue titles and descriptions should use the project's domain glossary vocabulary, and respect ADRs in the area you're touching.

### 3. Run existing work pass

Before drafting new work, inspect the existing work surface for items that may overlap, block, or depend on the incoming tasks.

In issue tracker mode, use the issue tracker commands from the project guidance. Prefer a broad issue list first, then fetch full bodies/comments for likely matches. Include open and recently closed issues when prior work may already cover the task.

In local mode, inspect project-root `TODO.md` if it exists. If it does not exist, plan to create it. Treat existing unchecked tasks, checked tasks, headings, and notes as existing work. Preserve checked items and user-written notes when updating the file.

For each incoming task, decide whether it is:

- **New issue / TODO task**: distinct work that should get its own issue tracker item or local TODO entry.
- **Roll into existing issue / TODO task**: better as an acceptance criterion, checklist item, comment, or local subtask on existing work.
- **Duplicate / already covered**: no new issue needed unless the existing issue needs clarification.
- **Blocked by existing issue**: cannot start until an existing issue lands.
- **Blocks existing issue**: an existing issue should wait for this work.
- **Related only**: context worth referencing, but not a dependency.
- **Conflicts / supersedes**: the proposed task changes direction from an existing issue and needs human approval.

Use rich issue references whenever available: number, title, and link. Prefer `[#123 Issue title](https://tracker/issue/123)` over a bare `#123`. If links are not available, use `#123 Issue title`. In local mode, use stable `TODO.md` headings or task text as references. If there is no relevant existing work, say that explicitly.

### 4. Draft vertical slices

Break the plan into **tracer bullet** issues. Each issue is a thin vertical slice that cuts through ALL integration layers end-to-end, NOT a horizontal slice of one layer.

Slices may be 'HITL' or 'AFK'. HITL slices require human interaction, such as an architectural decision or a design review. AFK slices can be implemented and merged without human interaction. Prefer AFK over HITL where possible.

<vertical-slice-rules>
- Each slice delivers a narrow but COMPLETE path through every layer (schema, API, UI, tests)
- A completed slice is demoable or verifiable on its own
- Prefer many thin slices over few thick ones
</vertical-slice-rules>

When a task should roll into existing work, do not draft it as a new issue or TODO task by default. Instead, include it in the proposal as a roll-in target and ask the user whether to add a comment, checklist update, or local TODO update.

### 5. Show dependency chart

Before asking for approval, show a compact dependency chart that includes:

- proposed new issues
- relevant existing issues
- proposed local TODO tasks when in local mode
- relevant existing TODO tasks when in local mode
- roll-in targets
- blocking relationships
- non-blocking related relationships when useful

Use a readable Markdown chart by default, so issue references can be linked:

- Existing blocker: [#9 Evaluation Version publishing](https://tracker/issue/9)
  - New: Retune Skill Tier values
- Existing related issue: [#12 Redo live tips system](https://tracker/issue/12)
  - Related: Player Archetypes
- Roll into [#11 Update old admin dashboard](https://tracker/issue/11)
  - Task: Add landing-page status card

Use Mermaid only when the user's surface is likely to render it well. Keep labels short.

### 6. Quiz the user

Present the proposed breakdown as a bulleted list, not a numbered list. Numbered proposals are easy to confuse with real issue numbers. For each slice, show:

- **Title**: short descriptive name
- **Type**: HITL / AFK
- **Blocked by**: which other slices (if any) must complete first
- **Existing work relation**: duplicate, roll-in target, blocked by, blocks, related, or none
- **User stories covered**: which user stories this addresses (if the source material has them)

Ask the user:

- Does the granularity feel right? (too coarse / too fine)
- Are the dependency relationships correct?
- Should any task roll into an existing issue instead of becoming a new issue?
- Should any slices be merged or split further?
- Are the correct slices marked as HITL and AFK?

Iterate until the user approves the breakdown.

### 7. Publish issues or update TODO.md

In issue tracker mode, publish the approved issues to the issue tracker.

For each approved slice, publish a new issue to the issue tracker. Use the issue body template below. These issues are considered ready for AFK agents, so publish them with the correct triage label unless instructed otherwise.

Publish issues in dependency order (blockers first) so you can reference real issue identifiers in the "Blocked by" field.

For approved roll-ins, do not create a new issue. Add a comment to the target issue with the agreed checklist item(s), or summarize the update for the user if tracker mutation was not requested.

<issue-template>
## Parent

A reference to the parent issue on the issue tracker (if the source was an existing issue, otherwise omit this section).

## What to build

A concise description of this vertical slice. Describe the end-to-end behavior, not layer-by-layer implementation.

Avoid specific file paths or code snippets — they go stale fast. Exception: if a prototype produced a snippet that encodes a decision more precisely than prose can (state machine, reducer, schema, type shape), inline it here and note briefly that it came from a prototype. Trim to the decision-rich parts — not a working demo, just the important bits.

## Acceptance criteria

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Blocked by

- A reference to the blocking ticket (if any)

Or "None - can start immediately" if no blockers.

## Related issues

- A reference to related, blocked, blocking, or superseded tickets (if any)

Omit this section if there are no related issues beyond "Blocked by".

</issue-template>

Do NOT close or modify any parent issue.

In local mode, write the approved breakdown to project-root `TODO.md` instead.

- Do not publish issue tracker tickets.
- Do not comment on, label, close, or otherwise mutate issue tracker items.
- Create `TODO.md` if it does not exist.
- Preserve existing `TODO.md` content. If the file already contains `<!-- to-issues:begin -->` and `<!-- to-issues:end -->`, replace only that generated block. Otherwise append a `## To Issues` section.
- Preserve checked items and user-written notes when an existing TODO entry clearly matches an approved slice.
- Write slices in dependency order, blockers first.
- Use stable Markdown headings so future `/to-issues local` runs can reference and update the same tasks.

<todo-template>
## To Issues

<!-- to-issues:begin -->

### Slice title

Type: AFK
Status: Todo
Blocked by: None - can start immediately
Existing work relation: None
Source: Brief source reference, if available.

#### What to build

A concise description of this vertical slice. Describe the end-to-end behavior, not layer-by-layer implementation.

#### Acceptance criteria

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

#### Related work

- Omit this section if there is no related work beyond "Blocked by".

<!-- to-issues:end -->
</todo-template>
