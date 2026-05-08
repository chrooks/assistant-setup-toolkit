/**
 * External Source fetcher.
 *
 * Clones GitHub repositories listed in the Installation Manifest into a
 * per-run working directory, then maps the cloned files into PayloadFile
 * entries the rest of the pipeline can consume.
 *
 * Network access happens only through the injected `runGit` seam so tests
 * can simulate clones without touching the real network or git binary.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import fs from "node:fs/promises";
import type { ExternalSource } from "./manifest.js";
import type { PayloadFile, ComponentKind } from "./domain.js";

const execFileAsync = promisify(execFile);

// -- Types --

/** Parsed pieces of a GitHub repository URL. */
export interface ParsedGitHubUrl {
  readonly owner: string;
  readonly repo: string;
  /** Branch or tag the URL pinned, if any. */
  readonly ref?: string;
  /** Subpath inside the repo when the URL is a /tree/<ref>/<subpath> link. */
  readonly subpath?: string;
}

/** Function signature for the git seam — exec git in cwd, return stdout. */
export type RunGit = (
  args: readonly string[],
  cwd: string,
) => Promise<{ stdout: string; stderr: string }>;

/** Result of fetching a single External Source. */
export interface FetchSourceResult {
  readonly sourceId: string;
  readonly files: readonly PayloadFile[];
  readonly error?: string;
}

/** Aggregate result for all planned fetches. */
export interface FetchPlannedResult {
  readonly files: readonly PayloadFile[];
  readonly results: readonly FetchSourceResult[];
}

// -- Public helpers --

/**
 * Parse a GitHub URL into owner/repo plus optional ref + subpath.
 * Supports:
 *   https://github.com/<owner>/<repo>
 *   https://github.com/<owner>/<repo>.git
 *   https://github.com/<owner>/<repo>/tree/<ref>
 *   https://github.com/<owner>/<repo>/tree/<ref>/<subpath...>
 */
export function parseGitHubUrl(url: string): ParsedGitHubUrl {
  // Strip protocol and any trailing slash for easier splitting.
  const u = new URL(url);
  if (u.hostname !== "github.com") {
    throw new Error(`Unsupported host for External Source URL: ${u.hostname}`);
  }
  // Trim leading slash, strip optional .git suffix on repo segment.
  const segments = u.pathname.replace(/^\/+/, "").replace(/\/+$/, "").split("/");
  if (segments.length < 2) {
    throw new Error(`Cannot parse owner/repo from URL: ${url}`);
  }
  const owner = segments[0];
  const repo = segments[1].replace(/\.git$/, "");

  // No /tree/ part — root of default branch.
  if (segments.length === 2) {
    return { owner, repo };
  }

  // Recognise /tree/<ref>[/<subpath...>]
  if (segments[2] === "tree" && segments.length >= 4) {
    const ref = segments[3];
    const subpath = segments.length > 4 ? segments.slice(4).join("/") : undefined;
    return { owner, repo, ref, subpath };
  }

  // Fallback — treat as repo root if structure unrecognised.
  return { owner, repo };
}

/** Default real-git seam used in production runs. */
export const defaultRunGit: RunGit = async (args, cwd) => {
  return execFileAsync("git", [...args], {
    cwd,
    timeout: 120_000,
    maxBuffer: 50 * 1024 * 1024,
  });
};

// -- Fetch a single source --

/**
 * Clone an External Source into `workDir/<id>` and map its files to
 * PayloadFile entries based on the source's `kind`.
 */
