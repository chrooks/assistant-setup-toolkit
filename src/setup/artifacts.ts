/**
 * Skill Artifact planning and generation.
 *
 * Skill Artifacts are ZIP packages of skills prepared for manual
 * upload to desktop or web assistants. Planning is pure; ZIP creation
 * uses JSZip so the wizard carries no dependency on a platform `zip`
 * binary (which is not installed everywhere).
 *
 * Generation is opt-in — see `SetupProfile.artifacts` / `--artifacts`.
 * Most runs never need the ZIPs, and building ~50 of them dominated both
 * the wall-clock and the console output of an ordinary install.
 */

import path from "node:path";
import fs from "node:fs/promises";
import JSZip from "jszip";

/** A planned Skill Artifact. */
export interface PlannedArtifact {
  readonly skillName: string;
  /** Absolute path to the output ZIP file. */
  readonly zipPath: string;
  /** Relative filenames inside the skill directory (e.g. ["SKILL.md", "REFERENCE.md"]). */
  readonly sourceFiles: readonly string[];
  /** Absolute path to the skill's source directory containing the files. */
  readonly sourceDir: string;
}

/** Input for planning Skill Artifacts. */
export interface PlanArtifactsInput {
  readonly skillDirs: readonly {
    name: string;
    files: readonly string[];
    /** Absolute path to the skill directory in canonical/. */
    sourceDir: string;
  }[];
  readonly artifactsDir: string;
}

/**
 * Plan Skill Artifacts for each skill directory.
 * Pure function — returns the planned ZIP path, source files, and source directory.
 */
export function planSkillArtifacts(
  input: PlanArtifactsInput,
): readonly PlannedArtifact[] {
  return input.skillDirs.map((skill) => ({
    skillName: skill.name,
    zipPath: path.join(input.artifactsDir, `${skill.name}.zip`),
    sourceFiles: [...skill.files],
    sourceDir: skill.sourceDir,
  }));
}

/** Result of creating Skill Artifacts. */
export interface CreateArtifactsResult {
  readonly created: readonly string[];
  readonly errors: readonly { skillName: string; message: string }[];
}

/**
 * Create ZIP Skill Artifacts on disk from a plan.
 *
 * For each planned artifact, reads the skill's source files and writes them
 * into a ZIP rooted at `<skillName>/`, matching the layout desktop and web
 * assistants expect on upload. Nested paths within a skill are preserved.
 *
 * Returns which ZIPs were created and any errors encountered. One skill
 * failing (e.g. a missing source file) never aborts the rest.
 */
export async function createSkillArtifacts(
  artifacts: readonly PlannedArtifact[],
): Promise<CreateArtifactsResult> {
  const created: string[] = [];
  const errors: { skillName: string; message: string }[] = [];

  for (const artifact of artifacts) {
    try {
      const zip = new JSZip();

      for (const file of artifact.sourceFiles) {
        const contents = await fs.readFile(path.join(artifact.sourceDir, file));
        // Always POSIX separators inside the archive — a ZIP written on
        // Windows with backslashes unpacks as one literally-named file.
        const entry = `${artifact.skillName}/${file.split(path.sep).join("/")}`;
        zip.file(entry, contents);
      }

      const buffer = await zip.generateAsync({
        type: "nodebuffer",
        compression: "DEFLATE",
      });

      await fs.mkdir(path.dirname(artifact.zipPath), { recursive: true });
      await fs.writeFile(artifact.zipPath, buffer);

      created.push(artifact.zipPath);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push({ skillName: artifact.skillName, message });
    }
  }

  return { created, errors };
}
