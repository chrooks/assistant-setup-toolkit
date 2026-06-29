---
name: quiz-me
description: Quiz yourself on anything for active recall — point it at a file, a concept, the codebase, or "last chat" (the previous conversation in this repo). Asks questions one at a time, grades your answer, then reveals. Use when the user invokes /quiz-me, says "quiz me", "test my recall", or wants to be quizzed on a file, topic, or the last conversation.
argument-hint: "[target: a file path, a concept, or 'last chat']"
disable-model-invocation: false
allowed-tools: Read, Grep, Glob, Bash
---

# Quiz Me

Run an active-recall quiz on whatever the user points at. Retrieving an answer
from memory before re-reading it is a stronger way to retain it than scrolling
back through a file or a transcript. This skill is a general engine: `last chat`
is just one of its targets, not the whole product.

## Step 1 — Resolve the target

The target is the argument string. Resolve it in this order:

1. **`last chat`** (case-insensitive; also matches "the last chat", "previous
   conversation", "last conversation"). This means the previous conversation in
   the **current repo**. Resolve it like this:
   - Compute the encoded working directory: take the absolute current directory
     and replace every `/` and `.` with `-`. Example: `/home/you/projects/App`
     becomes `-home-you-projects-App`.
   - Look in `~/.claude/projects/<encoded-cwd>/` for `*.jsonl` files. Pick the
     most recently modified one whose modification time is more than two minutes
     old — that excludes the session currently being written. That file is the
     previous conversation; read it as the quiz source.
   - A transcript can be large. Read the tail (most recent portion) and the
     user-authored turns rather than the whole file, and prefer the substance —
     decisions made, files changed, problems solved, the next step left for
     next time — over mechanical tool chatter.
   - Additionally, if `~/.claude/projects/<encoded-cwd>/memory/` exists, read its
     files and fold them in, so the quiz can ask about settled decisions and
     their rationale, not only surface events.
   - Do **not** quiz from the "Previous session summary" block injected at
     session start — it is global, not per-repo, and may describe a different
     project.
2. **A path that exists.** If the argument names a file or directory on disk
   (check with the file tools), quiz from that file's content (for a directory,
   a representative read of it).
3. **Otherwise, a concept or topic.** Quiz from your own knowledge, enriched by
   anything this repo documents about the term (a quick search of the working
   tree for it).
4. **Empty argument.** Ask the user what they want to be quizzed on, and offer
   the current repo's `last chat` as the default.

A trailing integer in the argument sets the question count (e.g. `last chat 5`
means five questions). Default is **3**.

## Step 2 — Generate the questions

Write recall questions from the resolved source. They must demand **retrieval,
not recognition**: prefer "why did we choose X over Y", "what did this function
guarantee about its input", "what was the next step we left for ourselves" over
yes/no or multiple-choice. Default to 3 questions.

## Step 3 — Run the quiz one question at a time

Grill-style, like `/grill-me`:

1. Ask question one and **stop**. Do not show the other questions.
2. When the user answers, **grade it honestly** — say plainly what they got,
   what they missed, and whether the recall was right, partial, or wrong. No
   inflated praise; an honest grade is the whole point.
3. **Reveal** the full answer.
4. Ask the next question. Repeat.
5. After the last question, give a one-line tally of how the recall went.

## Step 4 — Respect the bail word

If the user says "skip", "stop", or "done" at any point, end the quiz
immediately and summarize what was covered.
