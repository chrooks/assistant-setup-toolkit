---
name: design-audit
description: Audit an existing product flow, Interface, or UI Surface against Chris's design ethos plus HCI/UX principles. Use when reviewing product design, Cornerstone flows, screenshots, prototypes, or implemented UI for Signifiers, Affordances, Progressive Disclosure, Transparent Friction, Design Boundaries, Feedback, Hierarchy, Information Architecture, Error States, Empty States, and Mom Test / Nick Test evidence.
argument-hint: "<flow, Surface, screenshot, or repo path>"
user-invocable: true
---

# Design Audit

Use this Skill to audit an existing product flow or UI design. Prefer evidence from the repo, docs, screenshots, prototypes, analytics notes, or prior conversation. Ask the user one question at a time only when the answer cannot be discovered.

## Audit Targets

Support general Interface and Surface audits, plus these Cornerstone Touchpoints:

- Feedback panel
- Onboarding
- Legend selector
- Evaluate Team explanation
- Leaderboard Touchpoint

## Process

1. Establish the audit object:
   - Identify the product flow, Surface, users, goal, and key Touchpoints.
   - Inspect available repo files, docs, screenshots, and existing copy before asking.
   - If context is missing, ask exactly one focused question, then continue.
2. Map the flow:
   - List each Touchpoint in order.
   - For each Touchpoint, capture the primary user intent, available Affordances, visible Signifiers, Feedback, Error State, and Empty State.
   - Note the intended Partnership Model: what the software teaches, asks, decides, delays, or refuses.
3. Evaluate clarity:
   - Separate Honest Signifiers from misleading, weak, decorative, or absent Signifiers.
   - Check Hierarchy and Information Architecture for what the user must understand first, next, and later.
   - Flag Progressive Disclosure risks where the Surface hides necessary context too long or reveals too much too early.
4. Evaluate trust:
   - Identify Transparent Friction opportunities where a pause, explanation, confirmation, or slower step would build confidence.
   - Flag Design Boundary violations where the Interface implies it can do more than it should, hides uncertainty, overclaims authority, or blurs user agency.
   - Check whether the Surface treats Software as Education: the user should leave more capable, not merely routed through steps.
5. Run the Mom Test lens:
   - Convert claims and prompts into behavior-based questions.
   - Note where the current design asks for opinions, compliments, predictions, or hypotheticals instead of evidence.
6. Run the Nick Test lens (the complement to the Mom Test):
   - Trace the path from first contact to first real payoff. Flag every step of required onboarding, reading, or setup that stands before value.
   - Flag Honest Signifier breaks where the first-run promise implies instant utility the flow does not yet deliver.
   - Ask: would a capable-but-investment-averse user reach value before deciding it is not worth the bother? Name where they would bail.
7. Produce fixes:
   - Rank fixes by user impact, confidence, and implementation effort.
   - Separate copy-only, layout, interaction, state-handling, and deeper product-model fixes.
   - When ready for UI/frontend implementation, hand off to `/impeccable` with the ranked fixes and evidence.

## Output Format

Return concise sections:

- **Audited Flow Map**: ordered Touchpoints with intent, Affordances, Signifiers, Feedback, Error States, and Empty States.
- **Strongest Signifiers**: what currently teaches the right thing.
- **Weakest Signifiers**: what is missing, misleading, or too subtle.
- **Progressive Disclosure Risks**: where timing or sequencing harms understanding.
- **Transparent Friction Opportunities**: where intentional pause or explanation would improve trust.
- **Design Boundary Violations**: where the Interface overpromises, hides uncertainty, or weakens agency.
- **Mom Test Notes**: better evidence-seeking questions and what they would reveal.
- **Nick Test Notes**: time-to-first-value along the flow, required onboarding before payoff, and where an investment-averse user would bail.
- **Ranked Fixes**: highest-leverage changes first, with rationale.
- **Handoff**: `/impeccable` brief when UI/frontend work is ready.

## Rules

- Use Lexicon terms exactly: Tool, Skill, Interface, Surface, Affordance, Signifier, Honest Signifier, Transparent Friction, Progressive Disclosure, Design Boundary, Partnership Model, Software as Education, Mom Test, Nick Test, Touchpoint, Feedback, Hierarchy, Information Architecture, Error State, Empty State.
- Do not invent screenshots, analytics, or user research. Mark assumptions clearly.
- Prefer concrete observations over taste statements.
- Keep questions singular and answerable.
- Do not redesign the entire product unless the audit shows the Design Boundary itself is wrong.
