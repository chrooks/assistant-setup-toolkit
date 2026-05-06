import { describe, it, expect } from "vitest";
import { planSkillArtifacts } from "../../src/setup/artifacts.js";

describe("artifacts", () => {
  describe("planSkillArtifacts", () => {
    it("plans a ZIP artifact for each skill directory", () => {
      const plan = planSkillArtifacts({
        skillDirs: [
          { name: "commit", files: ["SKILL.md"] },
          { name: "feature", files: ["SKILL.md", "resources/template.md"] },
        ],
        artifactsDir: "/repo/artifacts",
      });

      expect(plan).toHaveLength(2);
      expect(plan[0].skillName).toBe("commit");
      expect(plan[0].zipPath).toBe("/repo/artifacts/commit.zip");
      expect(plan[0].sourcePaths).toEqual(["SKILL.md"]);

      expect(plan[1].skillName).toBe("feature");
      expect(plan[1].zipPath).toBe("/repo/artifacts/feature.zip");
      expect(plan[1].sourcePaths).toEqual(["SKILL.md", "resources/template.md"]);
    });

    it("returns empty for no skills", () => {
      const plan = planSkillArtifacts({
        skillDirs: [],
        artifactsDir: "/repo/artifacts",
      });

      expect(plan).toHaveLength(0);
    });
  });
});
