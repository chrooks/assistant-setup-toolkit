#!/usr/bin/env node
// Mechanical half of the /watch-video Skill: acquire a video, pull its
// transcript, cut frames at scene changes, tile them into grids, and write one
// manifest describing all of it. The Skill's SKILL.md reads that manifest and
// does the judgment work (routing, reading grids, writing the brief).
//
// The manifest is the Seam — it is the whole test surface for this pipeline.
// See .tasks/27-watch-video/plan.md for the contract and the reasoning.
//
// Node rather than Python so the tests import these functions directly instead
// of crossing a subprocess boundary, and to match the toolkit's `node {hook}`
// choice for cross-machine portability.

import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const USAGE = `Usage: video.mjs <source> [options]

  <source>              A video URL (YouTube, Vimeo, and ~1800 other sites via
                        yt-dlp) or a path to a local video file.

Options:
  --cache-dir <dir>     Where to write the manifest and extracted assets.
                        Defaults to ./.exports/watch-video/<videoId>/
  --force               Re-extract even when a cached manifest already exists.
  --openai              Transcribe via the OpenAI API when there is no caption
                        track. Sends audio off this machine; needs OPENAI_API_KEY.
  --focus <from>-<to>   Sample densely across one span instead of the whole
                        video, e.g. --focus 5:09-5:36. Use when hunting for a
                        specific moment the whole-video pass may have skipped.
  --help                Print this message.

Writes <cache-dir>/manifest.json and prints it to stdout.`;

/** Long edge, in pixels, for extracted source frames. */
const FRAME_LONG_EDGE = 1568;

/**
 * ffmpeg scene-change sensitivity, 0-1. 0.4 is the conventional default: low
 * enough to catch slide advances, high enough to ignore camera noise.
 */
const SCENE_THRESHOLD = 0.2;

/**
 * Thumbnail edge, in pixels, for perceptual dedup. 16x16 grayscale is enough to
 * tell "same shot" from "different shot" and cheap enough to decode in bulk.
 */
const DEDUP_THUMB = 16;

/**
 * Mean per-pixel difference (0-255) below which two frames count as the same
 * shot. 2.0 tolerates compression noise and slight motion.
 */
const DEDUP_THRESHOLD = 2;

/**
 * Extract this multiple of the budget before deduping, since dedup only ever
 * removes frames. Bounds how much extraction work a low scene threshold buys.
 */
const OVERSAMPLE = 3;

/** Below this duration a video is sampled every second instead of by scene. */
const SHORT_FORM_MAX_SEC = 120;

/**
 * Sampling target for anything longer: aim for a frame every TARGET_GAP_SEC,
 * bounded by MAX_FRAMES.
 *
 * A flat 60-frame cap under-sampled short videos badly. A 6.6-minute video got
 * one frame per 6.6 seconds while using only 19k of the ~100k token budget —
 * and a stat card shown for ~5 seconds fell entirely between two samples.
 * Deriving the count from duration spends the budget that is actually there.
 */
const TARGET_GAP_SEC = 4;
const MAX_FRAMES = 160;

/**
 * Minimum seconds between kept scene changes. A fade or animation trips the
 * threshold on many consecutive frames, and without this the whole budget is
 * spent on one transition.
 */
const MIN_SCENE_GAP_SEC = 2;

/** Tokens a single full-resolution image costs on Claude Opus 5. */
const TOKENS_PER_GRID = 4784;

/** Tokens a single 1568px frame costs, if read individually. */
const TOKENS_PER_FRAME = 1600;

/**
 * Default cache location, relative to the working directory. `.exports/` is
 * this repo's existing convention for skill output (see `.exports/diagram/`,
 * `.exports/table/`) and is already gitignored.
 */
const DEFAULT_CACHE_SEGMENTS = [".exports", "watch-video"];

/**
 * OpenAI transcription. `whisper-1` is deliberate: it is the only transcription
 * model that returns WebVTT. gpt-4o-transcribe and gpt-4o-mini-transcribe are
 * newer and cheaper but emit json/text only, with no timestamps — which would
 * break the timestamp spine the whole pipeline is built on.
 */
const OPENAI_MODEL = "whisper-1";
const OPENAI_ENDPOINT = "https://api.openai.com/v1/audio/transcriptions";

/** Hard cap enforced by the API, in bytes. */
const OPENAI_MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/** Contact-sheet geometry. 4x4 at CELL_WIDTH gives a 2576px long edge. */
const GRID_COLS = 4;
const GRID_ROWS = 4;
const CELL_WIDTH = 644;
const CELL_HEIGHT = 362;

/**
 * Split argv into a source plus flags. Kept deliberately small — this script
 * has three options and does not need an arg-parsing dependency.
 */
export function parseArgs(argv) {
  const options = { source: null, cacheDir: null, force: false, help: false, openai: false, focus: null };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--force") {
      options.force = true;
    } else if (arg === "--openai") {
      options.openai = true;
    } else if (arg === "--focus") {
      i += 1;
      options.focus = argv[i] ?? null;
    } else if (arg === "--cache-dir") {
      i += 1;
      options.cacheDir = argv[i] ?? null;
    } else if (!options.source) {
      options.source = arg;
    }
  }

  return options;
}

