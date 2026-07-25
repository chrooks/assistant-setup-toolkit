# Resource Index

Chris's durable resources — what exists, what each is for, and every known way
in. **Local access** for each entry lives in the machine context
(`rules/machine.md`, ADR-0003): its "Resource access" section says which mode
is live on this machine and at what path. The machine file may also list
machine-local resources this index doesn't know about. No machine context
present → assume only the claude.ai access modes below.

## The brain

- **What:** Chris's LLM-Wiki knowledge base — an Obsidian vault (`brain-v2`)
  of wiki pages, raw sources, and entity/concept pages with wikilinks.
- **For:** durable knowledge: learnings, teardowns, project notes, people,
  concepts. Where "ingest this" filings land and where past context lives.
- **Access modes:** Athena MCP (claude.ai connector — search, read, inbox
  tools) · direct vault read on machines holding a clone.
- **Local access:** see machine context.

## The toolkit

- **What:** the Assistant Setup Toolkit repo — the Canonical Assistant Source
  for all assistant configuration (instructions, skills, hooks, rules) and
  the Setup Wizard that installs it.
- **For:** changing how assistants behave anywhere. Edit `canonical/`, run
  the wizard; never edit installed copies in `~/.claude` directly.
- **Access modes:** local git clone (path varies per machine) · GitHub remote.
- **Local access:** see machine context.

## The Lexicon

- **What:** the global engineering-conversation Lexicon; project `LEXICON.md`
  files override it term-by-term.
- **For:** using and linking canonical terms consistently in every
  Development Conversation.
- **Access modes:** installed at `~/.claude/LEXICON.md` on every machine;
  canonical source is `canonical/LEXICON.md` in the toolkit.
- **Local access:** `~/.claude/LEXICON.md`.

## The profile

- **What:** the distilled profile of who Chris is — values, trajectory,
  design philosophy (Partnership Model, Honest Signifier, Transparent
  Friction).
- **For:** reasoning from who Chris is when advising, designing, or
  prioritizing — the design-ethos source for `/design-audit` and
  `/idea-to-design`.
- **Access modes:** installed at `~/.claude/PROFILE.md` (local-only; missing
  file is a no-op). Re-distilled from the brain via `/sync-self`.
- **Local access:** `~/.claude/PROFILE.md`.

## Skill routing

- **What:** which Skill to reach for per job.
- **For:** picking the right workflow instead of improvising one.
- **Access modes:** CLAUDE.md → "Right Skill, Right Job" — already in
  context; this entry exists so you know that section is the source of truth.
- **Local access:** always loaded.
