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

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const USAGE = `Usage: video.mjs <source> [options]

  <source>              A video URL (YouTube, Vimeo, and ~1800 other sites via
                        yt-dlp) or a path to a local video file.

Options:
  --cache-dir <dir>     Where to write the manifest and extracted assets.
                        Defaults to ./.watch-video/<videoId>/
  --force               Re-extract even when a cached manifest already exists.
  --help                Print this message.

Writes <cache-dir>/manifest.json and prints it to stdout.`;

/** Long edge, in pixels, for extracted source frames. */
const FRAME_LONG_EDGE = 1568;

/**
 * Split argv into a source plus flags. Kept deliberately small — this script
 * has three options and does not need an arg-parsing dependency.
 */
export function parseArgs(argv) {
  const options = { source: null, cacheDir: null, force: false, help: false };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--force") {
      options.force = true;
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
 * A playlist would multiply the frame budget by however many videos it holds,
 * for a context nobody can reason across. Reject it rather than silently
 * loading the first entry or all of them.
 */
export function isPlaylistUrl(value) {
  return /[?&]list=/.test(value);
}

/**
 * Stable cache key. Remote videos use the site's own id. Local files hash their
 * absolute path plus byte size, so the same file yields the same key across
 * runs while an edited file correctly misses the cache.
 */
export function videoIdFor(source) {
  if (source.kind === "url") {
    return run("yt-dlp", ["--print", "id", "--skip-download", source.value]).trim();
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
    ["--write-auto-sub", "--sub-format", "vtt", "--skip-download", "-o", stem, url],
    ["--write-auto-sub", "--sub-format", "vtt", "--skip-download",
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
 * Speech-to-text for videos with no caption track. faster-whisper, never
 * mlx-whisper — the latter is Apple-Silicon-only and would fail on any other
 * machine this toolkit installs to.
 */
export function transcribeWithWhisper(mediaPath, cacheDir) {
  fs.mkdirSync(cacheDir, { recursive: true });
  run("faster-whisper", [
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
export function buildTranscript(source, mediaPath, cacheDir) {
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

  if (mediaPath && hasBinary("faster-whisper")) {
    segments = transcribeWithWhisper(mediaPath, cacheDir);
    if (segments.length > 0) {
      return { status: "whisper", path: writeTranscript(cacheDir, segments), segments: segments.length };
    }
  }

  return { status: "none" };
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

export function main(argv) {
  const options = parseArgs(argv);

  if (options.help || !options.source) {
    process.stdout.write(`${USAGE}\n`);
    return 0;
  }

  const source = resolveSource(options.source);

  if (source.kind === "url" && isPlaylistUrl(source.value)) {
    process.stderr.write("Playlist URLs are not supported — pass a single video URL.\n");
    return 1;
  }

  requireBinary("ffprobe", "brew install ffmpeg");
  if (source.kind === "url") {
    requireBinary("yt-dlp", "brew install yt-dlp");
  }

  const videoId = videoIdFor(source);
  const cacheDir = options.cacheDir ?? path.join(process.cwd(), ".watch-video", videoId);

  if (!options.force) {
    const cached = readManifest(cacheDir);
    if (cached) {
      process.stdout.write(`${JSON.stringify(cached, null, 2)}\n`);
      return 0;
    }
  }

  const { title, channel } = describeSource(source);
  const mediaPath = source.kind === "file" ? source.value : downloadMedia(source.value, cacheDir);

  // Milestones 3-4 fill frames and grids. Their keys are shaped here so the
  // Seam stays stable across commits.
  const manifest = {
    source: source.value,
    videoId,
    title,
    channel,
    durationSec: probeDuration(mediaPath),
    transcript: buildTranscript(source, mediaPath, cacheDir),
    frames: [],
    grids: [],
    budget: { policy: null, framesFound: 0, framesKept: 0, estTokens: 0 },
  };

  writeManifest(cacheDir, manifest);
  process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
  return 0;
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (invokedDirectly) {
  try {
    process.exit(main(process.argv.slice(2)));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}

export { FRAME_LONG_EDGE, USAGE };
