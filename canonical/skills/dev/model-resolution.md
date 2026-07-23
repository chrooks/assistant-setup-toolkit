# Model resolution — runtime-agnostic tier mapping

The single source of truth for turning a Throughline's abstract sizing into a
concrete dispatch model. The `dev` Conductor, `implement`, and `prove-it` all
resolve here — never inline a vendor model name in those skills, or it drifts
(the haiku rule once lived in three places and rotted). Vendor names live **only
in this file**.

## The abstraction

A Throughline records *capability*, not a vendor: `tier` (`heavy|light`) and
`effort` (`low|medium|high`). Those are runtime-agnostic. The concrete model is a
**per-runtime resolution** the Conductor performs at dispatch, keyed by the
runtime it is already running in (it knows whether it is Claude Code or Codex —
detection is free).

## Capability roles (the agnostic vocabulary)

Reason in these roles, not in model names:

- **plan/think** — the frontier reasoning model. Planning and information- and
  context-gathering: `scope`, `grill`, `plan`, deep research, codebase
  investigation. These are the stages the strongest model earns its cost on.
- **build-heavy** — complex implementation and proving: `tier: heavy` work
  stages.
- **build-light** — workhorse implementation and proving: `tier: light` work
  stages. **This is the floor** — never dispatch a work stage below it.
- (**never** — the cheap/fast tier is not used for any DevOS work stage.)

Planning stages run in the main conversation, so they inherit the main-loop
model: for a real `/dev` run, drive the session on the **plan/think** model.
Work stages are dispatched, so the Conductor sets their model from the table.

## Resolution table (the only place vendor names live)

| Role | Claude Code (`model` param) | Codex (model + effort) |
|---|---|---|
| **plan/think** | `fable` (Fable 5) | GPT-5.6 **Sol**, effort `high` |
| **build-heavy** | `opus` (Opus 4.8) | GPT-5.6 **Sol**, effort `medium` |
| **build-light** — floor | `sonnet` (Sonnet 5) | GPT-5.6 **Terra** |
| never | ~~`haiku`~~ | ~~**Luna**~~ |

- **Floor:** each runtime's workhorse tier — Sonnet 5 on Claude Code, Terra on
  Codex. Never the cheap/fast tier (Haiku 4.5 / Luna) for a work stage.
- A missing `tier` defaults to **build-light** (the floor), resolved explicitly —
  never dispatch with no model set.
- Codex tier names (Sol/Terra/Luna) are OpenAI's durable capability tiers within
  a GPT-5.x generation; use the current CLI model string for that tier. Bump the
  generation number here when Codex ships a newer one; the roles don't change.

## Effort

- **Codex** — `effort` is a real dispatch knob; set it from the Throughline (and
  per the table for plan/think vs build-heavy).
- **Claude Code** — no per-sub-agent effort knob; fold `effort` into the
  sub-agent prompt as guidance instead.

## The dispatch rule

1. Read the runtime you are in and the stage's role + `tier`.
2. Resolve to a concrete model via the table above.
3. **Always set the model explicitly** — leaving it unset is a defect; the
   sub-agent then silently inherits the main model and the tier has no effect.
4. **State the choice** in one line before dispatching — e.g. "tier: heavy →
   build-heavy → opus" — so the decision is legible and the dispatch stays
   auditable.
