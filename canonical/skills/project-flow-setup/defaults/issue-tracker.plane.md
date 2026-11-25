# Issue Tracker: Plane

Use this doc when the repo's `docs/agents/issue-tracker.md` Override says the tracker is Plane. Plane holds the Issue records (Plane calls them work items). A sync service keeps a read-only GitHub twin of each work item, so GitHub still shows the work and commit keywords still close it.

The Override names three values. Read them before any tracker call:

- **Plane base URL** — the web address of the Plane instance.
- **Workspace** — the workspace slug.
- **Project** — the project identifier, for example `CORN`.

Every rule in the GitHub `issue-tracker.md` default about Issue records, Sub-issues, Verified Closure, and Update Rules still applies. Only the tool calls and the concepts below change.

## Fallback

If the Plane MCP tools are unavailable in this session (another machine, a cloud session, Codex), write the issue on GitHub as the GitHub doc describes. The sync service adopts a GitHub issue that has no mirror header into Plane within about two minutes. Never edit a GitHub twin that starts with "Mirror of …. Edit in Plane." — the next sync overwrites the edit.

## Concept mapping

| GitHub concept | Plane concept |
|---|---|
| Issue | Work item, identified as `PROJECT-N` (for example `CORN-12`) |
| Open / closed | State. Groups: backlog, unstarted, started → open; completed (Done) and cancelled (Cancelled) → closed |
| `ready-for-human`, `needs-info` | The Needs Human state |
| `needs-triage` | The Backlog state |
| `priority:pN` label | The priority field: p0 urgent, p1 high, p2 medium, p3 low. The twin shows it as the `priority:pN` label |
| Other labels (`type:*`, `mode:*`) | Labels with the same names |
| Milestone | Module |
| Sub-issue | `parent` on the child work item. The twin becomes a native GitHub sub-issue |
| Blocked by | A `blocked_by` relation (not mirrored to GitHub yet) |
| Issue body (Markdown) | `description_html` (HTML) |

## Commit keywords use the GitHub number

Plane numbers and GitHub numbers differ: `CORN-79` is GitHub `#318`. A commit keyword must name the GitHub number. Read it from the work item's `GitHub #N` link, or from `external_id` when `external_source` is `github-import`. A commit on the default branch that says `fixes #318` closes the twin, and the sync then sets the work item to Done with a comment that links the commit.

## Links

Link a work item as `[CORN-12 short description](<Plane base URL>/<workspace>/browse/CORN-12/)`. When you also give the GitHub number, link it to the twin.

## Tracker verbs

All calls go through the Plane MCP tools. UUID fields (state, labels, parent, module) need ids: list the resource first and match by name.

### Setup check

`project list` → find the Override's project identifier; keep its `id`. Then `state list` and `label list` for that project. The project needs the states Backlog, Todo, In Progress, Needs Human, Done, and Cancelled.

### Create

`workitem create` with `project_id`, `name`, `description_html`, `labels`, `priority`, and `state`. The GitHub twin appears within a minute; its number arrives as a `GitHub #N` link on the work item.

### Read

`workitem retrieve_by_identifier` with `PROJECT-N`, then `workitem_comment list` for the discussion.

### List

Plane CE rejects every `pql` filter ("PQL and structured filters are not supported on this Plane edition"). Never pass `pql`; filter on your side.

1. `state list` once for the project. Keep a map of state id → name and group.
2. `workitem list` with `project_id`, `per_page: 100`, and `fields: id,sequence_id,name,state,priority,labels,parent,updated_at`. While `next_page_results` is true, call again with `cursor` set to `next_cursor`.
3. Keep the items whose state group is backlog, unstarted, or started. Those are the open items.

The list does not show Module or Cycle membership. Read it from the container: **Milestone** and **Cycle** below.

### Age

A work item with `external_source: github-import` came over in the import, so its `created_at` and `updated_at` are the import time. Read its creation date from the GitHub twin (`gh issue view <N> --json createdAt`). Read the last touch from the newest commit that names the GitHub number (`git log -1 --format=%cs --grep="#<N>"`) and from `workitem_comment list`. Ignore comments the sync wrote. For any other work item, `created_at` is true.

### Update

`workitem update` with only the fields that change. `manage_label` adds or removes labels without replacing the list.

### Comment

`workitem_comment create` with `comment_html`.

### Close

Record the verification evidence with **Comment**, then `workitem update` with the Done state (or Cancelled for not planned).

### Parent

`workitem update` on the child with `parent` set to the parent work item's id.

### Blocker

`workitem_relation create` on the blocked work item with `relation_type: blocked_by` and the blocker's id in `workitem_ids`.

### Milestone

`module list` / `module create`, then `module manage_workitems` with `add_ids` or `remove_ids`. `module list_workitems` gives the members. Retire a Module with `module update` (status `completed` or `cancelled`), then `module archive`.

### Cycle

A Cycle is a time-boxed iteration. `cycle list` gives the Cycles, and `cycle list_workitems` gives the members. `cycle manage_workitems` adds or removes items, and `cycle update` changes the name, description, or dates. `cycle archive` retires a Cycle and ends it first. `cycle transfer_workitems` moves the unfinished items to another Cycle, but only after `cycle complete` ends the source.

Modules and Cycles do not mirror to GitHub. A change to either stays in Plane.
