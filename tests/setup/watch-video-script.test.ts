import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  buildGrids,
  DEDUP_THRESHOLD,
  dedupePerceptual,
  DEFAULT_CACHE_SEGMENTS,
  evenSample,
  focusPolicy,
  frameDelta,
  parseFocus,
  parseTimeSpec,
  planChunks,
  shiftSegments,
  spreadOver,
  thumbnailFrames,
  findWhisperCli,
  OPENAI_MAX_UPLOAD_BYTES,
  OPENAI_MODEL,
  transcribeWithOpenAI,
  WHISPER_CLIS,
  detectScenes,
  everySecond,
  extractFrames,
  formatTimestamp,
  framePolicy,
  isPlaylistUrl,
  normalizeUrl,
  spaceOut,
  withCoverageFloor,
  parseArgs,
  parseVtt,
  probeDuration,
  readManifest,
  resolveSource,
  thinFrames,
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
      // The silent fixture has no captions and no whisper in CI.
      transcript: { status: "none" },
    });
    expect(manifest!.videoId).toMatch(/^[0-9a-f]{12}$/);
    expect(manifest!.title).toBe("fixture.mp4");
    expect(manifest!.durationSec).toBeCloseTo(9, 1);

    // Assert the contract's shape, not its contents — later milestones populate
    // frames and grids, and this assertion has to survive that.
    expect(Array.isArray(manifest!.frames)).toBe(true);
    expect(Array.isArray(manifest!.grids)).toBe(true);
    expect(manifest!.budget).toMatchObject({
      policy: expect.anything(),
      framesFound: expect.any(Number),
      framesKept: expect.any(Number),
      estTokens: expect.any(Number),
    });
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

  // AC7 — a *pure* playlist URL, one naming no specific video.
  it("rejects playlist URLs with a clear message", () => {
    const result = runScript(["https://youtube.com/playlist?list=PL123"]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Playlist URLs are not supported");
  });
});

describe.skipIf(!ffmpegAvailable)("watch-video script — frame track", () => {
  let workDir: string;
  let fixture: string;

  beforeAll(() => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), "watch-video-frames-"));
    fixture = buildFixture(workDir);
  });

  afterAll(() => {
    fs.rmSync(workDir, { recursive: true, force: true });
  });

  // AC3 — the fixture's cuts are at exactly 3s and 6s by construction, so this
  // assertion is exact rather than approximate.
  it("detects scene changes at their real timestamps", () => {
    const scenes = detectScenes(fixture);

    expect(scenes[0]).toBe(0);
    expect(scenes.some((t) => Math.abs(t - 3) < 0.5)).toBe(true);
    expect(scenes.some((t) => Math.abs(t - 6) < 0.5)).toBe(true);
  });

  it("always includes an opening frame at t=0", () => {
    expect(detectScenes(fixture)).toContain(0);
  });

  it("cuts one frame file per timestamp", () => {
    const cacheDir = path.join(workDir, "frames-out");
    const frames = extractFrames(fixture, [0, 3, 6], cacheDir);

    expect(frames).toHaveLength(3);
    for (const frame of frames) {
      expect(fs.existsSync(frame.path)).toBe(true);
      expect(fs.statSync(frame.path).size).toBeGreaterThan(0);
    }
    expect(frames.map((f) => f.t)).toEqual([0, 3, 6]);
  });

  // A frame that cannot be produced must not take the whole load down with it —
  // one bad seek in a long video should cost that frame, nothing more.
  it("skips frames ffmpeg cannot produce rather than aborting", () => {
    const cacheDir = path.join(workDir, "frames-partial");
    const frames = extractFrames(fixture, [0, 3, 900], cacheDir);

    expect(frames.map((f) => f.t)).toEqual([0, 3]);
    expect(frames).toHaveLength(2);
  });

  it("records frames and budget in the manifest", () => {
    const cacheDir = path.join(workDir, "manifest-frames");
    const result = runScript([fixture, "--cache-dir", cacheDir]);
    expect(result.status).toBe(0);

    const manifest = readManifest(cacheDir);
    // The fixture is 9s, so it takes the short-form path: one frame per second.
    expect(manifest!.budget.policy).toBe("short-form-1fps");
    expect(manifest!.budget.framesFound).toBe(9);

    // The fixture is three 3-second blocks of flat colour — the most repetitive
    // input possible. Perceptual dedup collapses each run to one representative
    // frame, so nine samples become the three genuinely distinct shots. That
    // collapse is the feature, not a loss.
    expect(manifest!.frames.length).toBe(3);
    expect(manifest!.budget.framesKept).toBe(3);
    expect(manifest!.budget.framesDeduped).toBe(6);
    // Pricing is grid-based and asserted in the grid-track suite; frames only
    // set the ceiling for what reading them individually would have cost.
    expect(manifest!.budget.estTokens).toBeLessThan(9 * 1600);
  });
});

