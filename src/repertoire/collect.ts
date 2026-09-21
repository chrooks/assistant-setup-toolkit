// Collects every skill available on this machine into one Repertoire for the
// skills page (`npm run skills`): ~/.claude/skills/*/SKILL.md, the skills of
// enabled plugins, and desktop-app skills synced under skills/synced/. The
// curated skill map (manifests/skill-map.yaml) adds categories, lanes, and
// neighbor pairs.
import { promises as fs, readFileSync } from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import { discoverSkillDirs } from "../setup/index.js";

export type Mode = "auto" | "typed-only" | "claude-only";
export type Source = "own" | "pulled" | "plugin" | "desktop";

export interface SkillEntry {
  name: string;
  description: string;
  firesWhen: string;
  argumentHint: string | null;
  mode: Mode;
  source: Source;
  origin: string | null; // plugin id or "desktop app"
  category: string;
  uncategorized: boolean;
  path: string;
  body: string;
}
export interface Unreadable { name: string; path: string; error: string }
/** An unreadable copy of a skill that is listed from another, readable copy (`listed`). */
export interface UnreadableCopy extends Unreadable { listed: string }
export interface Lane { name: string; stages: string[] }
export interface Neighbor { a: string; b: string; difference: string }
export interface Repertoire {
  machine: string;
  generatedAt: string;
  skills: SkillEntry[];
  unreadable: Unreadable[];
  unreadableCopies: UnreadableCopy[];
  categories: string[];
  lanes: Lane[];
  neighbors: Neighbor[];
  counts: { total: number; own: number; pulled: number; plugin: number; desktop: number };
}

const skillMapSchema = z
  .object({
    categories: z.record(z.string(), z.array(z.string())).default({}),
    lanes: z.array(z.object({ name: z.string(), stages: z.array(z.string()) })).default([]),
    neighbors: z.array(z.object({ a: z.string(), b: z.string(), difference: z.string() })).default([]),
  })
  .superRefine((map, ctx) => {
    const seen = new Map<string, string>();
    for (const [category, names] of Object.entries(map.categories)) {
      for (const name of names) {
        const first = seen.get(name);
        if (first !== undefined) {
          ctx.addIssue({ code: "custom", path: ["categories", category], message: `${name} is in more than one category (${first}, ${category})` });
        }
        seen.set(name, category);
      }
    }
  });
export type SkillMap = z.infer<typeof skillMapSchema>;

export const UNCATEGORIZED = "Uncategorized";

/** Read and validate the curated skill map. Throws with the file path and each bad field. */
export function loadSkillMap(file: string): SkillMap {
  let raw: unknown;
  try {
    raw = parseYaml(readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(`${file}: ${error instanceof Error ? error.message : String(error)}`);
  }
  const result = skillMapSchema.safeParse(raw ?? {});
  if (!result.success) {
    const issues = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
    throw new Error(`${file} is not a valid skill map:\n  ${issues.join("\n  ")}`);
  }
  return result.data;
}

export interface ParsedSkillFile {
  frontmatter: Record<string, unknown>;
  body: string;
}

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

// A top-level `key: value` line whose plain (unquoted, not flow, not block) value holds ": ".
const PLAIN_VALUE_WITH_COLON = /^([A-Za-z][\w-]*):[ \t]+([^\s"'[{|>&*!%@`#][^\n]*: [^\n]*)$/gm;

/**
 * Strict YAML first. Some installed skills write `description: … wiki: a summary …`,
 * which strict YAML rejects but Claude Code still loads; retry once with those
 * one-line values quoted. Anything still invalid stays unreadable.
 */
function parseFrontmatterYaml(yaml: string): unknown {
  try {
    return parseYaml(yaml);
  } catch (error) {
    const quoted = yaml.replace(PLAIN_VALUE_WITH_COLON, (_line, key: string, value: string) => `${key}: ${JSON.stringify(value.trimEnd())}`);
    if (quoted === yaml) throw error;
    try {
      return parseYaml(quoted);
    } catch {
      throw error;
    }
  }
}

/** Parse a SKILL.md into its YAML frontmatter and Markdown body. Throws on a missing or invalid frontmatter block. */
export async function parseSkillFile(file: string): Promise<ParsedSkillFile> {
  const text = await fs.readFile(file, "utf8");
  const match = FRONTMATTER.exec(text);
  if (!match) throw new Error("no frontmatter block between --- lines");
  const frontmatter: unknown = parseFrontmatterYaml(match[1]!);
  if (frontmatter === null || typeof frontmatter !== "object" || Array.isArray(frontmatter)) {
    throw new Error("frontmatter is not a YAML mapping");
  }
  return { frontmatter: frontmatter as Record<string, unknown>, body: text.slice(match[0].length) };
}

/** typed only = disable-model-invocation: true; Claude only = user-invocable: false; otherwise auto. */
export function modeFromFrontmatter(frontmatter: Record<string, unknown>): Mode {
  if (frontmatter["disable-model-invocation"] === true) return "typed-only";
  if (frontmatter["user-invocable"] === false) return "claude-only";
  return "auto";
}

const USE_WHEN = /\bUse (?:this (?:skill )?)?when\b[\s\S]*?(?:\.(?=\s|$)|$)/i;

/** The description's "Use when" sentence, or the whole description when it has none. */
export function firesWhen(description: string): string {
  return (USE_WHEN.exec(description)?.[0] ?? description).replace(/\s+/g, " ").trim();
}

const text = (value: unknown): string | null => (typeof value === "string" ? value : null);

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));
const isFile = (file: string) => fs.stat(file).then((s) => s.isFile(), () => false);
const subdirs = async (dir: string) =>
  (await fs.readdir(dir, { withFileTypes: true }).catch(() => []))
    .filter((e) => e.isDirectory() || e.isSymbolicLink())
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b));
const readJson = async (file: string): Promise<Record<string, unknown>> => {
  try {
    const value: unknown = JSON.parse(await fs.readFile(file, "utf8"));
    return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : {};
  } catch {
    return {}; // Missing or unreadable: this machine has no plugins to list.
  }
};