/**
 * Decide whether the argument names a remote video or a file on disk.
 * Anything that is not http(s) is treated as a path and made absolute, so
 * later steps never have to care what the caller's working directory was.
 */
export function resolveSource(arg) {
  if (/^https?:\/\//i.test(arg)) {
    return { kind: "url", value: arg };
  }
  return { kind: "file", value: path.resolve(arg) };
}

/**
 * True only for a *pure* playlist URL — one naming a list with no specific
 * video. Those would multiply the frame budget by however many videos the list
 * holds, for a context nobody can reason across.
 *
 * A watch URL carrying both `v=` and `list=` is NOT a playlist: it is one video
 * that happened to be opened from a list (Watch Later, a queue, an autoplay
 * chain). The user pointed at that video, so load it and drop the list context.
 */
export function isPlaylistUrl(value) {
  const hasList = /[?&]list=/.test(value);
  const hasVideo = /[?&]v=[^&]+/.test(value);
  return hasList && !hasVideo;
}

/**
 * Strip incidental context from a watch URL — playlist membership, queue index,
 * a start-time deep link. Without this, yt-dlp given `?v=X&list=Y` downloads the
 * whole of Y, and the cache key would vary with how the link was copied.
 */
export function normalizeUrl(value) {
  const match = value.match(/[?&]v=([^&]+)/);
  if (!match) return value;
  return `https://www.youtube.com/watch?v=${match[1]}`;
}

/**
 * Stable cache key. Remote videos use the site's own id. Local files hash their
 * absolute path plus byte size, so the same file yields the same key across
 * runs while an edited file correctly misses the cache.
 */
export function videoIdFor(source) {
  if (source.kind === "url") {
    return run("yt-dlp", ["--no-playlist", "--print", "id", "--skip-download", source.value]).trim();
  }

  const { size } = fs.statSync(source.value);
  return createHash("sha256").update(`${source.value}:${size}`).digest("hex").slice(0, 12);
}

/** Duration in seconds, as a float, via ffprobe. */
export function probeDuration(filePath) {
  const out = run("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "csv=p=0",
    filePath,
  ]);

  const seconds = Number.parseFloat(out.trim());
  if (!Number.isFinite(seconds)) {
    throw new Error(`ffprobe returned no duration for ${filePath}`);
  }
  return seconds;
}

/** Write the manifest and return its path. Creates the cache dir if needed. */
export function writeManifest(cacheDir, manifest) {
  fs.mkdirSync(cacheDir, { recursive: true });
  const manifestPath = path.join(cacheDir, "manifest.json");
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return manifestPath;
}

/** Read a cached manifest, or null when absent or unparseable. */
export function readManifest(cacheDir) {
  const manifestPath = path.join(cacheDir, "manifest.json");
  try {
    return JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  } catch {
    return null;
  }
}

/**
 * Title and channel. Local files have no metadata worth probing, so the
 * filename stands in — it is what the person will recognize anyway.
 */
export function describeSource(source) {
  if (source.kind === "file") {
    return { title: path.basename(source.value), channel: null };
  }

  const out = run("yt-dlp", [
    "--no-playlist",
    "--print", "%(title)s\n%(channel)s",
    "--skip-download",
    source.value,
  ]);
  const [title, channel] = out.trim().split("\n");
  return { title: title ?? source.value, channel: channel || null };
}

/**
 * Ask yt-dlp for a subtitle track without downloading the video. Returns the
 * path to the written .vtt, or null when the video has no captions.
 *
 * The acquisition ladder is deliberately shallow: plain auto-sub first, then
 * browser cookies. A third rung exists (a PO-token provider service YouTube's
 * 2025-26 hardening may demand) but costs a Node build and ~65 MB, so it is not
 * built until these two demonstrably fail. See the plan's Decision Log.
 */
export function fetchSubtitles(url, cacheDir) {
  fs.mkdirSync(cacheDir, { recursive: true });
  const stem = path.join(cacheDir, "sub");

  const attempts = [
    ["--no-playlist", "--write-auto-sub", "--sub-format", "vtt", "--skip-download", "-o", stem, url],
    ["--no-playlist", "--write-auto-sub", "--sub-format", "vtt", "--skip-download",
     "--cookies-from-browser", "chrome", "-o", stem, url],
  ];

  for (const args of attempts) {
    try {
      run("yt-dlp", args, { stdio: "ignore" });
    } catch {
      continue; // try the next rung
    }
    const found = fs
      .readdirSync(cacheDir)
      .filter((name) => name.startsWith("sub.") && name.endsWith(".vtt"));
    if (found.length > 0) {
      return path.join(cacheDir, found[0]);
    }
  }

  return null;
}

/** `HH:MM:SS.mmm` or `MM:SS.mmm` to seconds. */
export function vttTimeToSeconds(stamp) {
  const parts = stamp.trim().split(":").map(Number.parseFloat);
  return parts.reduce((total, part) => total * 60 + part, 0);
}

