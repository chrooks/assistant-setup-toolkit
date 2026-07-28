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
}

export interface TranscriptInfo {
  status: "captions" | "whisper" | "none";
  path?: string;
  segments?: number;
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
}

export interface Budget {
  policy: "scene-change" | "short-form-1fps" | null;
  framesFound: number;
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
export declare const USAGE: string;

export declare function parseArgs(argv: string[]): ParsedArgs;
export declare function resolveSource(arg: string): Source;
export declare function isPlaylistUrl(value: string): boolean;
export declare function videoIdFor(source: Source): string;
export declare function probeDuration(filePath: string): number;
export declare function writeManifest(cacheDir: string, manifest: Manifest): string;
export declare function readManifest(cacheDir: string): Manifest | null;
export declare function describeSource(source: Source): { title: string; channel: string | null };
export declare function requireBinary(bin: string, installHint: string): void;
export declare function main(argv: string[]): number;