interface Candidate { dir: string; folder: string; source: Source; origin: string | null }

/** Skill folders of every plugin enabled in settings.json, from every install record's installPath. */
async function pluginCandidates(claudeHome: string): Promise<Candidate[]> {
  const enabled = (await readJson(path.join(claudeHome, "settings.json"))).enabledPlugins;
  const pluginsDir = path.join(claudeHome, "plugins");
  const installed = (await readJson(path.join(pluginsDir, "installed_plugins.json"))).plugins;
  if (!enabled || typeof enabled !== "object" || !installed || typeof installed !== "object") return [];
  const out: Candidate[] = [];
  for (const id of Object.keys(enabled).sort()) {
    if ((enabled as Record<string, unknown>)[id] !== true) continue;
    const records = (installed as Record<string, unknown>)[id];
    for (const record of Array.isArray(records) ? records : []) {
      const installPath = (record as { installPath?: unknown } | null)?.installPath;
      if (typeof installPath !== "string") continue;
      const skillsDir = path.join(path.resolve(pluginsDir, installPath), "skills");
      for (const folder of await subdirs(skillsDir)) {
        out.push({ dir: path.join(skillsDir, folder), folder, source: "plugin", origin: id });
      }
    }
  }
  return out;
}

export async function collectRepertoire(opts: {
  claudeHome: string;
  toolkitRoot: string;
  skillMap: SkillMap;
  machine: string;
  now: Date;
}): Promise<Repertoire> {
  // Ownership reuses the Setup Wizard's own walk of canonical/ so the two cannot drift.
  const ownNames = new Set(
    (await discoverSkillDirs(opts.toolkitRoot)).map((dir) => dir.name.split("/").pop()!),
  );
  const skillsDir = path.join(opts.claudeHome, "skills");
  const syncedDir = path.join(skillsDir, "synced");

  // Priority order for duplicates: skills/ first, then enabled plugins, then desktop.
  // The one-level skills/*/SKILL.md glob skips synced/ and generated/ (no top-level SKILL.md).
  const candidates: Candidate[] = [
    ...(await subdirs(skillsDir)).map((folder): Candidate => ({
      dir: path.join(skillsDir, folder), folder, source: ownNames.has(folder) ? "own" : "pulled", origin: null,
    })),
    ...(await pluginCandidates(opts.claudeHome)),
  ];
  for (const id of await subdirs(syncedDir)) {
    for (const folder of await subdirs(path.join(syncedDir, id))) {
      candidates.push({ dir: path.join(syncedDir, id, folder), folder, source: "desktop", origin: "desktop app" });
    }
  }

  const categoryOf = new Map<string, { category: string; position: number }>();
  let position = 0;
  for (const [category, names] of Object.entries(opts.skillMap.categories)) {
    for (const name of names) categoryOf.set(name, { category, position: position++ });
  }

  const skills: SkillEntry[] = [];
  const failed: Unreadable[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    const file = path.join(candidate.dir, "SKILL.md");
    if (!(await isFile(file))) continue;
    try {
      const { frontmatter, body } = await parseSkillFile(file);
      const name = text(frontmatter.name) ?? candidate.folder;
      if (seen.has(name)) continue;
      seen.add(name);
      const description = (text(frontmatter.description) ?? "").trim();
      const mapped = categoryOf.get(name);
      skills.push({
        name,
        description,
        firesWhen: firesWhen(description),
        argumentHint: text(frontmatter["argument-hint"]),
        mode: modeFromFrontmatter(frontmatter),
        source: candidate.source,
        origin: candidate.origin,
        category: mapped?.category ?? UNCATEGORIZED,
        uncategorized: !mapped,
        path: file,
        body,
      });
    } catch (error) {
      // A later readable copy (plugin or desktop) of the same name still gets listed.
      failed.push({ name: candidate.folder, path: file, error: errorText(error) });
    }
  }
  const listedPath = new Map(skills.map((s) => [s.name, s.path]));
  const unreadable: Unreadable[] = [];
  const unreadableCopies: UnreadableCopy[] = [];
  for (const entry of failed) {
    const listed = listedPath.get(entry.name);
    if (listed !== undefined) unreadableCopies.push({ ...entry, listed });
    else if (!unreadable.some((u) => u.name === entry.name)) unreadable.push(entry);
  }

  // Map order within categories; Uncategorized last, alphabetical.
  const rank = (s: SkillEntry) => categoryOf.get(s.name)?.position ?? Number.MAX_SAFE_INTEGER;
  skills.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));

  // Names in the map that are not installed here are skipped without error.
  const installed = new Set(skills.map((s) => s.name));
  const categories = [...new Set(skills.map((s) => s.category))];
  const lanes = opts.skillMap.lanes
    .map((lane) => ({ name: lane.name, stages: lane.stages.filter((stage) => installed.has(stage)) }))
    .filter((lane) => lane.stages.length > 0);
  const neighbors = opts.skillMap.neighbors.filter((n) => installed.has(n.a) && installed.has(n.b));

  const count = (source: Source) => skills.filter((s) => s.source === source).length;
  return {
    machine: opts.machine,
    generatedAt: opts.now.toISOString(),
    skills,
    unreadable,
    unreadableCopies,
    categories,
    lanes,
    neighbors,
    counts: {
      total: skills.length + unreadable.length,
      own: count("own"),
      pulled: count("pulled"),
      plugin: count("plugin"),
      desktop: count("desktop"),
    },
  };
}