describe.skipIf(!ffmpegAvailable)("watch-video script — grid track", () => {
  let workDir: string;
  let fixture: string;
  let sampleFramePath: string;

  beforeAll(() => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), "watch-video-grids-"));
    fixture = buildFixture(workDir);
    sampleFramePath = extractFrames(fixture, [0], path.join(workDir, "sample"))[0].path;
  });

  afterAll(() => {
    fs.rmSync(workDir, { recursive: true, force: true });
  });

  /** 60 frame entries pointing at one real JPEG — buildGrids only reads pixels. */
  function syntheticFrames(count: number) {
    return Array.from({ length: count }, (_, i) => ({ t: i * 30, path: sampleFramePath }));
  }

  // AC5
  it("tiles 60 frames into 4 grids, the last holding 12 cells", () => {
    const cacheDir = path.join(workDir, "grids-60");
    const grids = buildGrids(syntheticFrames(60), cacheDir);

    expect(grids).toHaveLength(4);
    expect(grids.slice(0, 3).map((g) => g.cells)).toEqual([16, 16, 16]);
    expect(grids[3].cells).toBe(12);
  });

  it("writes a non-empty image for every grid", () => {
    const cacheDir = path.join(workDir, "grids-nonempty");
    for (const grid of buildGrids(syntheticFrames(20), cacheDir)) {
      expect(fs.existsSync(grid.path)).toBe(true);
      expect(fs.statSync(grid.path).size).toBeGreaterThan(0);
    }
  });

  // drawtext is unavailable in Homebrew's ffmpeg, so cellTimes carries the
  // cell-to-timestamp mapping instead of it being burned into the image.
  it("records cell timestamps in row-major reading order", () => {
    const cacheDir = path.join(workDir, "grids-celltimes");
    const grids = buildGrids(syntheticFrames(20), cacheDir);

    expect(grids[0].cellTimes).toHaveLength(16);
    expect(grids[0].cellTimes[0]).toBe(0);
    expect(grids[0].cellTimes[15]).toBe(15 * 30);
    expect(grids[1].cellTimes).toEqual([16, 17, 18, 19].map((i) => i * 30));
  });

  it("spans each grid from its first cell time to its last", () => {
    const cacheDir = path.join(workDir, "grids-span");
    const grids = buildGrids(syntheticFrames(20), cacheDir);

    expect(grids[0].from).toBe(0);
    expect(grids[0].to).toBe(15 * 30);
    expect(grids[1].from).toBe(16 * 30);
  });

  it("returns no grids for no frames", () => {
    expect(buildGrids([], path.join(workDir, "grids-empty"))).toEqual([]);
  });

  it("prices the manifest on grids, not individual frames", () => {
    const cacheDir = path.join(workDir, "manifest-grids");
    const result = runScript([fixture, "--cache-dir", cacheDir]);
    expect(result.status).toBe(0);

    const manifest = readManifest(cacheDir);
    // Three surviving frames (see the dedup note in the frame-track suite) tile
    // into a single grid, priced as one image rather than three.
    expect(manifest!.grids).toHaveLength(1);
    expect(manifest!.grids[0].cells).toBe(3);
    expect(manifest!.budget.estTokens).toBe(4784);
  });
});

