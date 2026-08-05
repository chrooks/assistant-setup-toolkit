# 0003 — Machine-scoped rules via the `machine` Variant

Date: 2026-07-11
Status: accepted

## Context

The first `/loop-audit` run found the top recurring intervention (~12×) was
The user re-declaring machine context — "we're on server via Remote SSH",
localhost URLs that don't resolve in their browser, "don't kill anything on this
server". The fix is a rule, but it is true on exactly one machine class; the
`rules` component ships wholesale to every machine, and ADR-0002 Presets
select components and Variants, not individual rule files.

## Decision

1. **Machine-scoped rules live at `canonical/rules/machines/<name>.md`.**
   They are excluded from every install by default.
2. **A `machine` Variant names the machine class** (e.g. `machine: server`),
   carried by the existing Variant pipeline (preset → profile → payload →
   receipt) — no new Preset field, honoring ADR-0002's "new identity fields
   are added deliberately" rule by not adding one.
3. **The matching rule installs at the fixed path `rules/machine.md`**, so the
   shared CLAUDE.md imports `@~/.claude/rules/machine.md` unconditionally; on
   machines with no `machine` Variant the import is a harmless missing-file
   no-op (the PROFILE.md precedent).

## Consequences

- One rule file per machine class, selected by the same Preset the machine
  already remembers. Editing it updates that class on next sync.
- **Amended 2026-07-13:** machine rule files are local-only and gitignored
  (`canonical/rules/machines/*.md`), no longer versioned with the repo. They
  describe a real box — services, paths, network details — and the repo is
  public; the original file was purged from git history. The Setup Wizard
  reads them from disk, so the Variant mechanism is unchanged, but each
  machine's rule file must be created or copied onto that machine by hand.
- Only one machine rule can be active per install (fixed target path) — by
  design; a machine is one class. Shared content belongs in `rules/common/`.
- Renaming a machine class means renaming the file and the Variant value
  together; presets.yaml is the single place both appear.
- **Noted 2026-07-25:** Codex parity works by inlining — the projection
  resolves `rules/machine.md` → `machines/<name>/rules.md` via the `machine`
  Variant and inlines the content into `AGENTS.md` (Codex has no `@` import
  mechanism). With no Variant set, the import line is dropped, matching the
  missing-file no-op on the Claude side.
- **Amended 2026-07-25:** everything machine-scoped now lives together at
  `canonical/machines/<name>/` — the rule at `machines/<name>/rules.md`, skills
  at `machines/<name>/skills/<skill>/`, future hooks alongside. The old
  `canonical/rules/machines/<name>.md` and `canonical/skills/machines/<machine>/`
  homes buried a machine profile inside component directories; a machine class
  is a first-class grouping, so it gets a top-level home. Install paths and the
  Variant mechanism are unchanged. The rules template is
  `canonical/machines/TEMPLATE.md`.
