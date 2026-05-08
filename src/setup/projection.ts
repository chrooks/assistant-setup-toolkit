/**
 * Target Projection generation from the Canonical Assistant Source (canonical/)
 * to Codex Target Projections (.codex/ and .agents/).
 *
 * The projection is planned as data — actual filesystem writes happen
 * in the apply module.
 */

// -- Types --

/** A single planned file mapping from canonical/ source to Codex target. */
export interface ProjectionMapping {
  /** Relative path within canonical/ (e.g. "CLAUDE.md", "skills/commit/SKILL.md") */
  readonly source: string;
  /** Relative path for the Codex target (e.g. ".codex/AGENTS.md", ".agents/skills/commit/SKILL.md") */
  readonly target: string;
  /** Whether this file is a SKILL.md that needs frontmatter sanitization */
  readonly isSkill: boolean;
}

/** Input describing the Canonical Assistant Source structure for projection planning. */
export interface ProjectionInput {
  /** Top-level files in canonical/ to project (e.g. ["CLAUDE.md", "PLAN.md"]) */
  readonly claudeFiles: readonly string[];
  /** Skill directories, each with a name and list of relative file paths */
  readonly skillDirs: readonly SkillDirEntry[];
}

/** A skill directory containing files to project. */
interface SkillDirEntry {
  readonly name: string;
  readonly files: readonly string[];
}

// -- File mapping rules --

/** Maps top-level canonical/ filenames to their .codex/ targets. */
const FILE_MAP: Record<string, string> = {
  "CLAUDE.md": ".codex/AGENTS.md",
  "PLAN.md": ".codex/PLAN.md",
};

// -- Text rewriting --

/**
 * Rewrite text content from Claude conventions to Codex conventions:
 *   .claude -> .codex
 *   CLAUDE.md -> AGENTS.md
 *   claude -> codex
 *   Claude -> Codex
 *
 * For SKILL.md files, also sanitizes frontmatter description/argument-hint
 * fields by ensuring values are quoted.
 */
export function rewriteContentForCodex(
  content: string,
  isSkill: boolean,
): string {
  // Apply text replacements in the same order as the shell script
  let result = content
    .replace(/\.claude/g, ".codex")
    .replace(/CLAUDE\.md/g, "AGENTS.md")
    .replace(/claude/g, "codex")
    .replace(/Claude/g, "Codex");

  // Sanitize SKILL.md frontmatter if needed
  if (isSkill) {
    result = sanitizeSkillFrontmatter(result);
  }

  return result;
}

/**
 * Ensure description and argument-hint values in YAML frontmatter are quoted.
 */
function sanitizeSkillFrontmatter(content: string): string {
  const lines = content.split("\n");
  let inFrontmatter = false;
  let delimiterCount = 0;

  return lines
    .map((line) => {
      // Track frontmatter delimiters
      if (/^---\s*$/.test(line)) {
        delimiterCount++;
        if (delimiterCount === 1) inFrontmatter = true;
        if (delimiterCount === 2) inFrontmatter = false;
        return line;
      }

      // Only process lines inside frontmatter
      if (!inFrontmatter) return line;

      // Check for description or argument-hint fields
      const match = line.match(/^(description|argument-hint):\s*(.*)/);
      if (!match) return line;

      const key = match[1];
      const value = match[2];

      // Already quoted — leave alone
      if (/^\s*["']/.test(value)) return line;

      // Quote the value, escaping backslashes and double quotes
      const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      return `${key}: "${escaped}"`;
    })
    .join("\n");
}

// -- Projection planning --

/**
 * Plan the Codex Target Projection mappings from canonical/ source files.
 * Returns an array of source→target mappings without touching the filesystem.
 *
 * Commands and hooks are not projected — they have no Codex equivalent.
 * Only files explicitly passed in claudeFiles and skillDirs are mapped.
 */
export function planCodexProjection(
  input: ProjectionInput,
): readonly ProjectionMapping[] {
  const mappings: ProjectionMapping[] = [];

  // Map known top-level files (CLAUDE.md, PLAN.md)
  for (const file of input.claudeFiles) {
    const target = FILE_MAP[file];
    if (target) {
      mappings.push({
        source: file,
        target,
        isSkill: false,
      });
    }
  }

  // Map skill directories to .agents/skills/
  for (const skillDir of input.skillDirs) {
    for (const file of skillDir.files) {
      mappings.push({
        source: `skills/${skillDir.name}/${file}`,
        target: `.agents/skills/${skillDir.name}/${file}`,
        isSkill: file === "SKILL.md",
      });
    }
  }

  return mappings;
}
