# Issue tracker: Plane

Plane is the tracker of record for this repo. GitHub keeps a read-only twin of every work item.

- **Plane base URL**: https://plane.hestia.chrooks.com
- **Workspace**: chrooked-hobbies
- **Project**: TOOL

Use the bundled `issue-tracker.plane.md` (next to the `issue-tracker.md` default in the project-flow-setup Skill) for every tracker call. Its **Tracker verbs** map each operation to the Plane MCP tools.

## Rules that matter most

- Write work items in Plane. Never edit a GitHub issue that starts with "Mirror of TOOL-N · …. Edit in Plane." — the sync overwrites it.
- Commit keywords use the **GitHub** number, not the Plane number: read it from the work item's `GitHub #N` link. `fixes #N` on `main` closes the twin, and the sync sets the Plane work item to Done.
- Link a work item as `[TOOL-12 short description](https://plane.hestia.chrooks.com/chrooked-hobbies/browse/TOOL-12/)`.
- If the Plane MCP tools are unavailable (Codex, a cloud session, a machine without them), create a normal GitHub issue with `gh issue create`. The sync adopts it into TOOL within about two minutes.

## When a skill says "publish to the issue tracker"

Create a TOOL work item.

## When a skill says "fetch the relevant ticket"

`workitem retrieve_by_identifier` for `TOOL-N`. Given a GitHub number, `workitem list` with `external_source=github-import` and `external_id=<number>`.
