# Resource Index

The user's durable resources. The machine context (`rules/machine.md`, ADR-0003) gives the local path or access mode for each one on this machine. With no machine context, assume only the claude.ai access modes.

| Resource | What it is | Use it for | Access modes |
|---|---|---|---|
| The brain | the LLM-Wiki knowledge base: an Obsidian vault (`brain-v2`) of wiki pages, raw sources, and entity and concept pages with wikilinks | durable knowledge: learnings, teardowns, project notes, people, concepts; where "ingest this" filings land | the brain MCP connector on claude.ai; direct vault read on a machine with a clone |
| The toolkit | the Assistant Setup Toolkit repo: the Canonical Assistant Source for all assistant configuration, and the Setup Wizard that installs it | changing how assistants behave anywhere; edit `canonical/`, run the wizard, never edit installed copies | local git clone; GitHub remote |
| The Lexicon | the global engineering-conversation Lexicon; a project `LEXICON.md` overrides it term by term | the canonical terms in every Development Conversation | `~/.claude/LEXICON.md`; source is `canonical/LEXICON.md` |
| The profile | who the user is: values, trajectory, design philosophy | reasoning from who the user is when advising, designing, or prioritizing | `~/.claude/PROFILE.md` (local-only); re-distilled with `/sync-self` |

Skill routing lives in CLAUDE.md, "Right Skill, Right Job".
