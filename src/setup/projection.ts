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
  /** Relative path within canonical/ (e.g. "CLAUDE.md", "skills/commit/SKILL.md", "hooks/lexicon-reminder.sh") */
  readonly source: string;
  /** Relative path for the Codex target (e.g. ".codex/AGENTS.md", ".agents/skills/commit/SKILL.md", ".codex/hooks/lexicon-reminder.sh") */
  readonly target: string;
  /** Whether this file is a SKILL.md that needs frontmatter sanitization */
  readonly isSkill: boolean;
  /**
   * Whether this file is a hook script. Hook scripts are copied verbatim —
   * the Claude→Codex text rewrites (e.g. ".claude"→".codex") are skipped to
   * avoid mangling shell logic that may legitimately reference either path.
   */
  readonly isHook: boolean;
  /**
   * Whether this file is a config file (e.g. knowledge-config.example.json).
   * Config files are copied verbatim — they are JSON/env data, not prose, so
   * the Claude→Codex text rewrites are skipped. They also flatten to the home
   * root rather than a config/ subdirectory.
   */
  readonly isConfig: boolean;
}

/** Input describing the Canonical Assistant Source structure for projection planning. */
export interface ProjectionInput {
  /** Top-level files in canonical/ to project (e.g. ["CLAUDE.md", "PLAN.md"]) */
  readonly claudeFiles: readonly string[];
  /** Skill directories, each with a name and list of relative file paths */
  readonly skillDirs: readonly SkillDirEntry[];
  /** Hook script filenames under canonical/hooks/ to project (e.g. ["lexicon-reminder.sh"]) */
  readonly hookFiles?: readonly string[];
  /** Rule file paths under canonical/rules/ to project (e.g. ["common/coding-style.md", "python/database.md"]) */
  readonly ruleFiles?: readonly string[];
  /** Config filenames under canonical/config/ to project (e.g. ["knowledge-config.example.json"]) */
  readonly configFiles?: readonly string[];
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
  "CONTEXT.md": ".codex/CONTEXT.md",
};

// -- Text rewriting --

/**
 * Rewrite text content from Claude conventions to Codex conventions.
 *
 * Compound product-name forms must run BEFORE generic Claude→Codex so that
 * "Claude Code" maps to "Codex CLI" (the actual product name) rather than
 * the meaningless "Codex Code".
 *
 * Order:
 *   "Claude Code"   -> "Codex CLI"
 *   "claude code"   -> "codex cli"
 *   "Claude-Code"   -> "Codex-CLI"
 *   "claude-code"   -> "codex-cli"
 *   ".claude"       -> ".codex"
 *   "CLAUDE.md"     -> "AGENTS.md"
 *   "claude"        -> "codex"
 *   "Claude"        -> "Codex"
 *
 * For SKILL.md files, also sanitizes frontmatter description/argument-hint
 * fields by ensuring values are quoted.
 */
export function rewriteContentForCodex(
  content: string,
  isSkill: boolean,
): string {
  let result = content
    .replace(/Claude Code/g, "Codex CLI")
    .replace(/claude code/g, "codex cli")
    .replace(/Claude-Code/g, "Codex-CLI")
    .replace(/claude-code/g, "codex-cli")
    .replace(/\.claude/g, ".codex")
    .replace(/CLAUDE\.md/g, "AGENTS.md")
    .replace(/claude/g, "codex")
    .replace(/Claude/g, "Codex");

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
 * Commands are not projected — Codex has no equivalent surface for them.
 * Hooks ARE now projected (Codex CLI ships a hooks system at ~/.codex/hooks.json
 * with the same major events as Claude Code). Hook scripts are mapped 1:1 from
 * canonical/hooks/<name> to .codex/hooks/<name> and are flagged isHook=true so
 * the writer skips Claude→Codex text rewrites.
 *
 * Only files explicitly passed in claudeFiles, skillDirs, and hookFiles are mapped.
 */
export function planCodexProjection(
  input: ProjectionInput,
): readonly ProjectionMapping[] {
  const mappings: ProjectionMapping[] = [];

  // Map known top-level files (CLAUDE.md, PLAN.md, CONTEXT.md)
  for (const file of input.claudeFiles) {
    const target = FILE_MAP[file];
    if (target) {
      mappings.push({
        source: file,
        target,
        isSkill: false,
        isHook: false,
        isConfig: false,
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
        isHook: false,
        isConfig: false,
      });
    }
  }

  // Map hook scripts to .codex/hooks/ (1:1, no path rewrites)
  for (const hookFile of input.hookFiles ?? []) {
    mappings.push({
      source: `hooks/${hookFile}`,
      target: `.codex/hooks/${hookFile}`,
      isSkill: false,
      isHook: true,
      isConfig: false,
    });
  }

  // Map rule files to .codex/rules/. Left as markdown (isHook/isSkill false) so the
  // Claude→Codex text rewrite fixes @import paths (~/.claude/rules → ~/.codex/rules).
  for (const ruleFile of input.ruleFiles ?? []) {
    mappings.push({
      source: `rules/${ruleFile}`,
      target: `.codex/rules/${ruleFile}`,
      isSkill: false,
      isHook: false,
      isConfig: false,
    });
  }

  // Map config files to the .codex/ ROOT (flattened, no config/ segment) and
  // copy verbatim — consumers read e.g. ~/.codex/knowledge-config.json, and the
  // JSON/env payload must not be mangled by the Claude→Codex text rewrite.
  for (const configFile of input.configFiles ?? []) {
    mappings.push({
      source: `config/${configFile}`,
      target: `.codex/${configFile}`,
      isSkill: false,
      isHook: false,
      isConfig: true,
    });
  }

  return mappings;
}