describe("watch-video script — frame budget", () => {
  // AC4
  it("samples short clips every second and long ones by scene", () => {
    expect(framePolicy(90)).toEqual({ policy: "short-form-1fps", maxFrames: 90 });
    expect(framePolicy(3600)).toEqual({ policy: "scene-change", maxFrames: 160 });
  });

  // Regression: a flat 60-frame cap gave a 6.6-minute video one sample per 6.6
  // seconds while spending only ~19k of the ~100k budget, and a stat card shown
  // for ~5s fell entirely between two samples.
  it("scales frame count with duration instead of a flat cap", () => {
    const short = framePolicy(396);
    expect(short.maxFrames).toBe(99);
    expect(396 / short.maxFrames).toBeLessThanOrEqual(4);
  });

  it("caps long videos so the budget stays bounded", () => {
    expect(framePolicy(7200).maxFrames).toBe(160);
  });

  it("treats the two-minute mark as the boundary", () => {
    expect(framePolicy(119).policy).toBe("short-form-1fps");
    expect(framePolicy(120).policy).toBe("scene-change");
  });

  it("emits one timestamp per second for short clips", () => {
    expect(everySecond(5)).toEqual([0, 1, 2, 3, 4]);
  });

  // Regression: a 19.014s video previously emitted a sample at t=19. Seeking
  // there lands past the final frame, ffmpeg writes nothing, and the whole run
  // aborted. Caught by driving a real video, not by the fixture.
  it("stops a full second short of the end on a fractional duration", () => {
    expect(everySecond(19.014)).not.toContain(19);
    expect(everySecond(19.014)).toHaveLength(19);
    expect(everySecond(20)).toHaveLength(20);
  });

  it("always yields at least one timestamp, even for a sub-second clip", () => {
    expect(everySecond(0.4)).toEqual([0]);
  });

  it("thins an over-long list to the cap, keeping the first", () => {
    const many = Array.from({ length: 187 }, (_, i) => i * 2);
    const kept = thinFrames(many, 60);

    expect(kept).toHaveLength(60);
    expect(kept[0]).toBe(0);
    expect(kept[kept.length - 1]).toBe(372);
  });

  it("leaves a list shorter than the cap untouched", () => {
    expect(thinFrames([0, 3, 6], 60)).toEqual([0, 3, 6]);
  });

  it("spaces kept frames evenly rather than taking a prefix", () => {
    const kept = thinFrames([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 5);
    expect(kept).toEqual([0, 2, 5, 7, 9]);
  });
});

describe("watch-video script — whisper detection", () => {
  // The faster-whisper pip package is a library and ships no binary; its CLI is
  // the separate whisper-ctranslate2 package. Calling `faster-whisper` never
  // worked, and the whisper path was dead for everyone.
  it("looks for real whisper CLIs, not the library package name", () => {
    expect(WHISPER_CLIS).toContain("whisper-ctranslate2");
    expect(WHISPER_CLIS).not.toContain("faster-whisper");
    expect(WHISPER_CLIS).not.toContain("mlx-whisper");
  });

  it("returns null rather than throwing when no whisper CLI is present", () => {
    const found = findWhisperCli();
    expect(found === null || WHISPER_CLIS.includes(found)).toBe(true);
  });
});

describe.skipIf(!ffmpegAvailable)("watch-video script — transcript degradation", () => {
  let workDir: string;
  let fixture: string;

  beforeAll(() => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), "watch-video-degrade-"));
    fixture = buildFixture(workDir);
  });

  afterAll(() => {
    fs.rmSync(workDir, { recursive: true, force: true });
  });

  // A blocked model download (HTTP 403 behind a corporate proxy) previously
  // threw and aborted the load, throwing away frames already extracted.
  it("completes the load and explains itself when there is no transcript", () => {
    const cacheDir = path.join(workDir, "no-transcript");
    const result = runScript([fixture, "--cache-dir", cacheDir]);

    expect(result.status).toBe(0);

    const manifest = readManifest(cacheDir);
    expect(manifest!.transcript.status).toBe("none");
    expect(manifest!.transcript.reason).toBeTruthy();
    // Frames must survive a missing transcript.
    expect(manifest!.frames.length).toBeGreaterThan(0);
    expect(manifest!.grids.length).toBeGreaterThan(0);
  });
});

describe("watch-video script — OpenAI transcription rung", () => {
  // whisper-1 is the only transcription model returning WebVTT. The newer
  // gpt-4o-transcribe models emit json/text with no timestamps, which would
  // break the timestamp spine the pipeline is built on.
  it("uses whisper-1, the only model that returns timestamped VTT", () => {
    expect(OPENAI_MODEL).toBe("whisper-1");
  });

  it("knows the API's 25 MB upload cap", () => {
    expect(OPENAI_MAX_UPLOAD_BYTES).toBe(25 * 1024 * 1024);
  });

  // Egress must be a deliberate choice, never a silent fallback.
  it("is off unless explicitly requested", () => {
    expect(parseArgs(["clip.mp4"]).openai).toBe(false);
    expect(parseArgs(["clip.mp4", "--openai"]).openai).toBe(true);
  });

  it("refuses to run without a key rather than failing obscurely", async () => {
    const previous = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      await expect(transcribeWithOpenAI("/nonexistent.mp4", "/tmp")).rejects.toThrow(
        /OPENAI_API_KEY/,
      );
    } finally {
      if (previous !== undefined) process.env.OPENAI_API_KEY = previous;
    }
  });
});

