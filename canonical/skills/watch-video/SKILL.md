---
name: watch-video
description: Load a video into context for discussion — pull its transcript and a set of scene-change frames, emit a short brief, and acknowledge the video is loaded and ready. Use when the user invokes /watch-video, pastes a YouTube URL, drops a video file path, or says 'watch this video', 'load this video', 'summarize this talk', or wants to discuss a video's content.
argument-hint: "[a video URL (YouTube, Vimeo, TikTok, …) or a path to a local video file]"
---

# /watch-video — Load a Video into Context

Claude can't watch video. This skill loads one as **timestamped transcript + a small
set of frames** so you and the user can actually discuss it — what was said, what was
shown, and how the two line up.

The deliverable is small: a short brief, then an explicit acknowledgement that the video
is **loaded in context and ready**. Do NOT over-produce — this is a loader, not an essay.
It does not write to the knowledge base; `/ingest` does that, and only if the user asks.

## Prerequisite

Two command-line programs must be installed:

- `yt-dlp` — downloads video and subtitle tracks. Only needed for URLs.
- `ffmpeg` (which also provides `ffprobe`) — scene detection, frame cutting, grid tiling.

Install both with `brew install yt-dlp ffmpeg` (macOS) or `pip install yt-dlp` plus your
platform's ffmpeg package. The script reports which one is missing and how to install it.

Optional, for videos with no subtitle track: a whisper CLI. Install
`pip install whisper-ctranslate2` — the `faster-whisper` package is a *library* and ships
no binary, so installing it alone does nothing here. OpenAI's `whisper` CLI also works.
Never `mlx-whisper` — Apple-Silicon-only, so it fails on other machines.

**Behind a corporate proxy**, the first whisper run downloads model weights and may be
blocked with an HTTP 403. Which host it needs depends on the client, and that matters:
`whisper-ctranslate2` fetches from `huggingface.co`, while OpenAI's `whisper` fetches from
`openaipublic.azureedge.net`. If one is blocked, try the other before anything else — the
Azure CDN is the more commonly allowlisted of the two.

A blocked download is survivable either way: the load completes with frames,
`transcript.status` comes back `none`, and `transcript.reason` names the fix.

**Last resort — `--openai`.** Transcribes through the OpenAI API instead of locally, using
`OPENAI_API_KEY` from the environment. This is **opt-in and never automatic**, because it
sends the video's audio off the machine — a decision the user makes, not a silent fallback
when a local tool fails. Offer it at the no-transcript gate; never pass it unasked. On a
work machine, say plainly that audio leaves the building so the user can weigh it against
their policy.

## Routing — what the argument is

1. **A URL** (starts `http://` or `https://`): the happy path. Any site `yt-dlp` supports.
2. **A file path**: also fully supported, and it skips the download entirely.
3. **A watch URL carrying playlist context** (`?v=…&list=WL&index=3&t=84s`): fine — that is
   one video opened from a queue. The script strips the incidental params itself.
4. **A pure playlist URL** (`list=` with no `v=`): rejected. Ask for a single video URL.
5. **No argument**: ask which video — a URL or a file path.

## Run

Everything mechanical is one script. Do not reimplement it inline.

    node ~/.claude/skills/watch-video/scripts/video.mjs "<source>"

Let the script pick the cache directory — it defaults to `.exports/watch-video/<videoId>/`
in the current project, matching where `/diagram` and `/table` write. Only pass
`--cache-dir` when the user asks for somewhere specific. It writes `manifest.json` and
prints it to stdout. Pass `--force` only when the user explicitly asks
for a re-extract; otherwise a second run on the same video reuses the first extraction.

### Authentication — `--cookies`

Where a site needs a login, the script falls back to the **Chrome profile**
(`--cookies-from-browser chrome`), i.e. the user's own logged-in session.

That default is right for a video the user is watching and wrong for scraping. Pass
`--cookies <file>` with a Netscape-format export to authenticate as some other account
instead — the cookie file then replaces the browser rung entirely, so the real session is
never sent.

    node ~/.claude/skills/watch-video/scripts/video.mjs "<url>" --cookies ~/.config/yt-dlp/ig-cookies.txt

**Automated pipelines must pass it.** `/ingest`'s Karakeep drain runs unattended over
someone's saved bookmarks; using the live session there would put the user's real account
behind bulk requests. That drain has a burner-account cookie file for exactly this reason.

### The manifest

Everything downstream reads this one object:

- `title`, `channel`, `durationSec` — for the header line.
- `transcript.status` — `captions`, `whisper`, `openai`, or `none`; `transcript.path` when it
  exists, and `transcript.reason` explaining why when it is `none`.
