---
name: load-song
description: "Load a song into context for discussion — run the audio-analyzer MCP on an mp3 for musical features, pull the lyrics, emit a short brief, and acknowledge the track is loaded and ready. Use when the user invokes /load-song, drops an mp3 path or song name, or says 'load this song', 'ingest this song', 'analyze this track', or wants to talk about a song's music and lyrics together."
argument-hint: "[mp3 file path, or a song name/title]"
---

# /load-song — Load a Song into Context

Claude can't hear audio. This skill ingests a song as **musical features + lyrics text** so
you and the user can actually discuss it — how it sounds, what it says, and why it works.

The deliverable is small: a short brief, then an explicit acknowledgement that the song is
**loaded in context and ready** for whatever comes next (discussion, comparison, teardown,
replicating it in the user's own production). Do NOT over-produce — this is a loader, not an essay.

## Prerequisite

The `audio-analyzer` MCP server (JuzzyDee/audio-analyzer-rs) must be installed.
- Preferred: MCP tools `full_analysis`, `harmonic_analysis`, `rhythm_analysis`, `compare`.
- Fallback if MCP tools aren't loaded this session: the same binary as a CLI —
  `audio-analyzer "/full/path/song.mp3"`.
- If neither is available, tell the user to install it: `brew tap juzzydee/tap && brew install audio-analyzer`, then `claude mcp add --scope user audio-analyzer -- $(which audio-analyzer-mcp)`.

## Routing — what the argument is

1. **An mp3/audio file path** (contains `/` or ends `.mp3/.m4a/.wav/.flac/.ogg/.aac`):
   → go to **Run**. This is the happy path.
2. **A song name / title** (no file): → ask for the file path first
   ("Drop the file path and I'll analyze the audio too"). If the user **has no file**,
   continue with lyrics only (audio features skipped — say so explicitly).
3. **No argument**: ask which song — a file path is best, a name works for lyrics-only.

## Run

Do these two in parallel.

### A. Audio features
- Pass the **full file path** (reads from disk — never an upload/attachment).
- Call `full_analysis` (MCP) or `audio-analyzer "<path>"` (CLI).
- Keep what matters for discussion: **key, tempo/BPM, section boundaries, tonal balance,
  dynamics (crest/LRA/LUFS), stereo field, percussive ratio**. Drop the raw TSV.

### B. Lyrics
- Derive title/artist from the filename or the user's wording.
- Try to find the lyrics: `WebSearch` for the song, then `WebFetch` a lyrics page.
- **Copyright reality:** WebFetch often refuses to reproduce full lyrics. That's expected.
  When it does, **ask the user to paste the lyrics** — they own that call. You can still
  discuss themes from search-result summaries without the full text.
- Lyrics ladder: fetch → if refused/not found, ask user to paste → if user declines,
  proceed with audio + themes only and note lyrics are missing.

## Brief + acknowledge

Output, tight:

1. **One header line** — `Title — Artist (album/year if known) · duration`.
2. **Sound profile** — a short table or stacked lines: key, tempo, structure, dynamics, mood read.
3. **Structure note** — map the strongest section boundaries to likely musical events
   (beat switch, hook entry, outro) when they're obvious.
4. **One or two thematic lines** — only if lyrics are loaded. Connect sound to meaning when
   there's a real tension worth naming. Quote at most short fragments, never the full text.
5. **Acknowledge:** state plainly that the song is **loaded and ready**, and offer 2–3 concrete
   next moves (discuss what makes it work, A/B with `compare`, teardown for the user's own
   production, hand to `/teach`).

Stop there. Wait for the user to pick the direction.

## Notes

- Multiple songs: load each, then `compare` two file paths for an A/B diff.
- This skill loads; it does not commit anything or write files. It only puts the song in context.
