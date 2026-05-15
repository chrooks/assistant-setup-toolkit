---
name: idea-to-design
description: Turn an early product idea into a design frame with intent, target user, user growth arc, Design Boundary, Honest Signifiers, Transparent Friction, Progressive Disclosure, first Vertical Slice, risks, and /impeccable handoff. Use when shaping a rough idea, Cornerstone concept, product direction, or future design Conversation Thread before UI/frontend work.
argument-hint: "<idea or product direction>"
user-invocable: true
---

# Idea to Design

Use this Skill to turn a rough idea into a design frame that can guide future
Conversation Threads or immediate Cornerstone work.

## Process

1. Read the user's idea and any repo docs that can answer obvious questions:
   - Read the local `CONTEXT.md` first, then relevant PRDs, ADRs, README files,
     specs, or nearby docs.
   - Use project Lexicon terms precisely. If the user uses an `_Avoid_` term
     where a Lexicon term applies, briefly correct it and continue.
   - Treat a Tool as any capability used to carry the workflow, and a Skill as
     the portable instruction package currently being invoked.

2. Identify what is already knowable before interviewing:
   - Existing product language, target users, constraints, and comparable
     workflows.
   - Any established Design Boundary, Vertical Slice, or Interface patterns.
   - Questions that repo/docs cannot answer.

3. Ask for user input only when needed:
   - Ask one question at a time.
   - Recommend a default answer with each question.
   - Do not ask about facts that can be discovered from repo/docs.
   - Keep each question tied to a decision needed for the design frame.

4. Shape the idea through the Partnership Model:
   - Prefer software that grows the user instead of replacing their judgment.
   - Use Software as Education when the product should teach a way of thinking,
     not only complete a transaction.
   - Define the Design Boundary: what the software does for the user versus what
     it does with the user.
   - Name Honest Signifiers that accurately communicate capability,
     consequence, and intent.
   - Name Transparent Friction that should remain visible to support better
     decisions, trust, or learning.
   - Build a Progressive Disclosure ladder from first contact to expert use.

## Output

Produce a concise design frame with these sections:

- `Intent`: the product promise in plain language.
- `Target User`: who this is for, including their current context.
- `User Growth Arc`: how the user becomes more capable over time.
- `Design Boundary`: the line between automation and partnership.
- `Honest Signifiers`: visible cues the Interface should communicate.
- `Transparent Friction`: useful resistance that should not be hidden.
- `Progressive Disclosure`: the ladder from first use to deeper control.
- `First Vertical Slice`: the smallest end-to-end experience worth building.
- `Risks / Open Questions`: unknowns, trade-offs, and validation needs.
- `Handoff`: when the frame is ready for UI/frontend, say to invoke
  `/impeccable` and include the exact design frame to carry forward.

## Rules

- Stay concrete. Prefer decisions, examples, and user-visible behavior over
  abstract principles.
- Keep the first Vertical Slice small enough to build and test.
- Do not invent product facts when repo/docs or the user have not supplied them.
- If multiple directions are plausible, split them into separate Conversation
  Threads and recommend which one to pursue first.
- Do not produce UI layouts directly unless the user asks; hand off Interface
  execution to `/impeccable`.