- `frames[]` — `{ t, path }` per frame, full resolution, on disk.
- `grids[]` — `{ path, cells, from, to, cellTimes }`; each grid tiles up to 16 frames.
- `budget` — `policy` (`scene-change`, `short-form-1fps`, or `focus`), `framesFound`,
  `framesExtracted`, `framesDeduped`, `framesKept`, `estTokens`. Frames are oversampled,
  then near-identical ones are dropped by comparing pixels, then the rest are thinned to
  budget — so `framesDeduped` is how much of the video was visually repetitive.
  `dedupSkipped` appears **only** when the dedup pass could not run at all; without it a
  `framesDeduped` of 0 would read the same as "nothing was repetitive". Expect dedup to
  drop little in `scene-change` mode — candidates there are already spaced seconds apart,
  so it earns its keep mainly in `short-form-1fps` and `focus`, where they are dense.

## Read the grids, not the frames

`Read` each entry in `grids[]`. Do **not** Read the individual `frames[]` up front — that
costs roughly three to five times as much and floods the context.

**Cells are laid out 4 across, row-major** — left to right, then top to bottom. Each grid's
`cellTimes` array lists its frame timestamps in that exact reading order, so cell *i* is at
`cellTimes[i]`. That array is the cell-to-timestamp mapping; nothing is written on the
image itself. (ffmpeg's text filter needs a libfreetype build that Homebrew does not ship,
and depending on one would make this Skill machine-specific.)

When the user asks about something specific ("what was on the architecture slide?"), find
the cell, read its timestamp from `cellTimes`, then `Read` the matching full-resolution
frame from `frames[]`. **The question does the selecting** — that is why frames are left on
disk instead of loaded eagerly.

## Gate: no transcript

When `transcript.status` is `none`, **stop and ask the user to confirm** before going any
further. Quote `transcript.reason` — it distinguishes "no whisper installed" from "whisper
was blocked downloading its model", which need different fixes. Say plainly that the video
can only be loaded as frames with no spoken content, and offer the fixes that match the
reason — installing a whisper CLI, trying the other client's download host, or re-running
with `--openai` (noting that it sends audio off the machine). Do not silently proceed with
frames alone, and do not reach for `--openai` on your own — a talk without its transcript is
mostly worthless, but so is uploading a work recording the user did not agree to send.

## Brief + acknowledge

Output, tight:

1. **One header line** — `Title — Channel · duration`.
2. **Sampling disclosure** — phrased from `budget`, e.g. "48 frames across 1h12m, roughly
   one per 90 seconds" or "all 187 scene changes kept". When `framesKept` is less than
   `framesFound`, say so — never imply complete coverage.
3. **Structural read** — three to five lines on what the video covers, each anchored to a
   timestamp. Draw on both tracks: what is said and what is shown.
4. **Cache path** — where the transcript and frames live, so the user can hand the
   transcript to `/ingest` or open a frame themselves.
5. **Acknowledge** — state plainly that the video is **loaded and ready**, and offer 2-3
   concrete next moves (discuss a section, pull a specific slide at full resolution, hand
   the transcript path to `/ingest`).

Stop there. Wait for the user to pick the direction.

## Notes

- **Never conclude something is absent from the grids.** The frames are a *sample*, not a
  record. A graphic shown for a few seconds can fall entirely between two samples, and
  scene detection is luma-weighted so a transition into or out of a dark card may not
  register at all. "It is not in the grids" only ever means "it is not in the frames I
  looked at."

  When the user asks whether the video shows something specific, and the grids do not show
  it: find the relevant window in the transcript, then **re-extract densely across that
  window** before answering. One frame per second over a 30-second window is cheap:

      for t in $(seq 306 340); do
        ffmpeg -y -loglevel error -ss $t -i <cacheDir>/media.mp4 -frames:v 1 \
          -vf "scale='min(1568,iw)':-2" /tmp/dense/t$t.jpg
      done

  The built-in way to do this is `--focus`:

      node ~/.claude/skills/watch-video/scripts/video.mjs "<source>" --focus 5:09-5:36

  It samples that span far denser than the whole-video pass (about two frames a
  second for a short range) and writes its own grids. Prefer it over a hand-rolled
  ffmpeg loop. Only say a thing is not in the video after a focused pass comes back
  empty.
- **Frame density inverts with duration.** Clips under two minutes take one frame per
  second; longer videos take scene changes capped at a token budget. A short clip is
  cheap and its visuals carry most of the meaning.
- Multiple videos: load each separately. Playlists are rejected by design — ten videos
  means ten times the frame budget for a context nobody can reason across.
- This skill loads; it does not commit anything or write outside the cache directory.
