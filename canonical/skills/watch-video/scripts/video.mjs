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
  try {
    execFileSync("which", [bin], { stdio: "ignore" });
  } catch {
    throw new Error(`${bin} is not installed. Install it with: ${installHint}`);
  }
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

  const mediaPath = source.kind === "file" ? source.value : null;
  const { title, channel } = describeSource(source);

  // Milestones 2-4 fill transcript, frames, and grids. The shape is fixed here
  // so the Seam is stable from the first commit.
  const manifest = {
    source: source.value,
    videoId,
    title,
    channel,
    durationSec: probeDuration(mediaPath ?? source.value),
    transcript: { status: "none" },
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
