// Collects every skill installed on this machine into one Repertoire for the
// skills page (`npm run skills`). Slice 1 reads ~/.claude/skills/*/SKILL.md;
// plugins, desktop skills, and the curated skill map arrive in later slices.
import { promises as fs } from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
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
export interface Lane { name: string; stages: string[] }
export interface Neighbor { a: string; b: string; difference: string }
export interface Repertoire {
  machine: string;
  generatedAt: string;
  skills: SkillEntry[];
  unreadable: Unreadable[];
  categories: string[];
  lanes: Lane[];
  neighbors: Neighbor[];
  counts: { total: number; own: number; pulled: number; plugin: number; desktop: number };
}

export interface ParsedSkillFile {
  frontmatter: Record<string, unknown>;
  body: string;
}

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

/** Parse a SKILL.md into its YAML frontmatter and Markdown body. Throws on a missing or invalid frontmatter block. */
export async function parseSkillFile(file: string): Promise<ParsedSkillFile> {
  const text = await fs.readFile(file, "utf8");
  const match = FRONTMATTER.exec(text);
  if (!match) throw new Error("no frontmatter block between --- lines");
  const frontmatter: unknown = parseYaml(match[1]!);
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

export async function collectRepertoire(opts: {
  claudeHome: string;
  toolkitRoot: string;
  machine: string;
  now: Date;
}): Promise<Repertoire> {
  // Ownership reuses the Setup Wizard's own walk of canonical/ so the two cannot drift.
  const ownNames = new Set(
    (await discoverSkillDirs(opts.toolkitRoot)).map((dir) => dir.name.split("/").pop()!),
  );
  const skillsDir = path.join(opts.claudeHome, "skills");
  const entries = await fs.readdir(skillsDir, { withFileTypes: true }).catch(() => []);
  const skills: SkillEntry[] = [];
  const unreadable: Unreadable[] = [];

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
    const file = path.join(skillsDir, entry.name, "SKILL.md");
    // One-level glob: folders without a top-level SKILL.md (synced/, generated/) are not skills.
    if (!(await fs.stat(file).then((s) => s.isFile(), () => false))) continue;
    try {
      const { frontmatter, body } = await parseSkillFile(file);
      const name = text(frontmatter.name) ?? entry.name;
      const description = (text(frontmatter.description) ?? "").trim();
      skills.push({
        name,
        description,
        firesWhen: firesWhen(description),
        argumentHint: text(frontmatter["argument-hint"]),
        mode: modeFromFrontmatter(frontmatter),
        source: ownNames.has(entry.name) ? "own" : "pulled",
        origin: null,
        category: "Uncategorized",
        uncategorized: true,
        path: file,
        body,
      });
    } catch (error) {
      unreadable.push({ name: entry.name, path: file, error: error instanceof Error ? error.message : String(error) });
    }
  }

  const count = (source: Source) => skills.filter((s) => s.source === source).length;
  return {
    machine: opts.machine,
    generatedAt: opts.now.toISOString(),
    skills,
    unreadable,
    categories: [],
    lanes: [],
    neighbors: [],
    counts: {
      total: skills.length + unreadable.length,
      own: count("own"),
      pulled: count("pulled"),
      plugin: count("plugin"),
      desktop: count("desktop"),
    },
  };
}
