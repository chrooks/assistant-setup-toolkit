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
import os from "node:os";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { discoverSkillDirs } from "./index.js";
import { planSkillArtifacts, createSkillArtifacts } from "./artifacts.js";
import { loadInstallationManifest } from "./manifest.js";
import { fetchPlannedSources } from "./external-fetcher.js";
import type { PayloadFile } from "./domain.js";

/** claude.ai's account-level preferences box caps at 1,500 characters. */
export const CLAUDE_AI_PREFERENCES_CHAR_LIMIT = 1500;

/** The curated claude.ai skill selection from manifests/claude-ai.yaml. */
export interface ClaudeAiManifest {
  readonly skills: readonly string[];
  /** Skills packed from install.yaml's External Sources, not canonical/. */
  readonly externalSkills: readonly string[];
  /** Connectors enabled on the claude.ai account, name → one-line gloss. */
  readonly connectors: Readonly<Record<string, string>>;
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

  const externalRaw = doc.externalSkills ?? [];
  if (!Array.isArray(externalRaw)) {
    throw new Error("`externalSkills` must be a list of skill names.");
  }
  for (const entry of externalRaw) {
    if (typeof entry !== "string" || entry.length === 0) {
      throw new Error(
        `Every external skill entry must be a non-empty string — got ${JSON.stringify(entry)}.`,
      );
    }
  }
  const overlap = (externalRaw as string[]).filter((name) =>
    (skills as string[]).includes(name),
  );
  if (overlap.length > 0) {
    throw new Error(
      `Skills listed in both \`skills\` and \`externalSkills\`: ${overlap.join(", ")} — pick one home each.`,
    );
  }

  const connectorsRaw = doc.connectors ?? {};
  if (
    connectorsRaw === null ||
    typeof connectorsRaw !== "object" ||
    Array.isArray(connectorsRaw)
  ) {
    throw new Error("`connectors` must be a mapping of name to gloss.");
  }
  const connectors: Record<string, string> = {};
  for (const [name, gloss] of Object.entries(
    connectorsRaw as Record<string, unknown>,
  )) {
    if (typeof gloss !== "string" || gloss.length === 0) {
      throw new Error(
        `Connector "${name}" must map to a non-empty gloss string.`,
      );
    }
    connectors[name] = gloss;
  }

  return {
    skills: skills as string[],
    externalSkills: externalRaw as string[],
    connectors,
  };
}

/**
 * Regroup fetched skill-component PayloadFiles (relativePath
 * `skills/<name>/<rest>`) into per-skill directories the artifact planner
 * understands. `sourceDir` is derived by stripping `<rest>` from each file's
 * absolute sourcePath, so it points into the clone.
 */
export function groupExternalSkillDirs(
  files: readonly PayloadFile[],
): PackSkillDir[] {
  const byName = new Map<string, { files: string[]; sourceDir: string }>();

  for (const file of files) {
    if (file.component !== "skills") continue;
    const parts = file.relativePath.split("/");
    if (parts[0] !== "skills" || parts.length < 3) continue;
    const name = parts[1];
    const rest = parts.slice(2).join("/");
    const sourceDir = file.sourcePath.slice(
      0,
      file.sourcePath.length - rest.length - 1,
    );

    const existing = byName.get(name);
    if (existing === undefined) {
      byName.set(name, { files: [rest], sourceDir });
    } else {
      existing.files.push(rest);
    }
  }

  return [...byName.entries()].map(([name, dir]) => ({
    name,
    files: dir.files.sort(),
    sourceDir: dir.sourceDir,
  }));
}

/** Longest gloss the toolbox renders before truncating with an ellipsis. */
const TOOLBOX_GLOSS_MAX_CHARS = 160;

/**
 * Distill a skill's frontmatter `description:` into a one-line toolbox gloss:
 * the first sentence, truncated as a backstop. Returns "" when the skill has
 * no description line (the frontmatter test makes that unreachable in-repo).
 */
