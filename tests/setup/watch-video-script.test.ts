import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  formatTimestamp,
  isPlaylistUrl,
  parseArgs,
  parseVtt,
  probeDuration,
  readManifest,
  resolveSource,
  videoIdFor,
  vttTimeToSeconds,
  writeTranscript,
} from "../../canonical/skills/watch-video/scripts/video.mjs";

const repoRoot = process.cwd();
const scriptPath = path.join(
  repoRoot,
  "canonical",
  "skills",
  "watch-video",
  "scripts",
  "video.mjs",
);

/**
 * The fixture is built at runtime rather than committed: it keeps a binary out
 * of a public repo, and — more importantly — puts the cuts at timestamps we
 * know by construction, so scene-detection assertions are exact.
 *
 * Colours are chosen for distinct *luma*, not distinct hue. ffmpeg's scene
 * score is luma-weighted, so red->green (luma ~76 vs ~75) is invisible to it
 * while black->white->gray scores 1.0 at every cut. See the plan's
 * Surprises & Discoveries.
 */
function buildFixture(dir: string): string {
  const target = path.join(dir, "fixture.mp4");
  execFileSync("ffmpeg", [
    "-y", "-loglevel", "error",
    "-f", "lavfi", "-i", "color=black:size=320x240:duration=3:rate=10",
    "-f", "lavfi", "-i", "color=white:size=320x240:duration=3:rate=10",
    "-f", "lavfi", "-i", "color=gray:size=320x240:duration=3:rate=10",
    "-filter_complex", "[0:v][1:v][2:v]concat=n=3:v=1[out]",
    "-map", "[out]", target,
  ]);
  return target;
}

function hasBinary(bin: string): boolean {
  try {
    execFileSync("which", [bin], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function runScript(args: string[]): { stdout: string; stderr: string; status: number } {
  try {
    const stdout = execFileSync("node", [scriptPath, ...args], { encoding: "utf-8" });
    return { stdout, stderr: "", status: 0 };
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; status?: number };
    return { stdout: err.stdout ?? "", stderr: err.stderr ?? "", status: err.status ?? 1 };
  }
}

const ffmpegAvailable = hasBinary("ffmpeg") && hasBinary("ffprobe");

describe.skipIf(!ffmpegAvailable)("watch-video script — manifest Seam", () => {
  let workDir: string;
  let fixture: string;

  beforeAll(() => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), "watch-video-"));
    fixture = buildFixture(workDir);
  });

  afterAll(() => {
    fs.rmSync(workDir, { recursive: true, force: true });
  });

  // AC1
  it("writes a manifest carrying the full contract", () => {
    const cacheDir = path.join(workDir, "cache-ac1");
    const result = runScript([fixture, "--cache-dir", cacheDir]);

    expect(result.status).toBe(0);

    const manifest = readManifest(cacheDir);
    expect(manifest).not.toBeNull();
    expect(manifest).toMatchObject({
      source: fixture,
      transcript: { status: "none" },
      frames: [],
      grids: [],
    });
    expect(manifest!.videoId).toMatch(/^[0-9a-f]{12}$/);
    expect(manifest!.title).toBe("fixture.mp4");
    expect(manifest!.durationSec).toBeCloseTo(9, 1);
    expect(manifest!.budget).toHaveProperty("estTokens");
  });

  // AC2 — the cache key must hold across runs.
  it("derives a stable videoId for the same file", () => {
    const source = resolveSource(fixture);
    expect(videoIdFor(source)).toBe(videoIdFor(source));
  });

  it("probes the fixture duration as 9 seconds", () => {
    expect(probeDuration(fixture)).toBeCloseTo(9, 1);
  });

  // AC6 — a second run must reuse the manifest rather than re-extract.
  it("reuses a cached manifest instead of re-extracting", () => {
    const cacheDir = path.join(workDir, "cache-ac6");
    runScript([fixture, "--cache-dir", cacheDir]);

    const manifestPath = path.join(cacheDir, "manifest.json");
    const firstWrite = fs.statSync(manifestPath).mtimeMs;

    const started = Date.now();
    const second = runScript([fixture, "--cache-dir", cacheDir]);
    const elapsed = Date.now() - started;

    expect(second.status).toBe(0);
    expect(fs.statSync(manifestPath).mtimeMs).toBe(firstWrite);
    expect(elapsed).toBeLessThan(1000);
  });

  // AC7
  it("rejects playlist URLs with a clear message", () => {
    const result = runScript(["https://youtube.com/watch?v=abc&list=PL123"]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Playlist URLs are not supported");
  });
});

