# 0003 — Machine-scoped rules via the `machine` Variant

Date: 2026-07-11
Status: accepted

## Context

The first `/loop-audit` run found the top recurring intervention (~12×) was
Chris re-declaring machine context — "we're on hestia via Remote SSH",
localhost URLs that don't resolve in his browser, "don't kill anything on this
server". The fix is a rule, but it is true on exactly one machine class; the
`rules` component ships wholesale to every machine, and ADR-0002 Presets
select components and Variants, not individual rule files.

## Decision

1. **Machine-scoped rules live at `canonical/rules/machines/<name>.md`.**
   They are excluded from every install by default.
2. **A `machine` Variant names the machine class** (e.g. `machine: hestia`),
   carried by the existing Variant pipeline (preset → profile → payload →
   receipt) — no new Preset field, honoring ADR-0002's "new identity fields
   are added deliberately" rule by not adding one.
3. **The matching rule installs at the fixed path `rules/machine.md`**, so the
   shared CLAUDE.md imports `@~/.claude/rules/machine.md` unconditionally; on
   machines with no `machine` Variant the import is a harmless missing-file
   no-op (the PROFILE.md precedent).

## Consequences

- One rule file per machine class, versioned with the repo, selected by the
  same Preset the machine already remembers. Editing it updates that class on
  next sync.
- Only one machine rule can be active per install (fixed target path) — by
  design; a machine is one class. Shared content belongs in `rules/common/`.
- Renaming a machine class means renaming the file and the Variant value
  together; presets.yaml is the single place both appear.
