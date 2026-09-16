---
name: canon
description: "Keep a Canon, the dated record of a body of work, and tell it to each audience. Verbs: init (ledgers, a checklist, personas/, the two hooks), add <name> (a Persona), chronicle [file] (turn a capture — voice memo, call recording, meeting notes, whiteboard photo — into Beats in the Canon), cut <name> (one audience's update from the Canon since their last Cut). Use when the user invokes /canon, says chronicle this, log it, cut for <person>, asks for an update for an advisor, client, boss, teammate, or blog readers, or wants capture → record → Persona → Touchpoint set up in a repo."
argument-hint: "init | add <name> | chronicle [file] | cut <name> [since <date>]"
disable-model-invocation: true
---

# /canon — one record, one lens per audience

**Canon**: the record as truth — `decisions.md`, `learning-log.md`, one checklist, `git log`. **Beat**: one dated line or tick in it. **Chronicling**: writing a capture into the Canon as Beats. **Persona**: one file per audience, the archetype that sets the assistant's posture. **Cut**: one audience's telling of the Canon since their last Cut, through their Persona, written where the Persona says.

## Commands

| Command | Action |
|---|---|
| `/canon init` | Ledgers, a checklist, personas/, inbox/, archive/, git, and the two hooks |
| `/canon add <name>` | One Persona file from the Contract |
| `/canon chronicle [file]` | Turn a capture into Beats; no file → every capture in inbox/ |
| `/canon cut <name> [since <date>]` | Write that audience's Cut |
| `/canon` | List Personas with level and cadence; count captures in inbox/ |

## The Contract — six fields, never one more per audience

```
# Persona — <Name>
- **Who:** role, relationship, how they are contacted
- **Level:** 1–5 on the ladder, and the word
- **Cares about:** the questions they actually ask
- **Must not hear:** the discretion rule
- **Cadence:** when a Cut happens
- **Register:** voice, form, length, and where the Cut lives
```

## The ladder — exposure only; topic and register live in the Persona

```
5 public    patterns and learnings; no names, no numbers, no client
4 client    their engagement only
3 peer      what I build and how; tools, techniques
2 advisor   money, contracts, exposure; under professional confidence
1 ledger    everything; the user and the assistant
```

A Beat carries a ceiling, the highest level it may reach. Ceilings default per file: `decisions.md` 2, checklists 2, `learning-log.md` 3, commit messages 3. A trailing tag on a line overrides it; the tag format is decided when the first level-4 Persona is used. A Cut includes a Beat when the Persona's level ≤ the ceiling.

## init

1. Create `personas/README.md` (the Contract and ladder above), `decisions.md`, `learning-log.md`, `checklist.md`, `inbox/README.md` ("unprocessed captures; empty means caught up"), `archive/README.md`. `git init` if the folder is not a repo. Beat format: `- YYYY-MM-DD — one sentence.` Newest last. `OPEN —` lines are questions.
2. Install the two hooks. Copy from this skill's `scripts/` into `<repo>/scripts/hooks/`, then wire `.claude/settings.json`:
   - `SessionStart` → `bash "$CLAUDE_PROJECT_DIR/scripts/hooks/inbox-nudge-session-start.sh"`: names unprocessed captures in inbox/ and says to chronicle them first. Silent when empty.
   - `Stop` → `node "$CLAUDE_PROJECT_DIR/scripts/hooks/log-owed-stop.cjs"`: blocks a session ending with an uncommitted Canon, once; yields on the second pass.
   - In a code repo, append the Canon paths so half-done code never trips it: `node "$CLAUDE_PROJECT_DIR/scripts/hooks/log-owed-stop.cjs" decisions.md learning-log.md checklist.md personas inbox archive`. A docs repo passes nothing; the whole tree is the Canon.
3. Ignore capture media in `.gitignore`, scoped to `inbox/` and `archive/`: `*.m4a *.mp3 *.wav *.jpg *.jpeg *.png *.heic`. The transcript or the Beat is the record.
4. Run both checks: `bash scripts/hooks/test-inbox-nudge.sh` and `bash scripts/hooks/test-log-owed-stop.sh`.
5. Report in one line: the files created and both check results. No Personas yet; `add` makes them.

## add <name>

1. Write `personas/<name>.md` from the Contract. Fill what is known; write `TBD` for the rest.
2. Level comes from the ladder. Register names where the Cut lives (an agenda file, a client repo, a post draft).

## chronicle [file]

1. Input: a path, or nothing → every capture in inbox/ (README excluded). A memo's audio and transcript share a stem and count once.
2. Audio → a transcript beside it: `whisper-ctranslate2 --model small`. If the tool is missing, say so and stop on that file. Image → read it. Text → read it.
3. Write Beats, one sentence each, dated the capture's date. A decision → `decisions.md`. A learning → `learning-log.md`. A done task → tick its checklist line. A follow-up for a named person → their agenda or Persona note. A question → an `OPEN —` line.
4. Boundaries. Client data never enters this Canon: name where it goes and leave it out. An idea for the user's knowledge base goes there only with approval; do not file it.
5. Move the capture and its transcript to `archive/`. Media stays ignored by git; the transcript is tracked.
6. One commit. Report one line: `Chronicled <capture>: N ticks, M Beats, committed <sha>.`
7. No read-back, no approval. Git is the undo.

## cut <name> [since <date>]

1. Read `personas/<name>.md`.
2. Since-date: the argument; else the date on the Persona's last Cut; else 14 days ago.
3. Read the Canon since that date: `git log --since=<date> --format='%ad %s' --date=short`; dated lines in `decisions.md` and `learning-log.md`; `- [x]` lines carrying a date in the window.
4. Keep Beats whose ceiling ≥ the Persona's level. Drop what "Must not hear" names.
5. Write the Cut in the register, where the Persona says. Lead with what changed, then the asks. Put the date range in the heading.
6. Never read another repo. A Persona reads only the repo it lives in.

## Boundaries

- One repo per context, one machine per repo. Day-job Personas live in the work repo; a side business's Personas live in its own. There is no cross-repo read.
- A Persona whose Cuts carry client data keeps its file in the business repo and its Cuts in that client's repo.
- The blog (public) Persona is duplicated per repo.

## Completion

- `init`: the files exist, both hook checks pass, and the report names them.
- `add`: the file exists with six fields.
- `chronicle`: the capture is archived, the Beats are committed, one report line.
- `cut`: written where the Persona says, dated, and nothing above the Persona's level or in "Must not hear" appears in it.

Bundled: `scripts/inbox-nudge-session-start.sh`, `scripts/log-owed-stop.cjs`, and their checks `scripts/test-inbox-nudge.sh`, `scripts/test-log-owed-stop.sh`.