describe("watch-video script — transcript track", () => {
  let workDir: string;

  beforeAll(() => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), "watch-video-vtt-"));
  });

  afterAll(() => {
    fs.rmSync(workDir, { recursive: true, force: true });
  });

  function writeVtt(name: string, body: string): string {
    const target = path.join(workDir, name);
    fs.writeFileSync(target, body);
    return target;
  }

  it("converts VTT timestamps to seconds", () => {
    expect(vttTimeToSeconds("00:00:02.500")).toBeCloseTo(2.5, 3);
    expect(vttTimeToSeconds("00:01:30.000")).toBeCloseTo(90, 3);
    expect(vttTimeToSeconds("01:00:00.000")).toBeCloseTo(3600, 3);
  });

  it("parses a plain VTT into timestamped segments", () => {
    const vtt = writeVtt(
      "plain.vtt",
      [
        "WEBVTT",
        "",
        "00:00:00.000 --> 00:00:02.000",
        "Hello world",
        "",
        "00:00:02.000 --> 00:00:04.000",
        "Second line",
        "",
      ].join("\n"),
    );

    expect(parseVtt(vtt)).toEqual([
      { t: 0, text: "Hello world" },
      { t: 2, text: "Second line" },
    ]);
  });

  // Auto-generated YouTube captions carry word-level timing tags and repeat the
  // previous cue's tail on every cue. Both have to come out or the transcript
  // reads as a stutter.
  it("strips inline timing tags and rolling duplicates from auto-generated captions", () => {
    const vtt = writeVtt(
      "auto.vtt",
      [
        "WEBVTT",
        "Kind: captions",
        "Language: en",
        "",
        "00:00:01.000 --> 00:00:03.000",
        "the model reads",
        "",
        "00:00:03.000 --> 00:00:05.000",
        "the model reads",
        "<00:00:03.500><c>every</c> <00:00:04.100><c>token</c>",
        "",
      ].join("\n"),
    );

    const segments = parseVtt(vtt);
    expect(segments).toHaveLength(2);
    expect(segments[0]).toEqual({ t: 1, text: "the model reads" });
    expect(segments[1].t).toBe(3);
    expect(segments[1].text).toBe("every token");
    expect(segments[1].text).not.toContain("<");
  });

  it("formats timestamps as MM:SS", () => {
    expect(formatTimestamp(0)).toBe("00:00");
    expect(formatTimestamp(65.9)).toBe("01:05");
    expect(formatTimestamp(3599)).toBe("59:59");
  });

  it("writes a transcript with one timestamped line per segment", () => {
    const cacheDir = path.join(workDir, "transcript-out");
    const written = writeTranscript(cacheDir, [
      { t: 0, text: "opening" },
      { t: 92, text: "the main point" },
    ]);

    expect(fs.readFileSync(written, "utf-8")).toBe("[00:00] opening\n[01:32] the main point\n");
  });
});

describe("watch-video script — argument handling", () => {
  it("distinguishes URLs from local paths", () => {
    expect(resolveSource("https://youtube.com/watch?v=abc").kind).toBe("url");
    expect(resolveSource("http://example.com/v.mp4").kind).toBe("url");
    expect(resolveSource("./clip.mp4").kind).toBe("file");
  });

  it("resolves file sources to absolute paths", () => {
    expect(path.isAbsolute(resolveSource("./clip.mp4").value)).toBe(true);
  });

  it("recognises playlist URLs by their list parameter", () => {
    expect(isPlaylistUrl("https://youtube.com/watch?v=a&list=PL1")).toBe(true);
    expect(isPlaylistUrl("https://youtube.com/playlist?list=PL1")).toBe(true);
    expect(isPlaylistUrl("https://youtube.com/watch?v=a")).toBe(false);
  });

  it("parses flags and the positional source", () => {
    const parsed = parseArgs(["clip.mp4", "--cache-dir", "/tmp/x", "--force"]);
    expect(parsed).toMatchObject({ source: "clip.mp4", cacheDir: "/tmp/x", force: true });
  });

  it("treats a bare --help as a request for usage", () => {
    expect(parseArgs(["--help"]).help).toBe(true);
  });
});
