/**
 * Skill Artifact planning and generation.
 *
 * Skill Artifacts are ZIP packages of skills prepared for manual
 * upload to desktop or web assistants. Planning is pure; ZIP creation
 * shells out to the platform `zip` command (macOS/Linux).
 */

import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";

const execFileAsync = promisify(execFile);

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
 * For each planned artifact:
 *   1. Ensures the artifacts output directory exists
 *   2. Creates a staging directory <artifactsDir>/<skillName>/
 *   3. Copies source files into the staging directory
 *   4. Runs `zip -qr <skillName>.zip <skillName>/` from the artifacts directory
 *   5. Removes the staging directory
 *
 * Returns which ZIPs were created and any errors encountered.
 */
export async function createSkillArtifacts(
  artifacts: readonly PlannedArtifact[],
): Promise<CreateArtifactsResult> {
  const created: string[] = [];
  const errors: { skillName: string; message: string }[] = [];

  for (const artifact of artifacts) {
    try {
      const artifactsDir = path.dirname(artifact.zipPath);
      const stagingDir = path.join(artifactsDir, artifact.skillName);

      // Ensure artifacts output directory exists
      await fs.mkdir(artifactsDir, { recursive: true });

      // Create staging directory and copy source files into it
      await fs.mkdir(stagingDir, { recursive: true });
      for (const file of artifact.sourceFiles) {
        const src = path.join(artifact.sourceDir, file);
        const dest = path.join(stagingDir, file);
        // Preserve nested directory structure within the skill
        await fs.mkdir(path.dirname(dest), { recursive: true });
        await fs.copyFile(src, dest);
      }

      // Remove existing ZIP if present (zip command appends by default)
      try {
        await fs.unlink(artifact.zipPath);
      } catch {
        // ZIP doesn't exist yet — that's fine
      }

      // Create ZIP from the staging directory
      await execFileAsync("zip", ["-qr", `${artifact.skillName}.zip`, `${artifact.skillName}/`], {
        cwd: artifactsDir,
      });

      // Clean up staging directory
      await fs.rm(stagingDir, { recursive: true, force: true });

      created.push(artifact.zipPath);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push({ skillName: artifact.skillName, message });
    }
  }

  return { created, errors };
}
