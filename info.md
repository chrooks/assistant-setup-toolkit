Context:
This is a knowledge-transfer handoff. The new conversation will apply the Interpreter → Orchestrator → Workers (with Tools) agent-graph pattern to a different domain. This document carries the pattern, the design rules, and the implementation choices that crystallized during a Coach Homie grilling session — so the new conversation can apply them without re-deriving from scratch. Coach Homie is referenced only as a worked example; it is not the new context's domain.

Current implementation status:
- The pattern was selected as the long-term agent architecture for one project (Coach Homie). Decisions were made; nothing has been built yet.
- Worker taxonomy was resolved: deterministic, LLM, hybrid — with a decision rule for when to use which.
- The tool/worker duality was resolved: the same function can be both, exposed two ways.
- Stack and SDK choices were locked: TypeScript end-to-end, Node runtime, Vercel AI SDK for streaming + tool-call protocol, zod for schema validation and inter-agent contracts, custom orchestration over Mastra / LangGraph for small graphs.
- Streaming-end-to-end was identified as a load-bearing requirement and saved as project memory.
- Three ADRs documented the supporting decisions (storage architecture, stack, two-phase delivery) — not needed verbatim in the new context, but the *principles* carry over.
- No code written yet for the agent graph in the source project. The pattern is design-locked but unimplemented.

The pattern (full description):

User → Interpreter → Orchestrator → { Worker | Worker | Worker } → Tools

