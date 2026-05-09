# Lexicon

A reusable glossary of engineering conversation terms that coding assistants should use consistently during Development Conversations.

The glossary should prefer established industry meanings so using it helps the human communicate more clearly in common software engineering language.

## Language

**Lexicon**:
A reusable glossary of engineering conversation terms that coding assistants should use consistently during Development Conversations.
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

## Relationships

- The **Lexicon** is installed into one or more **Assistant Homes**.
- The **Lexicon** is separate from a project-specific `CONTEXT.md`.
- The **Lexicon** includes conversation-shaping engineering terms, not plain technology names.
- The **Lexicon** should align terms with established industry usage instead of inventing private meanings.
- The **Lexicon** should stay lean because it is intended to live in the assistant's context window.

## Example dialogue

> **Dev:** "When I say seam, I mean the place where behavior can be changed without rewriting the whole system."
> **Assistant:** "Got it — let's add **Seam** to the **Lexicon** so we use it consistently."

## Flagged ambiguities

- "Target Home Directory" was used to mean **Assistant Home** — resolved: use **Assistant Home** for user-level install destinations owned by, or discovered by, an assistant.
- "technological terms" could mean technology names or engineering conversation terms — resolved: include conversation-shaping terms such as **Seam**, **Boundary**, **Vertical Slice**, and **Layer**; exclude plain technology names such as React, FastAPI, PostgreSQL, Vitest, and Supabase.
- "my house style" could mean private definitions that differ from industry usage — resolved: prefer industry-standard meanings so the glossary reinforces clearer industry tech-speak.
- "teaching glossary" could mean long explanations, examples, and common misuses for every term — resolved: default each term to a concise definition and `_Avoid_` line; use `## Flagged ambiguities` only when a misuse is important enough to preserve.
