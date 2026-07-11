# 0002 — Presets: repo-declared machine classes, receipt-remembered by name

Date: 2026-07-11
Status: accepted

## Context

Every machine class (work laptop, personal Mac/PC/WSL, hestia) needs a different
Setup Wizard selection, and the visual-plans Variant (ADR-0001) was deliberately
built as plain `SetupProfile` data so a preset system could absorb it. Without
presets, each machine re-answers the same questions and per-machine drift is
invisible.

## Decision

1. **Presets live in the repo.** `manifests/presets.yaml` holds named Presets
   (`work`, `personal`, `hestia`, …). A Preset is a declaration of intent —
   versioned, reviewable, shared by git like the rest of the Canonical
   Assistant Source. Editing a Preset updates every machine of that class on
   its next sync.
2. **Machines remember only the Preset name.** Chosen once via `--preset <name>`
   or an interactive select; the name is recorded in the Install Receipt and
   rehydrated on later runs (the ADR-0001 rehydration pattern generalized).
   Contents always re-resolve from the repo file. A receipt naming a Preset
   that no longer exists fails loudly with the available names — never a silent
   fallback.
3. **Precedence ladder** (most powerful first): explicit CLI flags → Preset
   fields → interactive prompts (only for fields the Preset omits) → receipt-
   remembered values → built-in defaults. Flag overrides are one-off, not
   sticky: `--sync` reverts to the Preset. Permanent change = edit the Preset.
   The Preset name itself follows the same ladder (flag → receipt → prompt).
4. **Preset fields are the five identity fields only**, all optional:
   `targets`, `components`, `selectedExternalSourceIds`, `variants`,
   `writeBehavior`. Run ephemera (`dryRun`, `yes`, `quiet`, `fetch`,
   `symlink`, `mode`) are excluded — invocation style is not machine identity.
   New identity-shaped fields are added deliberately, never absorbed by default.
5. **No machine sniffing.** Preset selection is explicit data (flag, receipt,
   prompt) — never hostname or environment detection inside the pipeline,
   consistent with ADR-0001.

## Consequences

- One file answers "what does each of my machines install"; drift becomes a
  diff instead of an archaeology dig.
- The existing Variant receipt-rehydration drops one rung in the ladder but
  keeps working for machines without a Preset — no migration.
- Renaming a Preset requires touching the machines that recorded the old name
  (loud failure tells you which names exist); acceptable for a handful of
  machines, revisit if that ever hurts.
