# Routing fixtures

Worked examples of asks paired with the artifact they should produce. Read this when a request does not obviously match a row of the routing table in [SKILL.md](SKILL.md).

These fixtures serve two purposes: they document the routing table by example, and they are the source of scenarios for `/skill-stocktake test toolkit`, which grades whether a fresh sub-agent reaches for this Skill unprompted (FIRE) and honors its rules once inside (FOLLOW).

## Should fire

| The ask, in the user's words | Destination | Why |
|---|---|---|
| "make a skill that turns a design brief into a component checklist" | Skill | A repeatable multi-step workflow with a named output. |
| "I want a command that drafts release notes from the last ten commits" | Skill | "Command" in the user's mouth means Skill here — the toolkit has no other command surface. |
| "in Python files, always use `pathlib` instead of `os.path`" | rule, `canonical/rules/python/` | Scoped to a language, so it is `paths:`-gated and costs no instruction budget. |
| "React components should never inline styles" | rule, `canonical/rules/react/` | Same shape, different area directory. |
| "lead every completion report with the plain-English summary" | instruction | Universal and conversational — it applies to every response in every repo. |
| "from now on always run typecheck before committing" | instruction **and** hook | "Always" plus a mechanical, checkable action. Ask the belt-and-suspenders question, then write both. |
| "never let me push to main without running the tests" | instruction **and** hook | "Never" plus an enforceable runtime event. The hook is the half that survives the model forgetting. |
| "on my work laptop, make a skill that searches Active Directory" | Skill at machine scope, `canonical/machines/work/skills/` | The user named the machine. Scope is stated, not inferred. |
| "the work laptop sits behind a corporate proxy on port 8080" | machine rule, `canonical/machines/work/rules.md` | A fact true on one machine, not a workflow. |
| "pull in that vercel-labs find-skills skill" | external source, `manifests/install.yaml` | Somebody else's published work. |
| "drop the caveman rule, I don't use it" | remove | Confirm the blast radius once, then prune. |
| "the commit skill should stop asking before it pushes" | update | An existing artifact changes in place; preserve everything else. |

## Should not fire

| The ask | What it is | Do instead |
|---|---|---|
| "how does the Setup Wizard decide which files to install?" | a question about the toolkit | Answer it. Read the source if needed. |
| "what does safe-merge do?" | a question about the toolkit | Answer it. |
| "which skills do I have installed?" | an inventory question | List them. `/skill-stocktake` if the user wants a real audit. |
| "why did that skill not fire?" | a diagnosis | Diagnose it. Changing the description afterward *would* be a `/toolkit` update — but only after the user asks for the change. |
| "add a retry to the fetch call in `api.ts`" | ordinary code work | Implement it. This is not toolkit configuration. |
| "remember that I prefer tabs over spaces" | a memory | Auto-memory, not an instruction. Instructions are for behavior the model must follow every session; memories are recalled facts. |

The last row is the one worth internalizing. A learning or correction goes to auto-memory. A rule the model must follow **every time** goes to an instruction. Routing a memory into `INSTRUCTIONS.md` spends scarce budget on something the memory system already handles.

## Ambiguous — ask one question

| The ask | The question to ask |
|---|---|
| "I always want conventional commit messages" | "Guidance, or enforced by a hook even when I forget?" |
| "add a rule about error handling" | "Everywhere, or in one language's files?" — universal is an instruction, language-scoped is a rule. |
| "make this a skill" with no repeatable process behind it | "What are the steps?" A Skill with one step is a rule or an instruction wearing a costume. |

One short question beats a wrong file. Writing to the wrong destination costs a second edit plus a wizard run to clean up the first.
