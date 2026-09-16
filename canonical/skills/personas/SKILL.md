---
name: personas
description: "Set up and run the work-story system in any repo: a personas/ folder with one file per audience, dated ledgers, and text updates made by reading the record since the last update through one Persona. Use when the user invokes /personas, asks for an update for a person or audience (advisor, client, boss, teammate, blog readers), wants to add a Persona, or wants capture → record → Persona → Touchpoint set up in a new repo."
argument-hint: "init | add <name> | update <name> [since <date>]"
disable-model-invocation: true
---

# /personas — one record, one lens per audience

The record is dated one-liners (`decisions.md`, `learning-log.md`), checklist ticks, and `git log`. A Persona is one file per audience: the audience archetype that sets the assistant's posture. An update is the record since the last update, read through one Persona, written as text where that Persona says.

## Commands

| Command | Action |
|---|---|
| `/personas init` | Create the recipe in this repo |
| `/personas add <name>` | Create one Persona file from the Contract |
| `/personas update <name> [since <date>]` | Write the Touchpoint for that audience |
| `/personas` | List Personas with level and cadence |

## The Contract — six fields, never one more per audience

```
# Persona — <Name>
- **Who:** role, relationship, how they are contacted
- **Level:** 1–5 on the ladder, and the word
- **Cares about:** the questions they actually ask
- **Must not hear:** the discretion rule
- **Cadence:** when an update happens
- **Register:** voice, form, length, and where the Touchpoint lives
```

## The ladder — exposure only; topic and register live in the Persona

```
5 public    patterns and learnings; no names, no numbers, no client
4 client    their engagement only
3 peer      what I build and how; tools, techniques
2 advisor   money, contracts, exposure; under professional confidence
1 ledger    everything; the user and the assistant
```

An event carries a ceiling, the highest level it may reach. Ceilings default per file: `decisions.md` 2, checklists 2, `learning-log.md` 3, commit messages 3. A trailing tag on a line overrides it; the tag format is decided when the first level-4 Persona is used. An update includes an event when the Persona's level ≤ the ceiling.

## init

1. Create `personas/README.md` holding the Contract and the ladder above, `decisions.md`, `learning-log.md`, and one checklist. `git init` if the folder is not a repo.
2. Ledger line format: `- YYYY-MM-DD — one sentence.` Newest last. `OPEN —` lines are questions, not decisions.
3. Report the files created in one line. No Personas yet; `add` makes them.

## add <name>

1. Write `personas/<name>.md` from the Contract. Fill what is known; write `TBD` for the rest.
2. Level comes from the ladder. Register names where the Touchpoint lives (an agenda file, a client repo, a post draft).

## update <name>

1. Read `personas/<name>.md`.
2. Since-date: the argument; else the date on the Persona's last Touchpoint; else 14 days ago.
3. Read the record since that date: `git log --since=<date> --format='%ad %s' --date=short`; dated lines in `decisions.md` and `learning-log.md`; `- [x]` lines carrying a date in the window.
4. Keep events whose ceiling ≥ the Persona's level. Drop what "Must not hear" names.
5. Write the Touchpoint in the register, where the Persona says. Lead with what changed, then the asks. Put the date range in the heading.
6. Never read another repo. A Persona reads only the repo it lives in.

## Boundaries

- One repo per context, one machine per repo. Day-job Personas live in the work repo; a side business's Personas live in its own. There is no cross-repo read.
- A Persona whose Touchpoints carry client data keeps its file in the business repo and its Touchpoints in that client's repo.
- The blog (public) Persona is duplicated per repo.

## Completion

- `init`: the five files exist and the report names them.
- `add`: the file exists with six fields.
- `update`: the Touchpoint is written where the Persona says, dated, and nothing above the Persona's level or in "Must not hear" appears in it.
