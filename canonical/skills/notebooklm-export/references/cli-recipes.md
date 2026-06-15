# NotebookLM — CLI recipes

Exact command shapes for the `notebooklm-export` flow. Binary: `notebooklm`. Most commands take
`--json` for machine-readable output and `--notebook <id>` (or `-n <id>` on `wait`/`download`)
to target a notebook explicitly. Prefer explicit `--notebook` over `notebooklm use` so the
flow is safe under parallel runs.

## The study-export flow

```bash
# 0. Preflight
notebooklm auth check --test --json        # need status:ok AND checks.token_fetch:true

# 1. Create notebook, capture id
NID=$(notebooklm create "Cornerstone — Study" --json | jq -r .notebook.id)

# 2. Add sources, wait for processing
SID=$(notebooklm source add "/path/to/teardown.md" --notebook "$NID" --json | jq -r .source.id)
notebooklm source wait "$SID" --notebook "$NID"
notebooklm source list --notebook "$NID" --json     # confirm status: ready

# 3. Generate (ask first — long-running, may fail)
notebooklm generate report --format study-guide --notebook "$NID" --wait --json
notebooklm generate quiz --notebook "$NID" --wait --json
notebooklm generate audio "Focus on the product, my role, key decisions and tradeoffs, and what an interviewer would probe." \
  --notebook "$NID" --wait --timeout 540 --json

# 3b. Audio usually isn't done when --wait returns. Poll it:
AID=$(notebooklm artifact list --notebook "$NID" --json | jq -r '.artifacts[] | select(.type_id=="audio") | .id')
notebooklm artifact wait "$AID" --notebook "$NID" --timeout 540

# 4. Download into the vault study dir
notebooklm download report   "<dir>/study-guide.md"      --notebook "$NID"
notebooklm download quiz --format markdown "<dir>/quiz.md" --notebook "$NID"
notebooklm download audio    "<dir>/audio-overview.mp3"  --notebook "$NID"
```

## Artifact → command map (the three this skill uses)

| Study artifact | Generate | Download |
|----------------|----------|----------|
| Study guide | `generate report --format study-guide` | `download report <path>.md` |
| Quiz | `generate quiz` | `download quiz --format markdown <path>.md` |
| Audio overview | `generate audio "<instructions>"` | `download audio <path>.mp3` |

`generate report --format` also accepts `briefing-doc`, `blog-post`, `custom`. `quiz` and
`flashcards` download as `--format json` or `markdown`.

## Gotchas

- **Audio is slow (5–15 min).** `generate audio --wait` often returns at `"pending"`; always
  follow with `artifact wait <id>`. The downloaded "mp3" is an MP4/ISO-media audio container —
  that's normal and plays fine.
- **Status check.** `notebooklm status` reports the *selected notebook context*, NOT auth.
  Use `notebooklm auth check --test` to verify auth.
- **Destructive ops need confirmation.** `delete`, `source delete`, `note delete` etc. prompt;
  pass `--yes`/`-y` (or `--json`, which implies `--yes`) once the user has approved.
- **Beyond these three:** the upstream skill (`notebooklm skill install`) and `notebooklm <group> --help`
  expose video, slide-deck, infographic, mind-map, data-table, chat (`ask`), and web research
  (`source add-research`). Reach for those directly rather than widening this skill.