export async function fetchExternalSource(
  source: ExternalSource,
  workDir: string,
  runGit: RunGit = defaultRunGit,
): Promise<FetchSourceResult> {
  let parsed: ParsedGitHubUrl;
  try {
    parsed = parseGitHubUrl(source.url);
  } catch (err: unknown) {
    return {
      sourceId: source.id,
      files: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }

  const cloneDir = path.join(workDir, source.id);
  // Ensure parent exists so `git clone` can write into it.
  await fs.mkdir(workDir, { recursive: true });

  // Build clone command: shallow clone of the repo root, optionally pinned to a ref.
  const cloneUrl = `https://github.com/${parsed.owner}/${parsed.repo}.git`;
  const cloneArgs = ["clone", "--depth", "1"];
  if (parsed.ref) {
    cloneArgs.push("--branch", parsed.ref);
  }
  cloneArgs.push(cloneUrl, cloneDir);

  try {
    await runGit(cloneArgs, workDir);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { sourceId: source.id, files: [], error: `git clone failed: ${message}` };
  }

  // The directory we map files from — drop into subpath when one was specified.
  const mappingRoot = parsed.subpath
    ? path.join(cloneDir, parsed.subpath)
    : cloneDir;

  try {
    const files = await mapSourceFiles(source, mappingRoot, parsed);
    return { sourceId: source.id, files };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { sourceId: source.id, files: [], error: message };
  }
}

/**
 * Run the planned fetches sequentially. Errors on individual sources are
 * captured per-source so one bad URL does not abort the whole run.
 */
export async function fetchPlannedSources(
  sources: readonly ExternalSource[],
  workDir: string,
  runGit: RunGit = defaultRunGit,
): Promise<FetchPlannedResult> {
  const results: FetchSourceResult[] = [];
  const allFiles: PayloadFile[] = [];

  for (const source of sources) {
    const result = await fetchExternalSource(source, workDir, runGit);
    results.push(result);
    allFiles.push(...result.files);
  }

  return { files: allFiles, results };
}

// -- Internals: per-kind layout mapping --

/** Dispatch on `kind` to map cloned files into PayloadFile entries. */
async function mapSourceFiles(
  source: ExternalSource,
  rootDir: string,
  parsed: ParsedGitHubUrl,
): Promise<PayloadFile[]> {
  switch (source.kind) {
    case "skill":
    case "skill-or-plugin":
      return mapSingleSkill(source, rootDir, parsed);
    case "skill-pack":
      return mapSkillPack(source, rootDir);
    case "plugin":
      return mapPlugin(source, rootDir);
    case "mcp-server":
      // Should never reach here — planExternalFetches filters MCP out — defensive.
      return [];
  }
}

/**
 * `skill` / `skill-or-plugin`: a single skill living at the URL's subpath
 * (or repo root when no subpath was specified).
 *
 * If the directory doesn't directly contain a SKILL.md, we look one level
 * deep for a single child dir that does — handles repos that wrap their
 * skill content in an extra folder.
 */
async function mapSingleSkill(
  source: ExternalSource,
  rootDir: string,
  _parsed: ParsedGitHubUrl,
): Promise<PayloadFile[]> {
  const skillDir = await findSkillDir(rootDir);
  if (!skillDir) {
    throw new Error(
      `External Source ${source.id} did not contain a SKILL.md (looked under ${rootDir})`,
    );
  }
  // Use source.id as the destination skill name to keep IDs stable.
  return walkAsPayload(skillDir, `skills/${source.id}`, "skills", "external-source");
}

/**
 * `skill-pack`: a repo containing many skills as top-level dirs (each with
 * its own SKILL.md), or grouped under a `skills/` parent directory.
 */
async function mapSkillPack(
  source: ExternalSource,
  rootDir: string,
): Promise<PayloadFile[]> {
  const candidateRoots: string[] = [rootDir];
  // If the repo has a top-level `skills/` dir, also look inside it.
  try {
    const topSkillsDir = path.join(rootDir, "skills");
    const stat = await fs.stat(topSkillsDir);
    if (stat.isDirectory()) candidateRoots.push(topSkillsDir);
  } catch {
    // No skills/ subdir — fine.
  }

  const out: PayloadFile[] = [];
  const seen = new Set<string>();

  for (const root of candidateRoots) {
    const entries = await fs.readdir(root, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      // Skip dotfiles and obvious non-skill folders.
      if (entry.name.startsWith(".")) continue;
      if (entry.name === "node_modules") continue;
      if (entry.name === "skills") continue; // handled by candidateRoots

      const dirPath = path.join(root, entry.name);
      // For nested layouts, walk one level deeper too: skills/<group>/<skill>
      const skillDirs = await collectSkillDirs(dirPath, 2);
      for (const skillDir of skillDirs) {
        const skillName = path.basename(skillDir);
        if (seen.has(skillName)) continue;
        seen.add(skillName);
        const files = await walkAsPayload(
          skillDir,
          `skills/${skillName}`,
          "skills",
          "external-source",
        );
        out.push(...files);
      }
    }
  }

  if (out.length === 0) {
    throw new Error(
      `Skill pack ${source.id} contained no skills (no SKILL.md files found under ${rootDir})`,
    );
  }
  return out;
}

/**
 * `plugin`: a repo that may contain skills/, commands/, agents/, hooks/, rules/.
 * Files outside known component dirs are ignored.
 */
async function mapPlugin(
  source: ExternalSource,
  rootDir: string,
): Promise<PayloadFile[]> {
  // Map the on-disk dir name to (component kind, destination path prefix).
  const componentDirs: Array<{
    dir: string;
    component: ComponentKind;
    destPrefix: string;
  }> = [
    { dir: "skills", component: "skills", destPrefix: "skills" },
    { dir: "commands", component: "commands", destPrefix: "commands" },
    { dir: "hooks", component: "hooks", destPrefix: "hooks" },
    { dir: "agents", component: "skills", destPrefix: "agents" },
    { dir: "rules", component: "instructions", destPrefix: "rules" },
  ];

  const out: PayloadFile[] = [];
  for (const c of componentDirs) {
    const fromDir = path.join(rootDir, c.dir);
    try {
      const stat = await fs.stat(fromDir);
      if (!stat.isDirectory()) continue;
    } catch {
      continue;
    }
    const files = await walkAsPayload(
      fromDir,
      c.destPrefix,
      c.component,
      "external-source",
    );
    out.push(...files);
  }

  if (out.length === 0) {
    throw new Error(
      `Plugin ${source.id} had no recognised component dirs (skills/commands/hooks/agents/rules) under ${rootDir}`,
    );
  }
  return out;
}

// -- Filesystem walkers --

/**
 * Find a directory that directly contains SKILL.md, starting at `start`.
 * Falls back to a single child directory when the root has no SKILL.md
 * but exactly one subdir does.
 */
async function findSkillDir(start: string): Promise<string | null> {
  // Direct hit at the root.
  if (await fileExists(path.join(start, "SKILL.md"))) {
    return start;
  }
  // Look one level deeper for a single subdir with SKILL.md.
  let entries;
  try {
    entries = await fs.readdir(start, { withFileTypes: true });
  } catch {
    return null;
  }
  const subdirs = entries.filter((e) => e.isDirectory() && !e.name.startsWith("."));
  for (const sub of subdirs) {
    const subPath = path.join(start, sub.name);
    if (await fileExists(path.join(subPath, "SKILL.md"))) {
      return subPath;
    }
  }
  return null;
}

/**
 * Collect directories under `start` (up to `maxDepth` levels deep) that
 * directly contain a SKILL.md. Used by skill-pack mapping.
 */
async function collectSkillDirs(start: string, maxDepth: number): Promise<string[]> {
  const found: string[] = [];
  async function walk(dir: string, depth: number): Promise<void> {
    // Direct hit — record and stop descending this branch.
    if (await fileExists(path.join(dir, "SKILL.md"))) {
      found.push(dir);
      return;
    }
    if (depth >= maxDepth) return;
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith(".")) continue;
      if (entry.name === "node_modules") continue;
      await walk(path.join(dir, entry.name), depth + 1);
    }
  }
  await walk(start, 0);
  return found;
}

/**
 * Walk `fromDir` recursively, returning a PayloadFile per regular file.
 * `relativePath` is rooted at `destPrefix` so different sources can land
 * in their own subtree of the Assistant Home.
 */
async function walkAsPayload(
  fromDir: string,
  destPrefix: string,
  component: ComponentKind,
  origin: PayloadFile["origin"],
): Promise<PayloadFile[]> {
  const out: PayloadFile[] = [];
  async function walk(currentDir: string): Promise<void> {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(currentDir, entry.name);
      // Skip git metadata + node_modules; they're not part of the payload.
      if (entry.name === ".git" || entry.name === "node_modules") continue;
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile()) {
        const rel = path.relative(fromDir, full);
        const stat = await fs.stat(full);
        out.push({
          relativePath: path.join(destPrefix, rel),
          sourcePath: full,
          component,
          origin,
          executable: (stat.mode & 0o100) !== 0,
        });
      }
    }
  }
  await walk(fromDir);
  return out;
}

/** Quick existence probe; returns false on any error. */
async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}
