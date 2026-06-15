---
name: notebooklm-export
description: Turn brain-wiki pages — especially interview-prep teardowns — into NotebookLM study materials (study guide, quiz, audio overview) via the unofficial notebooklm-py CLI. Bundles the right wiki/experience pages for a prep topic, drives NotebookLM, and files the study outputs back into the vault. Use when the user says "make study materials", "notebooklm export", "turn my teardown into a podcast / quiz / study guide", "study guide from my brain", or wants interview-prep study artifacts generated from wiki pages.
argument-hint: "<prep topic, teardown name, or wiki page path>"
disable-model-invocation: false
---

# NotebookLM Export

Turn brain-wiki pages into NotebookLM study materials: a **study guide**, a **quiz**, and
an **audio overview** ("deep dive" podcast). Built for interview prep — the richest input
is a `wiki/experience/teardowns/<topic>.md` page.

This is a **thin wrapper** over the unofficial [`notebooklm-py`](https://github.com/teng-lin/notebooklm-py)
CLI. The skill owns only the brain-specific [Seam](~/.claude/CONTEXT.md): picking the right
wiki pages for a topic, driving the CLI, and filing the study outputs back into the vault.
The generic NotebookLM [Surface](~/.claude/CONTEXT.md) (every artifact type, chat, research,
sharing) belongs to the upstream `notebooklm` skill — **do not reimplement it here.**

**[Boundary](~/.claude/CONTEXT.md):** DATA (the corpus, teardowns, generated study outputs)
lives in the brain vault. TOOLING (the CLI, its venv) lives outside it. Never put a `.venv`
or executable code in the vault.

**Caveat — unofficial:** `notebooklm-py` rides undocumented Google APIs and can break without
notice. Treat every step as best-effort. Surface failures plainly, fall back, and never make
this skill a hard dependency of anything critical. Credit: `teng-lin/notebooklm-py` (MIT).

> The CLI binary is `notebooklm`. All steps assume it is on `PATH` (see
> [setup-and-auth.md](./references/setup-and-auth.md)). Exact command shapes for the whole
> flow live in [cli-recipes.md](./references/cli-recipes.md).

## Step 0 — Preflight (fail gracefully, don't auth for the user)

1. **Resolve the vault.** Read `~/.claude/knowledge-config.json` for `vaultPath` and `wikiDir`.
   If it's missing, ask the user for the vault location — never guess.

   ```bash
   cat ~/.claude/knowledge-config.json
   ```

2. **Check the CLI is installed.** If `command -v notebooklm` finds nothing, stop and point
   the user at [setup-and-auth.md](./references/setup-and-auth.md) to install it. Do not try
   to install it silently.

3. **Check auth.** Run `notebooklm auth check --test --json` and require BOTH `"status": "ok"`
   AND `"checks": { "token_fetch": true }`. Bare `status: ok` without `--test` is a
   false-positive (a stale cookie file still parses). If auth fails, tell the user to run
   `notebooklm login` (or `notebooklm auth refresh` if it was working but went stale) and
   **stop** — logging into the user's Google account is theirs to do, not yours.

## Step 1 — Pick the topic and bundle the source pages

`$ARGUMENTS` is a prep topic, a teardown name, or a wiki page path.

- The default richest input is `<vaultPath>/<wikiDir>/experience/teardowns/<topic>.md`.
- Optionally add a few **directly related** pages (an `accomplishments/` entry, a `roles/`
  page, `capabilities.md`) that deepen the same topic. Use Glob/Read to find them.
- Keep the source set **tight**. NotebookLM grounds its output in the sources you give it, so
  unrelated pages dilute the study material. A teardown plus one or two related pages is plenty.

Show the user the proposed source list and confirm before uploading — this is the cost/write
gate. Confirm which artifacts they want here too (default: all three).

## Step 2 — Create the notebook and add sources

```bash
NID=$(notebooklm create "<Topic> — Study" --json | jq -r .notebook.id)
notebooklm source add "<page path>" --notebook "$NID" --json     # repeat per page
notebooklm source wait <source_id> --notebook "$NID"             # until status: ready
```

Always pass `--notebook "$NID"` explicitly rather than relying on `notebooklm use` — that
keeps the skill safe if it ever runs alongside another NotebookLM job.

## Step 3 — Generate the study artifacts (ask before running — long & may fail)

| Artifact | Command |
|----------|---------|
| Study guide | `notebooklm generate report --format study-guide --notebook "$NID" --wait --json` |
| Quiz | `notebooklm generate quiz --notebook "$NID" --wait --json` |
| Audio overview | `notebooklm generate audio "<focused instructions>" --notebook "$NID" --wait --timeout 540 --json` |

- **Audio takes 5–15 minutes** and `--wait` frequently returns while the task is still
  `"pending"`. When that happens, poll to completion: `notebooklm artifact wait <audio_artifact_id> --notebook "$NID"`
  (get the id from `notebooklm artifact list --notebook "$NID" --json`).
- Write audio instructions aimed at interview prep: the product, the user's role, key
  decisions and tradeoffs, and what an interviewer would probe.

## Step 4 — Download and file into the vault

Output dir: `<vaultPath>/<wikiDir>/experience/study/<topic-slug>/`

```bash
notebooklm download report   "<dir>/study-guide.md"      --notebook "$NID"
notebooklm download quiz --format markdown "<dir>/quiz.md" --notebook "$NID"
notebooklm download audio    "<dir>/audio-overview.mp3"  --notebook "$NID"
```

Then write a small `index.md` in that dir linking the three outputs and `[[wikilinks]]` back
to the source teardown, and add a catalog line on the teardown page pointing forward to the
study set.

> Audio files are large (tens of MB). The brain vault is not git-tracked, so this is fine. If
> a vault ever becomes git-tracked, gitignore `experience/study/**/*.mp3`.

## Step 5 — Report

Tell the user: the notebook id (and URL if shown), what was generated, where the files landed,
and any step that fell back or failed. Offer to delete the NotebookLM notebook if it was a
throwaway — ask first; `delete` is destructive (pass `--yes` once approved).

## Graceful failure

Any CLI call can fail mid-run (cookies expire, Google API drift, rate limits). On failure:
surface the exact error, suggest the matching recovery (`notebooklm auth refresh`, retry, or
re-login), and never silently swallow it. **Partial success is fine** — file whatever did
generate and report what didn't.

## Reuse and credit

- Power users who want the full NotebookLM Surface (video, slides, flashcards, mind maps,
  chat, web research, sharing) should install the upstream skill directly: `notebooklm skill install`.
- `notebooklm-py` by teng-lin (MIT, unofficial): <https://github.com/teng-lin/notebooklm-py>