/**
 * WebVTT to `{ t, text }` segments.
 *
 * Auto-generated captions are messy in two specific ways this has to survive:
 * inline word-level timing tags (`<00:00:01.234><c>word</c>`), and heavy
 * duplication where each cue repeats the previous cue's tail. Both are stripped
 * so the transcript reads as prose rather than a stutter.
 */
export function parseVtt(vttPath) {
  const lines = fs.readFileSync(vttPath, "utf-8").split(/\r?\n/);
  const segments = [];
  let pending = null;

  for (const line of lines) {
    const timing = line.match(/^(\d{1,2}:\d{2}(?::\d{2})?\.\d{3})\s*-->/);

    if (timing) {
      if (pending && pending.text) segments.push(pending);
      pending = { t: vttTimeToSeconds(timing[1]), text: "" };
      continue;
    }

    if (!pending) continue; // header, blank line, or cue id before the first timing
    if (/^(WEBVTT|Kind:|Language:|NOTE\b)/.test(line)) continue;

    const cleaned = line
      .replace(/<\d{2}:\d{2}:\d{2}\.\d{3}>/g, "")
      .replace(/<\/?c[^>]*>/g, "")
      .trim();

    if (!cleaned) continue;
    if (segments.some((seg) => seg.text.endsWith(cleaned))) continue; // rolling duplicate
    pending.text = pending.text ? `${pending.text} ${cleaned}` : cleaned;
  }

  if (pending && pending.text) segments.push(pending);
  return segments;
}

/** Seconds to the `MM:SS` label used in the transcript and burned into frames. */
export function formatTimestamp(seconds) {
  const total = Math.floor(seconds);
  const mins = String(Math.floor(total / 60)).padStart(2, "0");
  const secs = String(total % 60).padStart(2, "0");
  return `${mins}:${secs}`;
}

/** Write `transcript.md`, one `[MM:SS] text` line per segment. */
export function writeTranscript(cacheDir, segments) {
  fs.mkdirSync(cacheDir, { recursive: true });
  const transcriptPath = path.join(cacheDir, "transcript.md");
  const body = segments.map((seg) => `[${formatTimestamp(seg.t)}] ${seg.text}`).join("\n");
  fs.writeFileSync(transcriptPath, `${body}\n`);
  return transcriptPath;
}

/**
 * Downmix to small mono speech audio. 16 kHz mono at 32 kbps is roughly
 * 14 MB/hour, so a typical talk clears the API's 25 MB cap comfortably, and
 * speech recognition gains nothing from stereo or a higher sample rate.
 */
export function extractAudio(mediaPath, cacheDir) {
  fs.mkdirSync(cacheDir, { recursive: true });
  const audioPath = path.join(cacheDir, "audio.mp3");

  run("ffmpeg", [
    "-y", "-loglevel", "error",
    "-i", mediaPath,
    "-vn", "-ac", "1", "-ar", "16000", "-b:a", "32k",
    audioPath,
  ], { stdio: "ignore" });

  return audioPath;
}

/**
 * Transcribe via OpenAI's API. Opt-in only — this sends audio off the machine,
 * which is a decision the user makes explicitly rather than something that
 * happens because a local tool failed.
 *
 * The key is read from OPENAI_API_KEY and never written to the manifest, logged,
 * or echoed.
 */
/**
 * Split a duration into pieces that each fit the upload cap.
 *
 * The API rejects anything over 25 MB, which at our bitrate is about 1.7 hours.
 * Rather than failing on a long talk, cut the audio into equal pieces small
 * enough to send. Equal-length pieces (rather than filling each to the brim)
 * keep every request a similar size, so one slow chunk does not stall the run.
 */
export function planChunks(durationSec, totalBytes, maxBytes = OPENAI_MAX_UPLOAD_BYTES) {
  if (totalBytes <= maxBytes) return [{ start: 0, duration: durationSec }];

  const count = Math.ceil(totalBytes / maxBytes);
  const span = durationSec / count;
  return Array.from({ length: count }, (_, i) => ({
    start: Number((i * span).toFixed(3)),
    duration: Number(span.toFixed(3)),
  }));
}

/**
 * Re-base a chunk's timestamps onto the full video's clock.
 *
 * Each chunk is transcribed as if it were its own file starting at zero, so
 * without this every chunk after the first would report times from the top of
 * the video. This is what keeps the timestamp spine intact across a split.
 */
export function shiftSegments(segments, offsetSec) {
  return segments.map((seg) => ({ ...seg, t: Number((seg.t + offsetSec).toFixed(3)) }));
}

/** Cut one piece of audio out into its own file. */
export function sliceAudio(audioPath, chunk, cacheDir, index) {
  const out = path.join(cacheDir, `audio-${String(index).padStart(2, "0")}.mp3`);
  run("ffmpeg", [
    "-y", "-loglevel", "error",
    "-i", audioPath,
    "-ss", String(chunk.start),
    "-t", String(chunk.duration),
    "-ac", "1", "-ar", "16000", "-b:a", "32k",
    out,
  ], { stdio: "ignore" });
  return out;
}

