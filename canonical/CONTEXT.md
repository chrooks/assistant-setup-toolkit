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

**Nick Test**:
Testing an Interface with a capable-but-investment-averse user as a forcing function for immediate utility and zero required onboarding — value must land before the user invests effort. The complement to the **Mom Test**: Mom checks whether it can be *learned*, Nick checks whether it is worth the *bother*.
_Avoid_: user test, engagement test, friction test
_AKA_: Nick

**Conversation Thread**:
A distinct topical branch within a conversation that can continue, fork, or rejoin other branches.
_Avoid_: tangent, topic, branch
_AKA_: thread

## Relationships

- The **Lexicon** holds conversation-shaping engineering terms, not plain technology names.
- Terms align with established industry usage; HCI terms preserve prior-art meanings unless a project `CONTEXT.md` narrows them.
- Chris-specific design terms — **Honest Signifier**, **Transparent Friction**, **Design Boundary**, **Partnership Model**, **Software as Education** — should be used when they clarify design intent.
- The **Lexicon** stays lean because it lives in the assistant's context window.

## Example dialogue

> **Dev:** "When I say seam, I mean the place where behavior can be changed without rewriting the whole system."
> **Assistant:** "Got it — let's add **Seam** to the **Lexicon** so we use it consistently."

## Flagged ambiguities

- "Target Home Directory" was used to mean **Assistant Home** — resolved: use **Assistant Home** for user-level install destinations owned by, or discovered by, an assistant.
- A flag lives here only until its resolution is absorbed into a term's definition or the sections above — then it is deleted. This section records live resolutions, not history.
