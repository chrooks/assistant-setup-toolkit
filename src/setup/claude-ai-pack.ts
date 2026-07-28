/**
 * claude.ai skill pack (npm run claude-ai).
 *
 * claude.ai is not an install target — no Assistant Home, no hooks, no rules
 * directory — so this is deliberately NOT an ADR-0002 Preset. What claude.ai
 * accepts is custom skill ZIPs uploaded by hand (Settings → Capabilities →
 * Skills, account-wide across web/iOS/desktop) plus a pasted preferences text
 * capped at 1,500 characters. This module packs the curated subset named in
 * manifests/claude-ai.yaml into artifacts/claude-ai/ together with the
 * paste-ready preferences and an upload checklist.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { discoverSkillDirs } from "./index.js";
import { planSkillArtifacts, createSkillArtifacts } from "./artifacts.js";

/** claude.ai's account-level preferences box caps at 1,500 characters. */
export const CLAUDE_AI_PREFERENCES_CHAR_LIMIT = 1500;

/** The curated claude.ai skill selection from manifests/claude-ai.yaml. */
export interface ClaudeAiManifest {
  readonly skills: readonly string[];
}

/** A discovered skill directory, as returned by discoverSkillDirs. */
export interface PackSkillDir {
  readonly name: string;
  readonly files: readonly string[];
  readonly sourceDir: string;
}

/**
 * Parse and validate the claude.ai manifest. Unknown versions and malformed
 * skill lists fail loudly — a typo must never silently pack nothing.
 */
export function parseClaudeAiManifest(yamlText: string): ClaudeAiManifest {
  let raw: unknown;
  try {
    raw = parseYaml(yamlText);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to parse claude.ai manifest YAML: ${message}`);
  }

  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("claude.ai manifest must be a YAML mapping.");
  }
  const doc = raw as Record<string, unknown>;

  if (doc.version !== 1) {
    throw new Error(
      `Unsupported claude.ai manifest version ${JSON.stringify(doc.version)} — expected 1.`,
    );
  }

  const skills = doc.skills;
  if (!Array.isArray(skills) || skills.length === 0) {
    throw new Error("`skills` must be a non-empty list of skill names.");
  }
  for (const entry of skills) {
    if (typeof entry !== "string" || entry.length === 0) {
      throw new Error(
        `Every skill entry must be a non-empty string — got ${JSON.stringify(entry)}.`,
      );
    }
  }

  return { skills: skills as string[] };
}

/** The wanted skills that exist, in manifest order, plus any that don't. */
export interface PackSelection {
  readonly selected: readonly PackSkillDir[];
  readonly missing: readonly string[];
}

/**
 * Match the manifest's skill names against the discovered skill directories.
 * Missing names are collected, not dropped — a renamed canonical skill must
 * fail the pack, never silently thin it.
 */
export function selectPackSkills(
  available: readonly PackSkillDir[],
  wanted: readonly string[],
): PackSelection {
  const byName = new Map(available.map((dir) => [dir.name, dir]));
  const selected: PackSkillDir[] = [];
  const missing: string[] = [];

  for (const name of wanted) {
    const dir = byName.get(name);
    if (dir === undefined) {
      missing.push(name);
    } else {
      selected.push(dir);
    }
  }

  return { selected, missing };
}

/** Render the UPLOAD.md checklist that ships alongside the ZIPs. */
export function buildUploadChecklist(skillNames: readonly string[]): string {
  const zipList = skillNames.map((name) => `- [ ] ${name}.zip`).join("\n");
  return `# claude.ai upload checklist

Uploads are manual — claude.ai has no sync API for personal accounts. Re-run
\`npm run claude-ai\` after editing a canonical skill and re-upload its ZIP.

## One-time setup

1. Settings → Capabilities: enable code execution and Skills.
2. Settings → Profile: paste PREFERENCES.md into the preferences box
   (1,500-char limit — the pack fails if the source file exceeds it).
3. Create an HQ Project and add \`~/.claude/LEXICON.md\` and
   \`~/.claude/PROFILE.md\` as Project knowledge. Skills that reference those
   files by path degrade gracefully; the knowledge files close the gap.

## Skill ZIPs (Settings → Capabilities → Skills → Upload)

Uploads are account-wide: web, iOS app, and desktop app all see them.

${zipList}

## Known caveats

- deep-research: no firecrawl/exa MCPs on claude.ai — it falls back to native
  web search.
- ingest: needs the Athena connector enabled; it files via the inbox tools
  instead of writing the vault directly.
- visualize/table/diagram/figure: the html variants render as claude.ai
  Artifacts; cross-skill path references (visual-picker.md) don't resolve, so
  Claude picks the form from each skill's own instructions.
`;
}

/**
 * Pack the curated skills + preferences into artifacts/claude-ai/.
 * Returns a process exit code; failures print and fail loudly.
 */
export async function runClaudeAiPack(repoRoot: string): Promise<number> {
  const manifestPath = path.join(repoRoot, "manifests", "claude-ai.yaml");
  const preferencesPath = path.join(
    repoRoot,
    "manifests",
    "claude-ai-preferences.md",
  );

  const manifest = parseClaudeAiManifest(
    await fs.readFile(manifestPath, "utf-8"),
  );

  const preferences = await fs.readFile(preferencesPath, "utf-8");
  const preferencesLength = [...preferences.trim()].length;
  if (preferencesLength > CLAUDE_AI_PREFERENCES_CHAR_LIMIT) {
    console.error(
      `claude-ai-preferences.md is ${preferencesLength} chars — claude.ai caps the preferences box at ${CLAUDE_AI_PREFERENCES_CHAR_LIMIT}. Trim it.`,
    );
    return 1;
  }

  // Machine-scoped skills (machines/<machine>/<skill>) never pack — uploads
  // are account-wide and machine-agnostic by nature.
  const available = (await discoverSkillDirs(repoRoot)).filter(
    (dir) => !dir.name.startsWith("machines/"),
  );
  const { selected, missing } = selectPackSkills(available, manifest.skills);

  if (missing.length > 0) {
    console.error(
      `claude-ai.yaml names skills that don't exist in canonical/skills: ${missing.join(", ")}.`,
    );
    return 1;
  }

  const outDir = path.join(repoRoot, "artifacts", "claude-ai");
  const planned = planSkillArtifacts({
    skillDirs: selected.map((dir) => ({
      name: dir.name,
      files: [...dir.files],
      sourceDir: dir.sourceDir,
    })),
    artifactsDir: outDir,
  });
  const result = await createSkillArtifacts(planned);

  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(path.join(outDir, "PREFERENCES.md"), preferences);
  await fs.writeFile(
    path.join(outDir, "UPLOAD.md"),
    buildUploadChecklist(selected.map((dir) => dir.name)),
  );

  for (const zipPath of result.created) {
    console.log(`  [created] ${path.basename(zipPath)}`);
  }
  for (const err of result.errors) {
    console.error(`  [error] ${err.skillName}: ${err.message}`);
  }
  console.log(
    `Packed ${result.created.length}/${selected.length} skill ZIP(s) + PREFERENCES.md + UPLOAD.md -> ${path.relative(repoRoot, outDir)}/`,
  );

  return result.errors.length > 0 ? 1 : 0;
}