/** POST one audio file and return its VTT text. */
async function postTranscription(apiKey, audioPath) {
  const form = new FormData();
  form.append("file", new Blob([fs.readFileSync(audioPath)]), path.basename(audioPath));
  form.append("model", OPENAI_MODEL);
  form.append("response_format", "vtt");

  const response = await fetch(OPENAI_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!response.ok) {
    // Deliberately does not echo the body verbatim — it can quote request
    // headers back, and the key rides in one.
    throw new Error(`OpenAI transcription failed: HTTP ${response.status}`);
  }
  return response.text();
}

export async function transcribeWithOpenAI(mediaPath, cacheDir) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

  const audioPath = extractAudio(mediaPath, cacheDir);
  const { size } = fs.statSync(audioPath);
  const duration = probeDuration(audioPath);
  const chunks = planChunks(duration, size);

  const segments = [];
  for (const [index, chunk] of chunks.entries()) {
    const piece = chunks.length === 1 ? audioPath : sliceAudio(audioPath, chunk, cacheDir, index);
    const vttPath = path.join(cacheDir, `openai-${String(index).padStart(2, "0")}.vtt`);
    fs.writeFileSync(vttPath, await postTranscription(apiKey, piece));
    segments.push(...shiftSegments(parseVtt(vttPath), chunk.start));
  }

  return segments;
}

/**
 * Whisper command-line clients, in preference order.
 *
 * Note `faster-whisper` is NOT here: that pip package is a *library* and ships
 * no binary. Its CLI is the separate `whisper-ctranslate2` package, which is a
 * drop-in for OpenAI's `whisper` client but backed by CTranslate2. Never
 * `mlx-whisper` — Apple-Silicon-only, so it would fail on other machines.
 */
const WHISPER_CLIS = ["whisper-ctranslate2", "whisper"];

/** The first whisper CLI present on PATH, or null. */
export function findWhisperCli() {
  return WHISPER_CLIS.find((bin) => hasBinary(bin)) ?? null;
}

/**
 * Speech-to-text for videos with no caption track.
 *
 * Throws when the CLI fails — most often because it cannot reach Hugging Face
 * to fetch the model weights, which is exactly what happens behind a corporate
 * proxy. The caller degrades on that rather than losing the whole load.
 */
export function transcribeWithWhisper(mediaPath, cacheDir, cli = findWhisperCli()) {
  if (!cli) throw new Error("no whisper CLI on PATH");
  fs.mkdirSync(cacheDir, { recursive: true });

  run(cli, [
    "--model", "base",
    "--output_format", "vtt",
    "--output_dir", cacheDir,
    mediaPath,
  ], { stdio: "ignore" });

  const found = fs.readdirSync(cacheDir).filter((name) => name.endsWith(".vtt"));
  return found.length > 0 ? parseVtt(path.join(cacheDir, found[0])) : [];
}