describe("watch-video script — perceptual dedup", () => {
  const same = new Uint8Array(256).fill(100);
  const nearlySame = new Uint8Array(256).fill(101);
  const different = new Uint8Array(256).fill(200);

  it("measures mean per-pixel difference", () => {
    expect(frameDelta(same, same)).toBe(0);
    expect(frameDelta(same, nearlySame)).toBe(1);
    expect(frameDelta(same, different)).toBe(100);
  });

  it("treats mismatched thumbnails as maximally different, never as duplicates", () => {
    expect(frameDelta(same, new Uint8Array(4))).toBe(Infinity);
    expect(frameDelta(same, null as unknown as Uint8Array)).toBe(Infinity);
  });

  it("keeps frames that differ by more than the threshold", () => {
    expect(DEDUP_THRESHOLD).toBe(2);
    expect(frameDelta(same, nearlySame)).toBeLessThanOrEqual(DEDUP_THRESHOLD);
    expect(frameDelta(same, different)).toBeGreaterThan(DEDUP_THRESHOLD);
  });

  it("is a no-op on one frame or none", () => {
    expect(dedupePerceptual([]).kept).toEqual([]);
    const one = [{ t: 0, path: "/nope.jpg" }];
    expect(dedupePerceptual(one).kept).toEqual(one);
  });

  it("fails open when thumbnails cannot be produced", () => {
    // Non-existent paths: ffmpeg fails, and dedup must return frames untouched
    // rather than dropping everything.
    const frames = [
      { t: 0, path: "/nope/frame-0000.jpg" },
      { t: 1, path: "/nope/frame-0001.jpg" },
    ];
    expect(dedupePerceptual(frames)).toEqual({ kept: frames, dropped: 0 });
    expect(thumbnailFrames(["/nope/not-numbered.jpg"])).toEqual([]);
  });
});

describe("watch-video script — focus mode", () => {
  it("parses clock times and bare seconds", () => {
    expect(parseTimeSpec("5:09")).toBe(309);
    expect(parseTimeSpec("1:02:03")).toBe(3723);
    expect(parseTimeSpec("309")).toBe(309);
  });

  it("parses a span", () => {
    expect(parseFocus("5:09-5:36")).toEqual({ from: 309, to: 336 });
  });

  it("rejects a malformed or inverted span", () => {
    expect(parseFocus("5:36-5:09")).toBeNull();
    expect(parseFocus("5:09")).toBeNull();
    expect(parseFocus("banana-5:36")).toBeNull();
  });

  // A range means the user is hunting for something specific, so sample harder
  // than the whole-video pass would.
  it("samples a short span far denser than the whole-video budget", () => {
    expect(focusPolicy(27)).toBe(54);
    expect(focusPolicy(5)).toBe(10);
    expect(focusPolicy(600)).toBe(160);
  });

  it("spreads timestamps evenly across the span", () => {
    expect(spreadOver(309, 336, 4)).toEqual([309, 318, 327, 336]);
  });
});

describe("watch-video script — audio chunking", () => {
  it("leaves audio under the cap as one piece", () => {
    expect(planChunks(600, 5 * 1024 * 1024)).toEqual([{ start: 0, duration: 600 }]);
  });

  it("splits oversized audio into equal pieces that each fit", () => {
    const chunks = planChunks(3600, 60 * 1024 * 1024);
    expect(chunks).toHaveLength(3);
    expect(chunks[0].start).toBe(0);
    expect(chunks[2].start).toBeCloseTo(2400, 0);
    const total = chunks.reduce((sum, c) => sum + c.duration, 0);
    expect(total).toBeCloseTo(3600, 0);
  });

  // Each chunk is transcribed as its own file starting at zero, so without the
  // offset every chunk after the first reports times from the top of the video.
  it("re-bases chunk timestamps onto the full video clock", () => {
    const segments = [{ t: 0, text: "a" }, { t: 12.5, text: "b" }];
    expect(shiftSegments(segments, 600)).toEqual([
      { t: 600, text: "a" },
      { t: 612.5, text: "b" },
    ]);
  });

  it("leaves the first chunk untouched", () => {
    expect(shiftSegments([{ t: 3, text: "x" }], 0)).toEqual([{ t: 3, text: "x" }]);
  });
});

