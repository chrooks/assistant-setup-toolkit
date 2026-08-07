---
name: cut-video
description: Trim and join a video by in/out spans with ffmpeg — cut long pauses, dead air, and unwanted sections out of a recording, or keep only chosen spans, and render one tightened clip. Use when the user invokes /cut-video, asks to cut, trim, tighten, shorten, or clip a video, remove pauses or silence or filler from a recording, or wants only certain timestamps kept — including on a video already loaded by /watch-video.
argument-hint: "[video path, or the video /watch-video just loaded] + what to cut or keep"
disable-model-invocation: false
---

# /cut-video — Render Spans into a Trimmed Clip

`/watch-video` loads a recording as transcript and frames so it can be discussed. This
skill closes the loop: it takes the spans that discussion produced and renders them into
a new, tighter video.

It never touches the source file. Output goes to a new path, and the script refuses to
write over its own input.

Model invocation stays **on** deliberately. The natural ask — "now cut the dead air out
of that" — arrives in conversation right after a `/watch-video` load, and a gate there
would break the loop. The blast radius is one new file.

## Prerequisite

`ffmpeg`, which also provides `ffprobe`. Install with `brew install ffmpeg` (macOS) or
your platform's package. The script names the missing program and the install line.

## Inputs

1. **The video.** A file path. After a `/watch-video` load it is `media.mp4` in that
   run's cache directory — read the path from the manifest rather than guessing it.
2. **The spans.** Either what to remove (`--cut`) or what to hold on to (`--keep`).
   Timestamps take `SS`, `SS.ss`, `MM:SS`, or `HH:MM:SS`, joined by `-`, separated by
   commas: `--cut 1:02-1:04.5,2:10-2:12`.

Overlapping and out-of-order spans are merged for you. Spans past the end are clamped.

## Where the spans come from

### Long pauses — detect them, do not guess

Dead air is found from the audio, with no transcript involved:

    node ~/.claude/skills/cut-video/scripts/cut.mjs "<video>" --detect-silence

This renders nothing. It prints every silence over `--silence-min` seconds (default 0.6)
below `--silence-db` (default -30), and a `cutArg` field already formatted for `--cut`.

**Do not pipe the whole list straight back in.** A recording with every pause removed
sounds frantic. Read the list, keep the cuts that earn their place — the four-second
stall, not the half-second breath — and say which ones you dropped. Raise
`--silence-min` to about 1.2 when a talk is naturally slow.

### Filler words — say what is actually possible

`/watch-video` writes `transcript.md` at **segment** resolution, and strips the
word-level timing tags some caption tracks carry. So a single "um" has no timestamp to
cut against, and inventing one produces a clipped word.

What works instead:

- An "um" is nearly always bracketed by pauses. Cutting the silences around it removes
  most of the drag without ever locating the word.
- Whole segments do have timestamps — a restart, a tangent, a section the user wants
  gone. Cut those by segment bounds straight from the transcript.
- Genuine word-level cutting needs a word-timestamped transcript. Say so and offer to
  re-transcribe with word timings rather than approximating.

### Named by the user

"Cut the first 30 seconds" or "just keep 2:00 to 5:30" needs no analysis. Pass it.

## Run

    # remove spans, leaving 0.15s of room at each edge
    node ~/.claude/skills/cut-video/scripts/cut.mjs "<video>" --cut 10.0-13.0,20.0-22.5 --pad 0.15

    # keep only these spans
    node ~/.claude/skills/cut-video/scripts/cut.mjs "<video>" --keep 2:00-5:30 --out demo-clip.mp4

    # plan only, no encode
    node ~/.claude/skills/cut-video/scripts/cut.mjs "<video>" --cut ... --dry-run

`--pad` shrinks every cut by that many seconds on both sides. It is the fix for two
different complaints, and both are worth passing it for:

- Cutting silence: `--pad 0.15` leaves a beat, so speech does not run together.
- Cutting near speech: `--pad 0.05` protects the consonant at the edge of a word.

Default is `0` — literal, so what you asked for is what you get.

`--out` defaults to `<name>-cut.mp4` beside the source. **Pass `--out` explicitly when
the source is a `/watch-video` cache** — that directory is disposable and a re-extract
should not carry a rendered deliverable with it.

`--dry-run` is worth a pass before a long encode on a hand-built cut list. A detect
pass is already its own review step, so it does not need a second one.

## The output duration is probed, never computed

Every cut lands on a frame boundary, so the rendered clip never matches the span
arithmetic — the segments in the verification run drifted 80 ms across three joins, and
that gap widens with the number of cuts.

The script reports `outputDurationSec` and `removedSec` from an `ffprobe` of the
finished file. **Quote those numbers.** Never add up the spans and present the total as
the new runtime, and never state a duration for a render that has not happened yet — the
`--dry-run` figures come labelled `planned` for exactly this reason.

## Report

Short, and in this order:

1. **Output path** and the probed runtime — "8:42, down from 10:11".
2. **What came out** — how many spans, and what they were. Name any proposed cut you
   chose not to make.
3. **One next move** — watch it, adjust a span and re-run, or cut further.

Keep the span list in the message so a re-run only needs one edited number.

## Notes

- Each kept span is re-encoded on its own, then joined with the concat demuxer. This
  costs a re-encode and buys frame-accurate cuts — stream copy would snap every cut to
  the nearest keyframe, seconds away, which cannot remove a two-second pause at all.
- Output is forced to constant frame rate at the source rate. Screen recordings are
  often variable frame rate, and the concat demuxer joins those badly.
- Video with no audio track is handled; the script probes for the stream rather than
  assuming one.
- Cuts are frame-accurate, not judgment-accurate. A span the user did not name is not
  yours to remove.