- **Interpreter** — natural language in, structured intent out. Normalizes the user's message into a typed domain object (e.g., parses "I'm beat up today, 30 min" into an explicit state struct). LLM-based; this is where ambiguity gets resolved.
- **Orchestrator** — given parsed intent + current state (read from the domain's stable substrate), decides which worker(s) to dispatch and in what order. Holds the graph's control flow. Can be deterministic (a switch statement on intent type) or LLM-based (when routing is itself a judgment). For small graphs, deterministic is simpler.
- **Workers** — focused units of work. Each handles one well-scoped task. Three subtypes (see worker taxonomy below).
- **Tools** — typed functions exposed to LLM workers. Same JSON Schema convention used by Anthropic / OpenAI tool-call protocols. zod schema → JSON Schema descriptor is one line.

Worker taxonomy:
- **Deterministic worker** — pure function, no LLM. Used when the answer is unambiguous, must be repeatable, or is a database/lookup query. Predictable, fast, cheap, testable. Example: "retrieve the user's all-time max squat and the session it occurred in." This is a SQL query, not a judgment.
- **LLM worker** — agent that uses LLM reasoning. Used when the work requires actual judgment, synthesis, or generation. Example: rank a list of candidates by how well each fits the user's goals and current vibe.
- **Hybrid worker** — LLM agent with tools. The LLM's role is to *decide* which tools to call and *synthesize* the results; the tools themselves are deterministic. Example: a recommendation agent that calls `read_history`, `read_preferences`, `read_inventory` (all deterministic) and produces a ranked recommendation.

Decision rule: prefer determinism whenever the answer is unambiguous. Reserve LLMs for actual judgment. Every piece of logic moved from LLM to deterministic gains repeatability, speed, lower cost, and testability. The agent graph is *not* "everything is an LLM agent" — it is "the orchestrator dispatches to whichever worker (deterministic or LLM) fits the parsed intent."

Tool/worker duality:
A function like `get_user_max(metric_id)` can be:
1. Called directly by the orchestrator as a deterministic worker, when intent unambiguously demands it.
2. Exposed as a tool to an LLM worker, when the LLM might or might not need it depending on context.
Build it once (e.g., in `lib/queries/`), expose it both ways. The "tool" wrapper is just a JSON Schema descriptor over the same underlying function. No duplication.

Mapping rule:
| Situation | Where it goes |
|---|---|
| Orchestrator deterministically knows it needs X computed | Deterministic worker |
| LLM agent might or might not need X depending on context | Tool exposed to that agent |
| Same logic, both situations | One function, two adapters |

Important working instructions (carry these into the new context):
- The pattern is overkill for simple CRUD or single-LLM-call applications. Apply only when the application has (a) a chat-mediated UX, (b) multiple distinct kinds of work the agent needs to do per turn, and (c) a domain rich enough to warrant decomposition.
- Streaming is end-to-end. LLM workers stream tokens through the orchestrator and back to the user. Do not introduce blocking checkpoints in the worker chain. Vercel AI SDK's `streamText` re-emit pattern handles this cleanly. Long-form output without streaming feels broken.
- zod is load-bearing. It validates inputs/outputs of every worker, defines inter-agent message contracts, and produces JSON Schemas for tool descriptors. One library, three jobs.
- Custom orchestration beats frameworks for small graphs (3–5 workers). The "agent graph" is a switch statement plus async function calls. Mastra / LangGraph add abstraction overhead that doesn't pay off until the graph is large or branching is complex. Reserve framework adoption for when explicit code becomes painful, not before.
- Vercel AI SDK is the recommended LLM SDK over raw `@anthropic-ai/sdk` for this pattern, because it gives streaming + tool-call protocol with first-class ergonomics. Swap to raw SDK is possible if Vercel AI SDK becomes painful — keep the abstraction layer thin.
- Node runtime, not Bun, when the application will be self-hosted by others. Bun is fine for local dev velocity; production target should be Node for lowest-common-denominator self-hosting.
- Storage discipline (orthogonal but related): distinguish build-time content (committed JSON / Markdown, lives in `data/`) from runtime user state (database). Don't conflate. The pattern's deterministic workers often query both — keep the boundary clean.
- Don't pre-build for theoretical scale. Most agent-graph applications run at single-user or single-tenant scale; architectural decisions should be driven by self-hostability and developer experience, not theoretical fan-out.

Next step (in the new conversation):

Apply this pattern to the new domain. Concretely, work through these grilling questions before writing code:
1. **What is the input the Interpreter parses?** Chat message? Voice? Structured form? What ambiguity does it have to resolve?
2. **What is the structured intent the Interpreter emits?** Define this as a discriminated union. Each variant becomes a route in the orchestrator.
3. **What state does the Orchestrator read before dispatching?** Identify the stable substrate (lexicon, knowledge base, user profile, history). What lives in committed JSON vs DB?
4. **Enumerate the workers.** For each, classify as deterministic / LLM / hybrid. List the tools each LLM worker can call.
5. **Identify the tool/worker duality cases.** Which functions deserve to be both?
6. **What needs streaming?** Output paths from LLM workers to the user need streaming end-to-end. Map those paths.
7. **What's the equivalent of "ankle flare"** — what triggers the orchestrator to re-route or substitute? This is the domain's daily-state-check question.
8. **What's the equivalent of the Lexicon** — the canonical reference data the workers read but rarely write? Does the new domain have one? If yes, it's likely committed JSON, not DB.

Once those are resolved, the implementation is straightforward: zod schemas for messages, deterministic workers as pure functions in `lib/queries/`, LLM workers as `streamText` calls with `tools` array, orchestrator as a switch statement. No framework needed.

Reference example (for grounding only, not for direct application):
Coach Homie is a daily training agent for one athlete. Its graph: Interpreter parses user state ("I'm beat up, 30 min today") → Orchestrator routes to (a) Substitution Engine (hybrid — deterministic Intent Type filter + LLM ranking by Goal alignment), (b) Rotation Advancer (deterministic — increment Day position, evaluate Block transition), (c) Progression Evaluator (deterministic — check Milestones against History to fire Gate unlocks), (d) Prescription Assembler (LLM — synthesizes the final Daily Prescription with reasoning). Tools: `read_lexicon`, `query_history`, `read_goals`, `read_rotation`, `get_personal_record`. The Lexicon is committed JSON; History is SQLite (or JSON during a Cowork POC phase).

Expectations for this conversation:
1. Treat this handoff as the only context from the source project. Do not assume any other Coach Homie details apply to the new domain.
2. Begin by establishing the new domain's specifics — do not start writing code or schemas until the eight grilling questions above are answered.
3. Apply the worker taxonomy and tool/worker duality rules as design discipline, not as suggestions.
4. Push back on framework adoption (Mastra, LangGraph, etc.) unless the graph is genuinely complex (>5 workers, real branching). Custom orchestration is the default for new applications of this pattern.
5. Surface streaming requirements early. If the new domain has long-form LLM output, the orchestrator must be designed to stream from day one — retrofitting streaming into a non-streaming graph is painful.
6. If the new domain has a "Lexicon equivalent" (canonical reference data), apply the storage discipline: committed JSON in `data/`, not database.
7. If anything in this handoff conflicts with the new domain's actual requirements, the new domain wins. The pattern is a tool, not a constraint. Document the deviation explicitly.

Verification baseline:
No code is being preserved across this handoff — it is purely a knowledge transfer. The verification target is design coherence in the new context:
- The pattern's roles (Interpreter / Orchestrator / Worker / Tool) are explicitly mapped to concrete components in the new domain before any implementation begins.
- Every worker is classified (deterministic / LLM / hybrid) with a stated reason.
- Every LLM worker has its tool surface enumerated.
- Streaming paths are identified explicitly, not assumed.
- The build-time-content vs runtime-state boundary is explicit for whatever the new domain's data model is.
- A "Coach Homie reference" check: if the new domain ends up with the same shape of architecture, that's a signal you've copied not adapted — the worker decomposition should reflect the new domain's actual decision points, not Coach Homie's.