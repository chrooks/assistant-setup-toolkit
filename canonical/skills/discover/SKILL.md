---
name: discover
description: "Prepare for and debrief a conversation with a real external person — writes a printable interview guide with a read-aloud consent line and behavior-based questions, then turns the notes from that conversation into requirements where every line carries the quote that produced it. Use when the user is meeting a client, stakeholder, end user, or subject-matter expert; when they say 'what should I ask them', 'I'm talking to <person> about <thing>', 'here are my notes from the call', 'turn this into requirements', or 'what did they actually ask for'; or when a design frame belongs to people the user has not talked to yet. Not for interviewing the user about their own plan — that is /grill-me. Not for transcribing audio — that is /listen-audio. Not for auditing an already-built flow — that is /design-audit."
argument-hint: "prep <person and topic> | read <notes path>"
user-invocable: true
disable-model-invocation: false
allowed-tools: Read, Write, Edit, Glob, Grep
---

# /discover — their words, or nobody's

This Skill does not add a stage to the route. It removes decisions from the grill.
A decision already closed by a quote arrives at `/grill-me` resolved, so the grill
only handles what is genuinely the user's taste.

Two verbs. `prep` writes the guide carried into the room. `read` turns what came
back into requirements.

**Model-invocable on purpose**, against the house default for side-effectful Skills.
The highest-value moment to fire is the user saying "I'm meeting Dana Thursday"
without naming a Skill. Both verbs only ever create one file in a gitignored folder
and destroy nothing. The do-not-fire list below is the anti-hijack measure.

## Fire / do not fire

**Fire** when a real external person is involved: a meeting is coming, notes from
one exist, or a design frame depends on people not in the room.

**Do not fire** on:

- Interviewing the user about their own plan → `/grill-me`.
- Auditing a flow that already exists → `/design-audit`.
- Turning audio into text → `/listen-audio`. Come back with the transcript.
- An async document the person fills in alone → `/to-questionnaire`. A live meeting
  the user sits in → here.
- Notes headed for a project record → `/canon chronicle`. Notes headed for
  requirements → here.
- A question *about* this Skill.

## What this Skill does not do

- **Transcribe.** `allowed-tools` has no Bash, so it is mechanically incapable of it.
  This sentence is the backup, because Codex projection drops `allowed-tools`.
- **Model the person.** A `/canon` Persona does that. The roster line here is four
  fields. If this person is a standing audience the user briefs repeatedly, make a
  Persona and link it. A Persona whose material carries client data already has a
  home rule in `/canon` — follow it, do not invent a second one.
- **Plan or size.** `/scope` and `/plan`, downstream.
- **Run the handback.** `/prep-demo` for the arc, `/nickify` for the register,
  `/draft-email` to send it.

## Where the files live

`.tasks/<issue#>-<slug>/research/` in the target project, beside `proof/`.

Check before writing, every time — never ask the user:

1. `.tasks/` exists **and** is gitignored → write there.
2. Otherwise → write to `../<repo>-research/`, outside the repo, and say so in one line.

These are a named person's words about their job. Never file them into the user's
knowledge base. Never commit them.

## prep — write the guide

1. Find the work folder. Read the Throughline for context if one exists; never write to it.
2. **Grill the send, not the subject.** Ask exactly two things: who the person is
   and their role, and what decision rides on this conversation. Never ask what the
   user thinks the person will say.
3. Read what the folder already answers — prior guides, any `## Ask next time` section.
4. Run every draft question through the banned-forms table before writing it.
5. Write `research/<person>-<YYYY-MM-DD>.md`. Report the path in one line and say:
   open this in the meeting and type under the numbered lines.

### Banned question forms — rewrite before writing

| Never write | Write instead |
|---|---|
| Would you use… | Tell me about the last time you needed to… |
| Do you like… | Show me what you do instead today. |
| How often do you… | When did you last? And before that? |
| What would you want… | What did you do when it went wrong? |

Five to eight questions for thirty minutes; silence fills the rest. One idea per
question, never compound, never leading. This is the **Mom Test** and the **Nick
Test** made executable, not cited.

### The guide format

```markdown
# <Person> — <topic> — <date>

**Role:** <their job, three words>
**Decision this informs:** <one line>
**Do they do the task themselves?** yes / no
**Recording:** yes / no — asked <time>
**Language:** <what they will speak>

## Read aloud
I'm trying to understand how <task> actually works for you today, not to pitch
anything. There are no wrong answers — if something is broken I need to hear that.
May I record this so I can quote you accurately rather than paraphrase?

## Questions — type answers underneath

1. <question>

2. <question>

## Read back before leaving
Say the three things heard, in the person's own language, and ask what is wrong.
A correction here is worth more than the whole rest of the session.

## Ask next time
```

## read — turn the notes into requirements

1. **Refuse when no notes file exists.** Never write requirements from the
   Throughline, the issue, or memory. A fabricated session is the worst thing this
   Skill can produce.
2. Number anything typed that is unnumbered. `Q<n>` for an answer under guide
   question *n*; `T<n>` for a turn in a raw transcript. Never renumber an existing ID.
3. **Verify every quote.** Grep the exact span back against the notes file before
   writing it into a Quotes column. No match, no row. Grep one line at a time — a
   span crossing a line break is split and each part checked.
4. Write requirements. Every requirement names the quote IDs behind it.
5. Anything nobody said goes under `## Unsourced`, attributed to the user by name.
6. `confirmed: yes` requires that the person **corrected or restated** something in
   their own words. A bare "yes, that's right" is `pending`. Agreement is the
   cheapest thing a person can give and the least informative.
7. A requirement contradicting a closed decision in the Throughline's Decision Ledger
   goes under `## Conflicts`, naming both IDs, and is reported in the completion line.
   Which one wins is the user's call — that is taste, not actualization.
8. Report: the path, the count, how many distinct people have files in `research/`.
   **When it is one, say so in one line.**

### Guards

- **Their language is the evidence.** When the person did not speak English, the
  Quotes column holds their own words, and a `Gloss:` line beneath holds the English.
  Step 3 greps the original, never the gloss. A requirement whose only evidence is a
  gloss is not sourced — it goes under `## Unsourced`, attributed to the translator.
  Read the read-back in their language, not the user's.
- **No recording means no verbatim.** When `Recording: no`, spans are marked
  `paraphrase` and requirements built on them carry `confirmed: pending`.
- **Secondhand is marked.** A requirement traced only to people who answered **no**
  to "do they do the task themselves" is marked `secondhand`. The person who signs
  and the person whose work changes are usually different people, and the signer is
  always easier to book.

## Handoffs

- Requirements exist → `/grill-me` opens by reading them; a decision a quote already
  answers is resolved, not re-asked.
- Design frame → `/idea-to-design`, which reads `requirements.md` instead of
  inventing a user.
- Acceptance criteria → `/plan`. A criterion names its requirement ID; one built on
  a `pending` requirement says so.
- After handback, run both verbs again in feedback mode: `prep` writes a feedback
  guide, `read` scores what held and what broke against the same requirement IDs.
- **Offer the method learning to the user's knowledge base** — a question form that
  worked, a banned form that slipped through, a read-back that changed an answer.
  Never the transcript. Never the person's words.

## Completion criteria

- [ ] Every quote in `requirements.md` greps back to the notes file
- [ ] Every requirement names its quote IDs, or sits under `## Unsourced`
- [ ] Non-English evidence is in the original, with the gloss marked as gloss
- [ ] The research folder is gitignored, or lives outside the repo
- [ ] The distinct-people count was reported
