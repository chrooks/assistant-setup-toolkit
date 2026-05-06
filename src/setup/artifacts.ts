/**
 * Skill Artifact planning and generation.
 *
 * Skill Artifacts are ZIP packages of skills prepared for manual
 * upload to desktop or web assistants. This module plans the artifacts;
 * actual ZIP creation uses the platform `zip` command on macOS
 * (Windows ZIP library support is deferred).
 */

import path from "node:path";

/** A planned Skill Artifact. */
export interface PlannedArtifact {
  readonly skillName: string;
  readonly zipPath: string;
  readonly sourcePaths: readonly string[];
}

/** Input for planning Skill Artifacts. */
export interface PlanArtifactsInput {
  readonly skillDirs: readonly { name: string; files: readonly string[] }[];
  readonly artifactsDir: string;
}

/**
 * Plan Skill Artifacts for each skill directory.
 * Returns the planned ZIP path and source files for each skill.
 */
export function planSkillArtifacts(
  input: PlanArtifactsInput,
): readonly PlannedArtifact[] {
  return input.skillDirs.map((skill) => ({
    skillName: skill.name,
    zipPath: path.join(input.artifactsDir, `${skill.name}.zip`),
    sourcePaths: [...skill.files],
  }));
}
