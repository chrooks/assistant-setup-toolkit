---
name: listen-audio
description: "Turn a recording into text and hand it back — transcribe an audio file locally with whisper, clean the result, and file nothing. Use when the user drops an audio path (.m4a, .mp3, .wav, .ogg, .flac), says 'transcribe this', 'listen to this', 'here's the recording', 'what did they say on the call', or needs the text of a voice memo, interview, or meeting recording. Handles non-English audio: the transcript stays in the language spoken, and a translation is a separate marked pass, never a silent replacement. Not for video — that is /watch-video. Not for filing a capture into a project record — that is /canon chronicle."
argument-hint: "<path to audio file> [--translate]"
user-invocable: true
disable-model-invocation: false
allowed-tools: Read, Write, Bash, Glob
---

# /listen-audio

One job: audio in, text out. It files nothing, commits nothing, and moves nothing.

**Model-invocable on purpose.** A dropped audio path should simply work. The Skill
writes one transcript beside the source and never deletes or relocates anything.

## Why this exists and not `/watch-video`

`/watch-video` returns a transcript **and** scene-change frames, because a talk needs
both. A voice memo has no frames. Running a video pipeline to collect one of its two
outputs is the wrong shape, and its no-transcript gate is written for YouTube.

`/canon chronicle` also transcribes, but it writes Beats into a Canon and archives
the capture. Its own Boundary forbids client data. A stakeholder recording cannot
legally go through it. This Skill is the neutral path.

## Quick start

```bash
whisper-ctranslate2 <file> --model small --output_format txt --output_dir <dir>
```

Read the arguments positionally: the first is the path, `--translate` is optional.

## Steps

1. **Check the tool.** If `whisper-ctranslate2` is not on PATH, stop and say exactly
   this, then wait:

       Transcription needs whisper locally. Not installed here. Install with:
       pipx install whisper-ctranslate2

   Never fall back to a cloud transcriber on your own. Audio leaving the machine is
   the user's decision, not a silent recovery step. On a work machine, say plainly
   that the audio would leave the building.

2. **Detect the language before transcribing.** Whisper reports it. State it in one
   line. Do not assume English.

3. **Transcribe into the spoken language.** Write `<stem>.txt` beside the source.
   `--task translate` is never the default — it silently replaces a person's words
   with English, and a translated quote cannot be verified against what they said.

4. **Clean the transcript.** This is the real work and the reason the Skill exists.
   - Fix obvious mis-segmentation and repeated filler.
   - Mark each speaker turn when more than one person is audible.
   - Mark anything genuinely inaudible as `[inaudible]`. **Never guess a word.** A
     plausible invented word is worse than a gap, because a gap is visible.
   - Leave dialect, code-switching, and grammar alone. It is their speech.

5. **Translate only when asked**, and then as a second marked artifact — never in
   place. Write `<stem>.en.txt` and keep the original. Say in one line that the
   original is the evidence and the translation is a reading of it.

6. **Report:** the path, the language, the duration, and anything marked inaudible.

## Boundaries

- Files nothing. The caller decides where the text belongs.
- Never deletes or moves the source audio.
- Never commits. Recordings of people are not repository content.
- Never sends audio off the machine without the user saying so in that turn.

## Handoffs

- Stakeholder or user interview → `/discover read`, which turns the transcript into
  requirements. It expects the original language, with any translation marked.
- A capture for a project record → `/canon chronicle`, subject to its own Boundary.
- Something worth keeping as knowledge → the user's knowledge base, on their say-so.

## Completion criteria

- [ ] The spoken language was detected and stated, not assumed
- [ ] The transcript is in the language spoken
- [ ] Any translation is a separate file, marked, with the original kept
- [ ] Inaudible spans are marked, never guessed
- [ ] Nothing was filed, moved, committed, or uploaded
