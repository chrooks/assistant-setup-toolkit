import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import { planSkillArtifacts, createSkillArtifacts } from "../../src/setup/artifacts.js";

describe("artifacts", () => {
  describe("planSkillArtifacts", () => {
    it("plans a ZIP artifact for each skill directory with source dir", () => {
      const plan = planSkillArtifacts({
        skillDirs: [
          { name: "commit", files: ["SKILL.md"], sourceDir: "/repo/canonical/skills/commit" },
          { name: "feature", files: ["SKILL.md", "resources/template.md"], sourceDir: "/repo/canonical/skills/feature" },
        ],
        artifactsDir: "/repo/artifacts",
      });

      expect(plan).toHaveLength(2);
      expect(plan[0]).toEqual({
        skillName: "commit",
        zipPath: "/repo/artifacts/commit.zip",
        sourceFiles: ["SKILL.md"],
        sourceDir: "/repo/canonical/skills/commit",
      });
      expect(plan[1]).toEqual({
        skillName: "feature",
        zipPath: "/repo/artifacts/feature.zip",
        sourceFiles: ["SKILL.md", "resources/template.md"],
        sourceDir: "/repo/canonical/skills/feature",
      });
    });

    it("returns empty for no skills", () => {
      const plan = planSkillArtifacts({
        skillDirs: [],
        artifactsDir: "/repo/artifacts",
      });

      expect(plan).toHaveLength(0);
    });
  });

  describe("createSkillArtifacts", () => {
    let tmpDir: string;

    beforeEach(async () => {
      // Create a temp directory with fake skill sources
      tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "artifacts-test-"));
    });

    afterEach(async () => {
      await fs.rm(tmpDir, { recursive: true, force: true });
    });

    it("creates ZIP files from planned artifacts", async () => {
      // Set up a fake skill directory with source files
      const skillDir = path.join(tmpDir, "source", "commit");
      await fs.mkdir(skillDir, { recursive: true });
      await fs.writeFile(path.join(skillDir, "SKILL.md"), "# Commit Skill\n");

      const artifactsDir = path.join(tmpDir, "artifacts");

      // Plan then create
      const planned = planSkillArtifacts({
        skillDirs: [{ name: "commit", files: ["SKILL.md"], sourceDir: skillDir }],
        artifactsDir,
      });

      const result = await createSkillArtifacts(planned);

      // ZIP was created, no errors
      expect(result.errors).toEqual([]);
      expect(result.created).toEqual([path.join(artifactsDir, "commit.zip")]);

      // ZIP file actually exists on disk
      const stat = await fs.stat(path.join(artifactsDir, "commit.zip"));
      expect(stat.isFile()).toBe(true);
    });

    it("handles multi-file skills with bundled resources", async () => {
      // Skill with SKILL.md + a bundled resource file
      const skillDir = path.join(tmpDir, "source", "grill-with-docs");
      await fs.mkdir(skillDir, { recursive: true });
      await fs.writeFile(path.join(skillDir, "SKILL.md"), "# Grill\n");
      await fs.writeFile(path.join(skillDir, "CONTEXT-FORMAT.md"), "# Context\n");

      const artifactsDir = path.join(tmpDir, "artifacts");

      const planned = planSkillArtifacts({
        skillDirs: [{
          name: "grill-with-docs",
          files: ["SKILL.md", "CONTEXT-FORMAT.md"],
          sourceDir: skillDir,
        }],
        artifactsDir,
      });

      const result = await createSkillArtifacts(planned);

      expect(result.errors).toEqual([]);
      expect(result.created).toHaveLength(1);

      // ZIP exists
      const stat = await fs.stat(path.join(artifactsDir, "grill-with-docs.zip"));
      expect(stat.isFile()).toBe(true);
    });

    it("cleans up staging directories after ZIP creation", async () => {
      const skillDir = path.join(tmpDir, "source", "mode");
      await fs.mkdir(skillDir, { recursive: true });
      await fs.writeFile(path.join(skillDir, "SKILL.md"), "# Mode\n");

      const artifactsDir = path.join(tmpDir, "artifacts");

      const planned = planSkillArtifacts({
        skillDirs: [{ name: "mode", files: ["SKILL.md"], sourceDir: skillDir }],
        artifactsDir,
      });

      await createSkillArtifacts(planned);

      // Staging directory should be cleaned up — only ZIP remains
      const entries = await fs.readdir(artifactsDir);
      expect(entries).toEqual(["mode.zip"]);
    });

    it("reports errors for missing source files without crashing", async () => {
      const artifactsDir = path.join(tmpDir, "artifacts");

      // Point to a source directory that doesn't exist
      const result = await createSkillArtifacts([{
        skillName: "ghost",
        zipPath: path.join(artifactsDir, "ghost.zip"),
        sourceFiles: ["SKILL.md"],
        sourceDir: path.join(tmpDir, "nonexistent"),
      }]);

      expect(result.created).toEqual([]);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].skillName).toBe("ghost");
    });
  });
});
