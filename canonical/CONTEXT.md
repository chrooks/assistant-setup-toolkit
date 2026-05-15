# Lexicon

A reusable set of engineering conversation terms that coding assistants should use consistently during Development Conversations.

The Lexicon should prefer established industry meanings so using it helps the human communicate more clearly in common software engineering language.

## Language

**Lexicon**:
A reusable set of engineering conversation terms that coding assistants should use consistently during Development Conversations.
_Avoid_: Development Conversation Lexicon, engineering glossary, coding terms, shared vocabulary

**Seam**:
A place where behavior can be changed, substituted, or observed without changing surrounding code.
_Avoid_: hook, integration point, gap

**Boundary**:
A line separating responsibilities, ownership, or allowed dependencies between parts of a system.
_Avoid_: edge, border, layer

**Vertical Slice**:
A thin end-to-end increment that delivers behavior across the layers needed for one user-visible outcome.
_Avoid_: feature chunk, task batch, layer slice

**Layer**:
A horizontal grouping of code by responsibility or abstraction level.
_Avoid_: tier, module, area

**Contract**:
An explicit promise about behavior, shape, or interaction that callers and implementers rely on.
_Avoid_: interface, type, agreement

**Surface**:
The exposed area through which other code, users, or systems can interact with something.
_Avoid_: interface, API, entry point

**Invariant**:
A condition that must remain true for a system or concept to be valid.
_Avoid_: preference, assumption, rule of thumb

**Persona**:
A role, voice, or operating posture an assistant adopts to shape how it reasons, communicates, or acts.
_Avoid_: personality, character, prompt

**Affordance**:
A visual or behavioral cue that suggests how something can be used.
_Avoid_: hint, decoration, button style

**Feedback**:
A response that tells the user their action was received, processed, or failed.
_Avoid_: animation, toast, confirmation

**Hierarchy**:
The ordered importance of content or actions expressed through layout, scale, contrast, and placement.
_Avoid_: styling, emphasis, visual weight

**Progressive Disclosure**:
Revealing detail or controls only when they become relevant.
_Avoid_: hiding, modal, advanced settings

**Empty State**:
A UI state shown when no user data, results, or activity exists yet.
_Avoid_: blank screen, placeholder, onboarding

**Error State**:
A UI state that explains a problem and helps the user recover.
_Avoid_: error message, validation text, failure

**Information Architecture**:
How content, actions, and navigation are organized so users can find and understand things.
_Avoid_: sitemap, nav, layout

**Interface**:
The Boundary where a human and a system interact.
_Avoid_: UI, screen, frontend

**Touchpoint**:
A specific moment where a user interacts with a product, service, or system.
_Avoid_: step, screen, interaction

**Signifier**:
A visible cue that communicates an Affordance.
_Avoid_: hint, decoration, label

**Seamlessness**:
A quality where users do not perceive transitions, mechanics, or system boundaries while completing a task.
_Avoid_: smoothness, magic, hidden complexity

**Frictionless**:
The absence of cognitive or mechanical resistance in a user flow.
_Avoid_: easy, effortless, simple

**Intuitive**:
Usable without conscious deliberation because the Interface matches a user's expectations and mental model.
_Avoid_: obvious, natural, self-explanatory

**Transparent**:
A quality where the Interface recedes and the user thinks about the task rather than the tool.
_Avoid_: invisible, hidden, clear

**Calm Technology**:
Technology that informs without demanding attention and can move between the center and periphery of awareness.
_Avoid_: ambient UX, quiet UI, background tech

**Flow**:
A focused psychological state where Friction drops away and attention is absorbed by the activity.
_Avoid_: seamlessness, immersion, engagement

**Honest Signifier**:
A Signifier that accurately communicates the software's real capability, consequence, and intent.
_Avoid_: dark pattern, misleading cue, engagement trick

**Transparent Friction**:
Intentionally surfaced Friction that helps users understand consequences, make better decisions, or avoid dependency.
_Avoid_: blocker, slowdown, engagement brake

**Design Boundary**:
The clearly communicated limit between what software does for a user and what it does with a user.
_Avoid_: limitation, scope, product boundary

**Partnership Model**:
A design posture where humans grow alongside a tool instead of being replaced by it or made dependent on it.
_Avoid_: human-in-the-loop, user empowerment, AI collaboration

**Software as Education**:
Software that teaches a user a framework for thinking rather than only completing a transaction.
_Avoid_: tutorial, explanation, learning app

**Mom Test**:
Testing an Interface with a real non-technical user as a forcing function for clear Signifiers and Progressive Disclosure.
_Avoid_: user test, usability test, beginner test

**Conversation Thread**:
A distinct topical branch within a conversation that can continue, fork, or rejoin other branches.
_Avoid_: tangent, topic, branch
_AKA_: thread

## Relationships

- The **Lexicon** is installed into one or more **Assistant Homes**.
- The **Lexicon** is separate from a project-specific `CONTEXT.md`.
- The **Lexicon** includes conversation-shaping engineering terms, not plain technology names.
- HCI terms in the **Lexicon** should preserve prior-art meanings unless a project-specific `CONTEXT.md` narrows them.
- Chris-specific design terms such as **Honest Signifier**, **Transparent Friction**, **Design Boundary**, **Partnership Model**, and **Software as Education** should be used when they clarify design intent.
- The **Lexicon** should align terms with established industry usage instead of inventing private meanings.
- The **Lexicon** should stay lean because it is intended to live in the assistant's context window.

## Example dialogue

> **Dev:** "When I say seam, I mean the place where behavior can be changed without rewriting the whole system."
> **Assistant:** "Got it — let's add **Seam** to the **Lexicon** so we use it consistently."

## Flagged ambiguities

- "Target Home Directory" was used to mean **Assistant Home** — resolved: use **Assistant Home** for user-level install destinations owned by, or discovered by, an assistant.
- "technological terms" could mean technology names or engineering conversation terms — resolved: include conversation-shaping terms such as **Seam**, **Boundary**, **Vertical Slice**, and **Layer**; exclude plain technology names such as React, FastAPI, PostgreSQL, Vitest, and Supabase.
- "my house style" could mean private definitions that differ from industry usage — resolved: prefer industry-standard meanings so the Lexicon reinforces clearer industry tech-speak.
- "teaching glossary" could mean long explanations, examples, and common misuses for every term — resolved: default each term to a concise definition and `_Avoid_` line; use `## Flagged ambiguities` only when a misuse is important enough to preserve.