describe("watch-video script — cache location", () => {
  it("defaults into .exports, matching where sibling skills write", () => {
    expect(DEFAULT_CACHE_SEGMENTS).toEqual([".exports", "watch-video"]);
  });

  it("writes the manifest under .exports/watch-video/<videoId> when no dir is given", () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "watch-video-default-"));
    try {
      const fixture = buildFixture(cwd);
      execFileSync("node", [scriptPath, fixture], { cwd, encoding: "utf-8" });

      const base = path.join(cwd, ".exports", "watch-video");
      const ids = fs.readdirSync(base);

      expect(ids).toHaveLength(1);
      expect(fs.existsSync(path.join(base, ids[0], "manifest.json"))).toBe(true);
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  });
});

describe("watch-video script — scene spacing and coverage", () => {
  // Regression: a 17-minute screencast produced [0, 576x14, 1027] — a fade at
  // 9:36 tripped the threshold on every frame it touched, and the burst ate the
  // whole budget. Found by loading a real talk, not by any fixture.
  it("collapses a burst of near-identical timestamps to its first entry", () => {
    const burst = [0, 576.0, 576.04, 576.08, 576.12, 576.16, 1027.4];
    expect(spaceOut(burst, 2)).toEqual([0, 576.0, 1027.4]);
  });

  it("keeps timestamps that are genuinely far apart", () => {
    expect(spaceOut([0, 30, 60, 90], 2)).toEqual([0, 30, 60, 90]);
  });

  it("sorts before spacing so unordered input still collapses", () => {
    expect(spaceOut([100, 0, 100.5, 50], 2)).toEqual([0, 50, 100]);
  });

  // A screencast changes gradually, so detection alone leaves most of the
  // runtime unsampled. The floor makes frames describe the whole video.
  it("tops up sparse scene detection to cover the full duration", () => {
    const sparse = [0, 576, 1027];
    const covered = withCoverageFloor(sparse, 1038, 60);

    expect(covered.length).toBeGreaterThan(50);
    expect(covered[0]).toBe(0);
    expect(covered[covered.length - 1]).toBeGreaterThan(1000);
  });

  it("leaves detection alone when it already fills the budget", () => {
    const plenty = Array.from({ length: 60 }, (_, i) => i * 10);
    expect(withCoverageFloor(plenty, 600, 60)).toEqual(plenty);
  });

  it("preserves real scene changes when topping up", () => {
    const covered = withCoverageFloor([0, 576, 1027], 1038, 60);
    expect(covered).toContain(576);
    expect(covered).toContain(1027);
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

  // A watch URL carrying a list is one video opened from a queue, not a
  // playlist. Rejecting it would refuse the most common way people copy a link.
  it("rejects only pure playlist URLs, not watch URLs with list context", () => {
    expect(isPlaylistUrl("https://youtube.com/playlist?list=PL1")).toBe(true);
    expect(isPlaylistUrl("https://youtube.com/watch?v=a&list=WL&index=24")).toBe(false);
    expect(isPlaylistUrl("https://youtube.com/watch?v=a")).toBe(false);
  });

  it("strips playlist, index, and start-time context from a watch URL", () => {
    expect(normalizeUrl("https://www.youtube.com/watch?v=M6mYodf0dJM&list=WL&index=24&t=84s"))
      .toBe("https://www.youtube.com/watch?v=M6mYodf0dJM");
    expect(normalizeUrl("https://youtube.com/watch?v=abc")).toBe("https://www.youtube.com/watch?v=abc");
  });

  it("leaves non-watch URLs alone", () => {
    expect(normalizeUrl("https://vimeo.com/12345")).toBe("https://vimeo.com/12345");
  });

  it("parses flags and the positional source", () => {
    const parsed = parseArgs(["clip.mp4", "--cache-dir", "/tmp/x", "--force"]);
    expect(parsed).toMatchObject({ source: "clip.mp4", cacheDir: "/tmp/x", force: true });
  });

  it("treats a bare --help as a request for usage", () => {
    expect(parseArgs(["--help"]).help).toBe(true);
  });
});
