# 0005 — Personal-only pieces are opt-in via the `personal-tools` Variant

Date: 2026-09-26
Status: accepted

## Context

Some installed pieces only make sense on the owner's personal machines. The
phone-notification hooks (`claude-notify.js`, and `notify-activity.js`, which
exists only to serve it) send the project folder name to a third-party push
service. The skills `ingest`, `notebooklm-export`, `sync-self`, and `loop-audit`
write to the personal knowledge base, upload to a personal Google account, or
mine the personal conversation-history archive. All of them shipped to every
Preset, so a restricted machine or a client machine got them by default.

## Decision

1. **A new Variant, `personal-tools`, gates them.** They reach a machine only
   when its resolved variants include `personal-tools: "on"`. Any other value,
   or none, drops them.
2. **Opt-in, not opt-out.** A new machine class — a client box, say — is safe
   without anyone remembering to switch something off. The tracked `personal`
   and `mac` Presets opt in; `work` does not. A machine-local Preset opts in
   through its gitignored overlay (ADR-0002).
3. **The skill list lives beside the other Variant-governed list** —
   `PERSONAL_SKILL_NAMES` in `src/setup/domain.ts`, next to
   `VISUAL_PLANS_SKILL_NAMES`. The hooks carry the gate in
   `canonical/hooks/wiring.yaml` (`variants: { personal-tools: "on" }`).

## Consequences

- A machine that loses the opt-in keeps the old copies until a prune sync: the
  skills show as orphans and the notify hook entries as stale on other runs,
  and `--write prune` removes both (issue #35's machinery).
- A machine with no Preset now installs no personal tools. That is the point,
  and the cost: a personal machine must name its Preset (or opt in by overlay).
- The hook scripts themselves still ship everywhere with the `hooks`
  component; unwired, they never run.
