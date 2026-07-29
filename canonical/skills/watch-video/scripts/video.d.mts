// Type declarations for video.mjs, so the vitest suite can import its
// functions directly rather than shelling out. The script itself stays plain
// JavaScript because it ships to ~/.claude/skills/ and runs under bare `node`.

export interface Source {
  kind: "url" | "file";
  value: string;
}

export interface ParsedArgs {
  source: string | null;
  cacheDir: string | null;
  force: boolean;
  help: boolean;
  openai: boolean;
  focus: string | null;
}

export interface TranscriptInfo {
  status: "captions" | "whisper" | "openai" | "none";
  path?: string;
  segments?: number;
  /** Present when status is "none": why there is no transcript. */
  reason?: string;
}

export interface FrameEntry {
  t: number;
  path: string;
}

export interface GridEntry {
  path: string;
  cells: number;
  from: number;
  to: number;
  /** Frame timestamps in row-major reading order — the cell-to-time mapping. */
  cellTimes: number[];
}

export interface Budget {
  policy: "scene-change" | "short-form-1fps" | "focus" | null;
  framesFound: number;
  framesExtracted: number;
  framesDeduped: number;
  /** Present only when dedup could not run, so framesDeduped: 0 stays unambiguous. */
  dedupSkipped?: string;
  framesKept: number;
  estTokens: number;
}

export interface Manifest {
  source: string;
  videoId: string;
  title: string;
  channel: string | null;
  durationSec: number;
  transcript: TranscriptInfo;
  frames: FrameEntry[];
  grids: GridEntry[];
  budget: Budget;
}

export declare const FRAME_LONG_EDGE: number;
export declare const SCENE_THRESHOLD: number;
export declare const SHORT_FORM_MAX_SEC: number;
export declare const MAX_FRAMES: number;
export declare const TARGET_GAP_SEC: number;
export declare const TOKENS_PER_GRID: number;
export declare const TOKENS_PER_FRAME: number;
export declare const USAGE: string;

export declare function detectScenes(mediaPath: string, threshold?: number): number[];
export declare function framePolicy(durationSec: number): {
  policy: "short-form-1fps" | "scene-change";
  maxFrames: number;
};
export declare function everySecond(durationSec: number): number[];
export declare function thinFrames(timestamps: number[], maxFrames: number): number[];
export declare function extractFrames(
  mediaPath: string,
  timestamps: number[],
  cacheDir: string,
): FrameEntry[];

export declare function parseArgs(argv: string[]): ParsedArgs;
export declare function resolveSource(arg: string): Source;
export declare function isPlaylistUrl(value: string): boolean;
export declare function videoIdFor(source: Source): string;
export declare function probeDuration(filePath: string): number;
export declare function writeManifest(cacheDir: string, manifest: Manifest): string;
export declare function readManifest(cacheDir: string): Manifest | null;
export declare function describeSource(source: Source): { title: string; channel: string | null };
export declare function requireBinary(bin: string, installHint: string): void;
export declare function hasBinary(bin: string): boolean;
export declare function main(argv: string[]): Promise<number>;

export interface Segment {
  t: number;
  text: string;
}

export declare function downloadMedia(url: string, cacheDir: string): string;
export declare function fetchSubtitles(url: string, cacheDir: string): string | null;
export declare function vttTimeToSeconds(stamp: string): number;
export declare function parseVtt(vttPath: string): Segment[];
export declare function formatTimestamp(seconds: number): string;
export declare function writeTranscript(cacheDir: string, segments: Segment[]): string;
export declare const WHISPER_CLIS: readonly string[];
export declare function findWhisperCli(): string | null;
export declare function transcribeWithWhisper(
  mediaPath: string,
  cacheDir: string,
  cli?: string | null,
): Segment[];
export declare function buildTranscript(
  source: Source,
  mediaPath: string | null,
  cacheDir: string,
  options?: { useOpenAI?: boolean },
): Promise<TranscriptInfo>;

export declare const OPENAI_MODEL: string;
export declare const OPENAI_MAX_UPLOAD_BYTES: number;
export declare function extractAudio(mediaPath: string, cacheDir: string): string;
export declare function transcribeWithOpenAI(mediaPath: string, cacheDir: string): Promise<Segment[]>;

export declare const GRID_COLS: number;
export declare const GRID_ROWS: number;
export declare const CELL_WIDTH: number;
export declare const CELL_HEIGHT: number;

export declare function buildGrids(frames: FrameEntry[], cacheDir: string): GridEntry[];

export declare function normalizeUrl(value: string): string;

export declare const MIN_SCENE_GAP_SEC: number;
export declare function spaceOut(timestamps: number[], minGapSec: number): number[];
export declare function withCoverageFloor(
  scenes: number[],
  durationSec: number,
  maxFrames: number,
): number[];

export declare const DEFAULT_CACHE_SEGMENTS: readonly string[];

export declare const DEDUP_THUMB: number;
export declare const DEDUP_THRESHOLD: number;
export declare const OVERSAMPLE: number;

export declare function thumbnailFrames(paths: string[]): Uint8Array[];
export declare function frameDelta(a: Uint8Array, b: Uint8Array): number;
export declare function dedupePerceptual(
  frames: FrameEntry[],
  threshold?: number,
): { kept: FrameEntry[]; dropped: number; reason?: string };
export declare function evenSample(frames: FrameEntry[], n: number): FrameEntry[];

export declare function parseTimeSpec(value: string | number): number | null;
export declare function parseFocus(value: string): { from: number; to: number } | null;
export declare function focusPolicy(spanSec: number): number;
export declare function spreadOver(from: number, to: number, count: number): number[];

export interface AudioChunk { start: number; duration: number }
export declare function planChunks(
  durationSec: number,
  totalBytes: number,
  maxBytes?: number,
): AudioChunk[];
export declare function shiftSegments(segments: Segment[], offsetSec: number): Segment[];
export declare function sliceAudio(
  audioPath: string,
  chunk: AudioChunk,
  cacheDir: string,
  index: number,
): string;