export function extractSkillGloss(skillMd: string): string {
  const match = skillMd.match(/(?:^|\n)description: (.+)/);
  if (match === null) return "";
  // YAML-quoted descriptions leak their opening quote and escapes raw.
  const raw = match[1].trim();
  const unquoted = raw.startsWith('"')
    ? raw.slice(1).replace(/\\"/g, '"')
    : raw;
  const firstSentence = unquoted.split(/(?<=\.)\s/)[0].trim();
  return firstSentence.length > TOOLBOX_GLOSS_MAX_CHARS
    ? `${firstSentence.slice(0, TOOLBOX_GLOSS_MAX_CHARS - 1).trimEnd()}…`
    : firstSentence;
}

/** Render TOOLBOX.md — the skills-and-connectors index for Project knowledge. */
export function buildToolboxIndex(
  skills: readonly { name: string; gloss: string }[],
  connectors: Readonly<Record<string, string>>,
): string {
  const skillLines = skills
    .map(({ name, gloss }) => `- **${name}**${gloss ? ` — ${gloss}` : ""}`)
    .join("\n");
  const connectorLines = Object.entries(connectors)
    .map(([name, gloss]) => `- **${name}** — ${gloss}`)
    .join("\n");

  return `# Toolbox — what Claude has at its disposal

Add this file to the HQ Project's knowledge. Regenerated by
\`npm run claude-ai\` — don't edit by hand; the skill list comes from
manifests/claude-ai.yaml and each gloss from the skill's own description.

## Custom skills (uploaded ZIPs, account-wide)

${skillLines}

## Connectors

${connectorLines}
`;
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
export function buildUploadChecklist(
  skillNames: readonly string[],
  hasProfile: boolean,
): string {
  const zipList = skillNames.map((name) => `- [ ] ${name}.zip`).join("\n");
  const profileNote = hasProfile
    ? "PROFILE.md, and TOOLBOX.md (all packed here)"
    : "TOOLBOX.md (packed here), plus your local `~/.claude/PROFILE.md`" +
      " (this machine has no canonical copy)";
  return `# claude.ai upload checklist

Uploads are manual — claude.ai has no sync API for personal accounts. Re-run
\`npm run claude-ai\` after editing a canonical skill and re-upload its ZIP.

## One-time setup

1. Settings → Capabilities: enable code execution and Skills.
2. Settings → Profile: paste PREFERENCES.md into the preferences box
   (1,500-char limit — the pack fails if the source file exceeds it).
3. Create an HQ Project and add LEXICON.md, ${profileNote} as Project
   knowledge. Skills that reference those files by path degrade gracefully;
   the knowledge files close the gap, and TOOLBOX.md tells Claude what
   skills and connectors it has.

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

  // A canonical copy would shadow the external one in the wizard's layering —
  // the manifest must say which home each skill lives in.
  const shadowed = manifest.externalSkills.filter((name) =>
    available.some((dir) => dir.name === name),
  );
  if (shadowed.length > 0) {
    console.error(
      `externalSkills now exist in canonical/skills (move them to \`skills\`): ${shadowed.join(", ")}.`,
    );
    return 1;
  }

  // External skills: clone the manifest's skill sources into a temp dir and
  // select from the fetched universe. The temp dir must outlive ZIP creation —
  // createSkillArtifacts reads the files from it.
  let externalWorkDir: string | undefined;
  let externalSelected: readonly PackSkillDir[] = [];
  try {
    if (manifest.externalSkills.length > 0) {
      const install = await loadInstallationManifest(
        path.join(repoRoot, "manifests", "install.yaml"),
      );
      const skillSources = install.externalSources.filter(
        (source) =>
          source.kind === "skill-pack" ||
          ((source.kind === "skill" || source.kind === "skill-or-plugin") &&
            manifest.externalSkills.includes(source.id)),
      );
      externalWorkDir = await fs.mkdtemp(
        path.join(os.tmpdir(), "claude-ai-pack-"),
      );
      const fetchResult = await fetchPlannedSources(
        skillSources,
        externalWorkDir,
      );
      for (const r of fetchResult.results) {
        if (r.error) console.error(`  [fetch failed] ${r.sourceId}: ${r.error}`);
      }
      const externalAvailable = groupExternalSkillDirs(fetchResult.files);
      const externalSelection = selectPackSkills(
        externalAvailable,
        manifest.externalSkills,
      );
      if (externalSelection.missing.length > 0) {
        console.error(
          `externalSkills not found in any fetched source: ${externalSelection.missing.join(", ")}.`,
        );
        return 1;
      }
      externalSelected = externalSelection.selected;
    }

    return await packSelection(
      repoRoot,
      [...selected, ...externalSelected],
      manifest,
      preferences,
    );
  } finally {
    if (externalWorkDir !== undefined) {
      await fs.rm(externalWorkDir, { recursive: true, force: true });
    }
  }
}

/** Zip the selected skills and write the companion files. */
async function packSelection(
  repoRoot: string,
  selected: readonly PackSkillDir[],
  manifest: ClaudeAiManifest,
  preferences: string,
): Promise<number> {

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

  // Project-knowledge files: the Lexicon ships from canonical (tracked);
  // PROFILE.md is machine-local (gitignored) and may be absent.
  const lexicon = await fs.readFile(
    path.join(repoRoot, "canonical", "LEXICON.md"),
    "utf-8",
  );
  await fs.writeFile(path.join(outDir, "LEXICON.md"), lexicon);

  let hasProfile = true;
  try {
    const profile = await fs.readFile(
      path.join(repoRoot, "canonical", "PROFILE.md"),
      "utf-8",
    );
    await fs.writeFile(path.join(outDir, "PROFILE.md"), profile);
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    hasProfile = false;
    console.log(
      "  [note] no canonical/PROFILE.md on this machine — UPLOAD.md points at ~/.claude/PROFILE.md instead",
    );
  }

  const toolboxSkills = await Promise.all(
    selected.map(async (dir) => ({
      name: dir.name,
      gloss: extractSkillGloss(
        await fs.readFile(path.join(dir.sourceDir, "SKILL.md"), "utf-8"),
      ),
    })),
  );
  await fs.writeFile(
    path.join(outDir, "TOOLBOX.md"),
    buildToolboxIndex(toolboxSkills, manifest.connectors),
  );

  await fs.writeFile(
    path.join(outDir, "UPLOAD.md"),
    buildUploadChecklist(
      selected.map((dir) => dir.name),
      hasProfile,
    ),
  );

  for (const zipPath of result.created) {
    console.log(`  [created] ${path.basename(zipPath)}`);
  }
  for (const err of result.errors) {
    console.error(`  [error] ${err.skillName}: ${err.message}`);
  }
  console.log(
    `Packed ${result.created.length}/${selected.length} skill ZIP(s) + PREFERENCES/LEXICON${hasProfile ? "/PROFILE" : ""}/TOOLBOX/UPLOAD -> ${path.relative(repoRoot, outDir)}/`,
  );

  return result.errors.length > 0 ? 1 : 0;
}