export function hasBinary(bin) {
  try {
    execFileSync("which", [bin], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Captions, else whisper, else nothing. Returns the manifest's transcript block.
 * A `none` status is not a failure here — the Skill turns it into a question for
 * the user rather than silently loading a video with no words.
 */
export async function buildTranscript(source, mediaPath, cacheDir, { useOpenAI = false } = {}) {
  let segments = null;

  if (source.kind === "url") {
    const vttPath = fetchSubtitles(source.value, cacheDir);
    if (vttPath) {
      segments = parseVtt(vttPath);
      if (segments.length > 0) {
        return { status: "captions", path: writeTranscript(cacheDir, segments), segments: segments.length };
      }
    }
  }

  if (!mediaPath) {
    return { status: "none", reason: "No caption track and no media file to transcribe." };
  }

  if (useOpenAI) {
    try {
      segments = await transcribeWithOpenAI(mediaPath, cacheDir);
      if (segments.length > 0) {
        return { status: "openai", path: writeTranscript(cacheDir, segments), segments: segments.length };
      }
      return { status: "none", reason: "OpenAI transcription returned no speech segments." };
    } catch (error) {
      return { status: "none", reason: `OpenAI transcription failed. ${firstLine(error.message)}` };
    }
  }

  const cli = findWhisperCli();
  if (!cli) {
    return {
      status: "none",
      reason: "No caption track, and no whisper CLI installed (try: pip install openai-whisper). "
        + "Re-run with --openai to transcribe via the OpenAI API instead.",
    };
  }

  // Whisper failing must not cost the frames already extracted. The most common
  // failure is a blocked model download (HTTP 403 behind a corporate proxy), and
  // a video the user can still look at beats no video at all.
  try {
    segments = transcribeWithWhisper(mediaPath, cacheDir, cli);
  } catch (error) {
    return {
      status: "none",
      reason: `Whisper (${cli}) failed — often a blocked model download. ${firstLine(error.message)} `
        + "Re-run with --openai to transcribe via the OpenAI API instead.",
    };
  }

  if (segments.length > 0) {
    return { status: "whisper", path: writeTranscript(cacheDir, segments), segments: segments.length };
  }

  return { status: "none", reason: `Whisper (${cli}) produced no speech segments.` };
}

/** Keep an error surface to one readable line for the manifest. */
function firstLine(message) {
  return String(message ?? "").split("\n")[0].slice(0, 200);
}

/**
 * Timestamps where the picture changed substantially.
 *
 * Caveat worth knowing: ffmpeg's scene score is *luma-weighted*, so a cut
 * between two shots of similar brightness can score zero even when the colours
 * differ completely. Frame lists are therefore good, not exhaustive.
 * t=0 is always included so a video always has an opening frame.
 */
export function detectScenes(mediaPath, threshold = SCENE_THRESHOLD) {
  const stderr = runCapturingStderr("ffmpeg", [
    "-i", mediaPath,
    "-filter:v", `select='gt(scene,${threshold})',showinfo`,
    "-f", "null", "-",
  ]);

  const timestamps = [...stderr.matchAll(/pts_time:([0-9.]+)/g)]
    .map((match) => Number.parseFloat(match[1]))
    .filter((value) => Number.isFinite(value));

  return spaceOut([0, ...timestamps], MIN_SCENE_GAP_SEC);
}

/**
 * Collapse a burst of near-identical timestamps to its first entry. Exact-value
 * dedup is not enough: a two-second fade emits dozens of *distinct* floats
 * (576.04, 576.08, ...) that would otherwise consume the entire frame budget.
 */
export function spaceOut(timestamps, minGapSec) {
  const sorted = [...timestamps].sort((a, b) => a - b);
  const kept = [];

  for (const t of sorted) {
    if (kept.length === 0 || t - kept[kept.length - 1] >= minGapSec) {
      kept.push(t);
    }
  }

  return kept;
}

/**
 * Guarantee coverage across the whole video.
 *
 * Scene detection alone is not enough for screencasts and talking-head footage,
 * which change gradually rather than cutting: a 17-minute screencast can yield
 * three usable timestamps, leaving most of the video unsampled. Where detection
 * comes up short of the budget, top up with evenly spaced samples so the frames
 * describe the whole runtime rather than whichever moments happened to cut.
 */
export function withCoverageFloor(scenes, durationSec, maxFrames) {
  if (scenes.length >= maxFrames) return scenes;

  const spread = [];
  const step = durationSec / maxFrames;
  for (let i = 0; i < maxFrames; i += 1) spread.push(Number((i * step).toFixed(2)));

  return spaceOut([...scenes, ...spread], Math.min(MIN_SCENE_GAP_SEC, step / 2));
}

/**
 * How densely to sample, by duration. Density inverts with length: a short clip
 * is cheap and its visuals carry most of the meaning, so it gets every second.
 * Anything longer takes scene changes capped at a token budget.
 */
export function framePolicy(durationSec) {
  if (durationSec < SHORT_FORM_MAX_SEC) {
    return { policy: "short-form-1fps", maxFrames: Math.max(1, Math.ceil(durationSec)) };
  }
  const wanted = Math.ceil(durationSec / TARGET_GAP_SEC);
  return { policy: "scene-change", maxFrames: Math.min(wanted, MAX_FRAMES) };
}

/**
 * One timestamp per second, for the short-form path.
 *
 * Stops a full second short of the end: seeking to the last fractional second
 * of a video lands past the final frame and ffmpeg produces nothing. A 19.014s
 * video yields 0..18, not 0..19.
 */
export function everySecond(durationSec) {
  const out = [];
  for (let t = 0; t + 1 <= durationSec; t += 1) out.push(t);
  return out.length > 0 ? out : [0];
}

/**
 * Reduce an over-long timestamp list to maxFrames by keeping evenly spaced
 * entries. The first is always retained so the opening frame survives.
 */
export function thinFrames(timestamps, maxFrames) {
  if (timestamps.length <= maxFrames) return [...timestamps];
  if (maxFrames <= 1) return [timestamps[0]];

  const step = (timestamps.length - 1) / (maxFrames - 1);
  const kept = [];
  for (let i = 0; i < maxFrames; i += 1) {
    kept.push(timestamps[Math.round(i * step)]);
  }
  return [...new Set(kept)];
}

/**
 * Cut one JPEG per timestamp, long edge capped at FRAME_LONG_EDGE without
 * enlarging smaller sources. Files are named by index rather than timestamp:
 * scene changes can land inside the same second, and the manifest carries the
 * real time for every frame anyway.
 */
export function extractFrames(mediaPath, timestamps, cacheDir) {
  const framesDir = path.join(cacheDir, "frames");
  fs.mkdirSync(framesDir, { recursive: true });

  const frames = [];

  timestamps.forEach((t, index) => {
    const framePath = path.join(framesDir, `frame-${String(index).padStart(4, "0")}.jpg`);
    try {
      run("ffmpeg", [
        "-y", "-loglevel", "error",
        "-ss", String(t),
        "-i", mediaPath,
        "-frames:v", "1",
        "-vf", `scale='min(${FRAME_LONG_EDGE},iw)':-2`,
        framePath,
      ], { stdio: "ignore" });
    } catch {
      return; // skip below
    }

    // ffmpeg can exit 0 having written nothing when the seek lands past the
    // last frame, so existence is checked rather than trusted.
    if (fs.existsSync(framePath) && fs.statSync(framePath).size > 0) {
      frames.push({ t, path: framePath });
    }
  });

  return frames;
}

/** Accept "5:09", "1:02:03", or a bare "309" and return seconds. */
export function parseTimeSpec(value) {
  const parts = String(value).trim().split(":").map(Number);
  if (parts.some((n) => !Number.isFinite(n))) return null;
  return parts.reduce((total, part) => total * 60 + part, 0);
}

/** Parse `--focus 5:09-5:36` into a span. */
export function parseFocus(value) {
  const [rawFrom, rawTo] = String(value).split("-");
  const from = parseTimeSpec(rawFrom);
  const to = rawTo === undefined ? null : parseTimeSpec(rawTo);
  if (from === null || to === null || to <= from) return null;
  return { from, to };
}

/**
 * Frame budget for a user-specified range.
 *
 * Deliberately denser than the whole-video budget: asking for a range means
 * looking for something specific, and a graphic on screen for a few seconds has
 * to survive the sampling. Whole-video sampling optimizes for coverage; this
 * optimizes for not missing anything.
 */
export function focusPolicy(spanSec) {
  if (spanSec <= 30) return Math.max(10, Math.ceil(spanSec * 2));
  if (spanSec <= 120) return Math.max(60, Math.ceil(spanSec));
  return MAX_FRAMES;
}

/** Evenly spaced timestamps across a span, inclusive of the start. */
export function spreadOver(from, to, count) {
  if (count <= 1) return [from];
  const step = (to - from) / (count - 1);
  return Array.from({ length: count }, (_, i) => Number((from + i * step).toFixed(2)));
}

/**
 * Decode every frame to a small grayscale thumbnail in one ffmpeg pass over the
 * numbered JPEG sequence.
 *
 * Fails open: any error returns [] so the caller skips dedup rather than losing
 * frames. Requires the contiguous frame-%04d.jpg naming extractFrames produces.
 */
export function thumbnailFrames(paths) {
  if (paths.length === 0) return [];

  // The JPEGs are piped in as one concatenated byte stream rather than read off
  // disk by a frame-%04d.jpg pattern. Pattern reading looked simpler but was a
  // trap: extractFrames numbers files by candidate index and skips any frame
  // ffmpeg cannot produce, so a single bad seek leaves a hole in the numbering.
  // ffmpeg's image2 demuxer stops dead at the first missing index, the length
  // check below then failed, and dedup silently turned itself off for the whole
  // run. Piping bytes makes membership and order follow this array alone, so
  // filenames — and any gaps in them — stop mattering.
  let input;
  try {
    input = Buffer.concat(paths.map((p) => fs.readFileSync(p)));
  } catch {
    return [];
  }

  // -c:v mjpeg names the decoder outright. Without it ffmpeg probes the piped
  // bytes to guess, and the probe needs more data than a small JPEG carries —
  // a 320x240 frame fails with "Output file does not contain any stream" while
  // a 1568px one succeeds. Stating the codec removes the size dependency.
  const result = spawnSync("ffmpeg", [
    "-hide_banner", "-loglevel", "error",
    "-f", "image2pipe", "-c:v", "mjpeg", "-i", "-",
    "-vf", `scale=${DEDUP_THUMB}:${DEDUP_THUMB},format=gray`,
    "-f", "rawvideo", "-",
  ], { input, maxBuffer: 256 * 1024 * 1024 });

  if (result.status !== 0 || !result.stdout) return [];

  const chunk = DEDUP_THUMB * DEDUP_THUMB;
  if (result.stdout.length !== chunk * paths.length) return [];

  return paths.map((_, i) => result.stdout.subarray(i * chunk, (i + 1) * chunk));
}

/** Mean absolute per-pixel difference between two grayscale thumbnails. */
export function frameDelta(a, b) {
  if (!a || !b || a.length !== b.length || a.length === 0) return Infinity;
  let total = 0;
  for (let i = 0; i < a.length; i += 1) total += Math.abs(a[i] - b[i]);
  return total / a.length;
}

/**
 * Drop frames that look the same as the one before them.
 *
 * This replaces spacing frames out by *time*, which used elapsed seconds as a
 * proxy for visual difference — a bad proxy in both directions. A fade emits
 * dozens of near-identical frames within a second, while a graphic that appears
 * three seconds after a cut is genuinely new information. Comparing pixels keeps
 * the second and drops the first; comparing timestamps did the opposite.
 */
export function dedupePerceptual(frames, threshold = DEDUP_THRESHOLD) {
  if (frames.length <= 1) return { kept: frames, dropped: 0 };

  const thumbs = thumbnailFrames(frames.map((f) => f.path));
  // Failing open keeps every frame, which is the safe direction — but a silent
  // 0 here reads exactly like "nothing was repetitive", so say which one it was.
  if (thumbs.length !== frames.length) {
    return { kept: frames, dropped: 0, reason: "could not decode frame thumbnails" };
  }

  const kept = [frames[0]];
  const dropped = [];
  let last = thumbs[0];

  for (let i = 1; i < frames.length; i += 1) {
    if (frameDelta(thumbs[i], last) <= threshold) {
      dropped.push(frames[i]);
    } else {
      kept.push(frames[i]);
      last = thumbs[i];
    }
  }

  discard(dropped);
  return { kept, dropped: dropped.length };
}

/** Reduce to n frames by even spacing, deleting the rest from disk. */
export function evenSample(frames, n) {
  if (frames.length <= n) return frames;

  const step = (frames.length - 1) / (n - 1);
  const keepIndices = new Set();
  for (let i = 0; i < n; i += 1) keepIndices.add(Math.round(i * step));

  const kept = frames.filter((_, i) => keepIndices.has(i));
  discard(frames.filter((_, i) => !keepIndices.has(i)));
  return kept;
}

function discard(frames) {
  for (const frame of frames) {
    try {
      fs.unlinkSync(frame.path);
    } catch {
      // already gone; nothing to clean up
    }
  }
}

/**
 * Tile frames into contact sheets, GRID_COLS x GRID_ROWS per sheet.
 *
 * Cells are filled row-major (left to right, top to bottom) and every sheet's
 * `cellTimes` lists its frame timestamps in that same reading order. That
 * ordering *is* the cell-to-timestamp mapping — the timestamps are deliberately
 * not drawn onto the image, because ffmpeg's `drawtext` filter needs a
 * libfreetype-enabled build that Homebrew's does not ship, and requiring a
 * specific ffmpeg build would reintroduce the machine-dependence this Skill was
 * designed to avoid.
 *
 * Each cell is letterboxed to a uniform size rather than stretched, so 4:3 and
 * 16:9 sources both tile without distortion.
 */
export function buildGrids(frames, cacheDir) {
  if (frames.length === 0) return [];

  const gridsDir = path.join(cacheDir, "grids");
  fs.mkdirSync(gridsDir, { recursive: true });

  const perGrid = GRID_COLS * GRID_ROWS;
  const grids = [];

  for (let start = 0; start < frames.length; start += perGrid) {
    const chunk = frames.slice(start, start + perGrid);
    const index = grids.length;
    const cellsDir = path.join(gridsDir, `.cells-${index}`);
    fs.mkdirSync(cellsDir, { recursive: true });

    chunk.forEach((frame, cellIndex) => {
      run("ffmpeg", [
        "-y", "-loglevel", "error",
        "-i", frame.path,
        "-vf",
        `scale=${CELL_WIDTH}:${CELL_HEIGHT}:force_original_aspect_ratio=decrease,` +
          `pad=${CELL_WIDTH}:${CELL_HEIGHT}:(ow-iw)/2:(oh-ih)/2:black`,
        path.join(cellsDir, `cell-${String(cellIndex).padStart(3, "0")}.jpg`),
      ], { stdio: "ignore" });
    });

    const gridPath = path.join(gridsDir, `grid-${String(index).padStart(2, "0")}.jpg`);
    run("ffmpeg", [
      "-y", "-loglevel", "error",
      "-i", path.join(cellsDir, "cell-%03d.jpg"),
      "-vf", `tile=${GRID_COLS}x${GRID_ROWS}:color=black`,
      "-frames:v", "1",
      gridPath,
    ], { stdio: "ignore" });

    fs.rmSync(cellsDir, { recursive: true, force: true });

    grids.push({
      path: gridPath,
      cells: chunk.length,
      from: chunk[0].t,
      to: chunk[chunk.length - 1].t,
      cellTimes: chunk.map((frame) => frame.t),
    });
  }

  return grids;
}

/**
 * Run a command and return its stderr. ffmpeg writes `showinfo` output there,
 * and spawnSync (unlike execFileSync) hands back both streams regardless of
 * exit status — which matters because `-f null -` exits non-zero on some builds
 * while still producing exactly the output we need.
 */
function runCapturingStderr(bin, args) {
  const result = spawnSync(bin, args, {
    encoding: "utf-8",
    maxBuffer: 64 * 1024 * 1024,
  });

  if (result.error) throw result.error;
  return result.stderr ?? "";
}

// ponytail: execFileSync over a spawn wrapper — every call here is a short,
// synchronous shell-out and the script is a one-shot CLI. Revisit if frame
// extraction needs to parallelize.
function run(bin, args, options = {}) {
  return execFileSync(bin, args, {
    encoding: "utf-8",
    maxBuffer: 64 * 1024 * 1024,
    ...options,
  });
}

/** Throw a clear error when a required external program is missing. */
export function requireBinary(bin, installHint) {
  if (!hasBinary(bin)) {
    throw new Error(`${bin} is not installed. Install it with: ${installHint}`);
  }
}

/**
 * Pull the video itself down for a URL source. Needed for frame extraction and
 * for whisper; caption-only runs never reach this. Capped at 720p — frames are
 * downscaled to 1568px anyway, so a 4K download would be wasted bandwidth.
 */
export function downloadMedia(url, cacheDir) {
  fs.mkdirSync(cacheDir, { recursive: true });
  const stem = path.join(cacheDir, "media");

  run("yt-dlp", [
    "--no-playlist",
    "-f", "bestvideo[height<=720]+bestaudio/best[height<=720]/best",
    "--merge-output-format", "mp4",
    "-o", `${stem}.%(ext)s`,
    url,
  ], { stdio: "ignore" });

  const found = fs.readdirSync(cacheDir).filter((name) => name.startsWith("media."));
  if (found.length === 0) {
    throw new Error(`yt-dlp produced no media file for ${url}`);
  }
  return path.join(cacheDir, found[0]);
}

export async function main(argv) {
  const options = parseArgs(argv);

  if (options.help || !options.source) {
    process.stdout.write(`${USAGE}\n`);
    return 0;
  }

  let source = resolveSource(options.source);
  if (source.kind === "url") {
    source = { kind: "url", value: normalizeUrl(source.value) };
  }

  if (source.kind === "url" && isPlaylistUrl(source.value)) {
    process.stderr.write("Playlist URLs are not supported — pass a single video URL.\n");
    return 1;
  }

  requireBinary("ffprobe", "brew install ffmpeg");
  if (source.kind === "url") {
    requireBinary("yt-dlp", "brew install yt-dlp");
  }

  const videoId = videoIdFor(source);
  const cacheDir = options.cacheDir ?? path.join(process.cwd(), ...DEFAULT_CACHE_SEGMENTS, videoId);

  if (!options.force) {
    const cached = readManifest(cacheDir);
    if (cached) {
      process.stdout.write(`${JSON.stringify(cached, null, 2)}\n`);
      return 0;
    }
  }

  const { title, channel } = describeSource(source);
  const mediaPath = source.kind === "file" ? source.value : downloadMedia(source.value, cacheDir);

  const durationSec = probeDuration(mediaPath);
  const focus = options.focus ? parseFocus(options.focus) : null;
  if (options.focus && !focus) {
    process.stderr.write(`Could not parse --focus "${options.focus}" — expected e.g. 5:09-5:36\n`);
    return 1;
  }

  let policy;
  let maxFrames;
  let candidates;

  if (focus) {
    policy = "focus";
    maxFrames = focusPolicy(focus.to - focus.from);
    candidates = spreadOver(focus.from, focus.to, maxFrames);
  } else {
    ({ policy, maxFrames } = framePolicy(durationSec));
    candidates = policy === "short-form-1fps"
      ? everySecond(durationSec)
      : withCoverageFloor(detectScenes(mediaPath), durationSec, maxFrames);
  }

  // Oversample, then let pixels decide. Dedup only removes frames, so casting
  // wider before it costs extraction time but never coverage.
  const extracted = extractFrames(mediaPath, thinFrames(candidates, maxFrames * OVERSAMPLE), cacheDir);
  const { kept: deduped, dropped, reason: dedupReason } = dedupePerceptual(extracted);
  const frames = evenSample(deduped, maxFrames);
  const grids = buildGrids(frames, cacheDir);

  const manifest = {
    source: source.value,
    videoId,
    title,
    channel,
    durationSec,
    transcript: await buildTranscript(source, mediaPath, cacheDir, { useOpenAI: options.openai }),
    frames,
    grids,
    budget: {
      policy,
      framesFound: candidates.length,
      framesExtracted: extracted.length,
      framesDeduped: dropped,
      // Only present when dedup could not run at all, so a 0 above is never
      // mistaken for "the video had no repetitive frames".
      ...(dedupReason ? { dedupSkipped: dedupReason } : {}),
      framesKept: frames.length,
      // What loading the grids actually costs. Reading every frame instead
      // would cost frames.length * TOKENS_PER_FRAME — roughly five times more.
      estTokens: grids.length * TOKENS_PER_GRID,
    },
  };

  writeManifest(cacheDir, manifest);
  process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
  return 0;
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (invokedDirectly) {
  try {
    process.exit(await main(process.argv.slice(2)));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}

export {
  CELL_HEIGHT,
  DEDUP_THRESHOLD,
  DEDUP_THUMB,
  OVERSAMPLE,

  OPENAI_MAX_UPLOAD_BYTES,
  OPENAI_MODEL,
  WHISPER_CLIS,
  DEFAULT_CACHE_SEGMENTS,
  MIN_SCENE_GAP_SEC,
  CELL_WIDTH,
  FRAME_LONG_EDGE,
  GRID_COLS,
  GRID_ROWS,
  MAX_FRAMES,
  TARGET_GAP_SEC,
  SCENE_THRESHOLD,
  SHORT_FORM_MAX_SEC,
  TOKENS_PER_FRAME,
  TOKENS_PER_GRID,
  USAGE,
};
