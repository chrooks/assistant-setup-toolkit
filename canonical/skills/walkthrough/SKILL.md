---
name: walkthrough
description: Walk through a prior response, plan, or any structured document one topic at a time, grill-style — resolve it into a short agenda of the meaningful topics (or decisions) worth covering, then march through them ONE AT A TIME, calling /wym on each to produce the multimodal illustrated explanation (intro + human + best-fit visual + TLDR), and finish by wrapping every topic back into one throughline. Use when the user invokes /walkthrough, says "walk me through this", "break this down one by one", "go through it section by section", or "unpack your last response".
argument-hint: "[last response | <file path> | <pasted text>]"
---

# Walkthrough

Take a structured response, plan, or document and walk it **one topic at a time**, the
way `/grill-me` marches through decisions — except instead of interrogating each item,
**call `/wym` on it** to produce the multimodal illustrated explanation. `walkthrough`
owns three things: **segmenting** the source into a meaningful agenda, **marching**
through it one topic at a time, and **wrapping** every topic back into one throughline.
The per-topic illustration — the best-fit visual — belongs to `/wym`.

## Invocation

`/walkthrough [source]`

## Source resolution

Resolve what to walk through, in this order:

1. An argument that is a **file path** → read it.
2. An argument that is **pasted text** → use it.
3. **"last response" / no argument** → the most recent substantive assistant message in
   this conversation.

## How it runs (the loop)

This is the core behavior — a grill-style one-at-a-time march, not a single dump:

1. **Build the agenda.** Resolve the source into a short list of the **meaningful topics**
   worth walking — for a plan or a set of options, this is the list of **decisions to
   resolve** (mirror `/grill-me`'s decision tree). See [Building the agenda](#building-the-agenda).
2. **Show the agenda first.** Present it as a numbered list so Chris sees the map and can
   steer — reorder, drop, add, or merge topics — before the walk starts.
3. **March one topic at a time.** For topic N:
   - Invoke **`/wym <topic>`**, handing it the topic plus one line of grounding context
     from the source. `/wym` returns the caveman sandwich (Intro · Human · best-fit
     Visual · TLDR) and makes the single best-fit visual choice itself.
   - Wrap it in a minimal `## §N — [title]` header so the position in the agenda is clear.
   - Then **pause** with an advance affordance and **wait** for Chris before the next topic.
4. **Wrap up.** After the last topic, synthesize — see [The wrap-up](#the-wrap-up).

### Advance affordance (between topics)

After each topic, offer the next move and stop:

```
─── §N of M done ───
`next` → §N+1   ·   `all` → walk the rest straight through   ·   `drill` → go deeper here   ·   `skip` → jump a topic
```

Default is **one at a time, pausing between** (grill-style). If Chris says **"all" / "just
walk it" / "go straight through"**, run the remaining topics back-to-back without pausing,
then wrap up.

## Building the agenda

- Prefer the source's **own structure** — its headers or top-level list become topics.
- Each agenda item must be **one meaningful topic that deserves its own `/wym`**. Group
  minor bits together; drop pure preamble and sign-off.
- Aim for **3–7 topics**. More than ~7 → group until each carries a distinct point. A walk
  of 14 thin topics is worse than one of 6 sharp ones.
- For **decision-style sources** (a plan, a design, a set of options), the agenda *is* the
  list of meaningful decisions to resolve — the same backbone `/grill-me` walks.

## Per-topic: delegate to /wym

- **Do not re-implement illustration here.** `/wym` owns the visual dispatch (ASCII tree,
  `/table`, `/diagram`, chart, list, or prose — whichever single form fits that topic).
- Give `/wym` the topic title **plus one line of context** pulled from the source so its
  explanation is grounded in *this* document, not generic.
- Keep `walkthrough`'s own wrapper thin: the `§N — title` header, the `/wym` sandwich, the
  advance affordance. Nothing else per topic.

## The wrap-up

Mandatory final block — where the one-at-a-time pieces become a single message:

```
## The throughline

[2–4 sentences: the single overarching point the whole source was making, now that the
topics have been seen one at a time.]

[one connective visual that shows how the topics relate — usually a `/diagram md` flow
(topic → topic → payoff) or a compact `/table md` of  topic → its point → so-what.]
```

Pick the wrap-up visual to show **connection**, not to repeat the per-topic visuals.

## Behavior

- Always show the agenda before the first topic so Chris can steer the walk.
- Default to one topic at a time with a pause between; honor "all" for a continuous walk.
- Stay faithful to the source — `walkthrough` re-presents and clarifies; it does not invent
  claims or silently correct the source. Flag a real error in one line; don't rewrite it.
- If the project has a `CONTEXT.md`, use its Lexicon terms in agenda titles and topics.
- For a full human-facing visual artifact (an HTML deck of the walk), hand off to `/recap`.

## Example (abridged)

`/walkthrough` on the earlier `my-garden` seed report:

```
Here's the agenda — say `next` to start, or steer (reorder / drop / add):

  §1  What got created  (the scaffold tree)
  §2  The shape it took (the garden metaphor as contract)
  §3  The decisions you locked (stack · name · feeds)
  §4  What's deliberately empty (Seams + stubs)
  §5  The next step (hand BRIEF to /scope)

─────────────────────────
## §1 — What got created

[ /wym "the my-garden scaffold tree — all stubs, no behavior" → Intro + Human + an
  ASCII tree visual + TLDR, chosen by wym because the point is structure/containment ]

─── §1 of 5 done ───
`next` → §2  ·  `all` → walk the rest  ·  `drill` → go deeper  ·  `skip`
```

After §5, the **wrap-up** ties all five topics into one throughline with a single
connective `/diagram` — the one message the report was really making.
```
