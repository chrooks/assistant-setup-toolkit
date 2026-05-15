import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { discoverSkillDirs } from "../../src/setup/index.js";

const repoRoot = process.cwd();

function frontmatterOf(skill: string): string | null {
  const match = skill.match(/^---\n([\s\S]*?)\n---\n/);
  return match?.[1] ?? null;
}

describe("canonical Skill frontmatter", () => {
  it("gives every canonical Skill the required Codex discovery metadata", async () => {
    const skills = await discoverSkillDirs(repoRoot);

    for (const skillDir of skills) {
      const skillPath = path.join(skillDir.sourceDir, "SKILL.md");
      const skill = await readFile(skillPath, "utf-8");
      const frontmatter = frontmatterOf(skill);

      expect(frontmatter, `${skillDir.name} must start with YAML frontmatter`).not.toBeNull();
      expect(frontmatter).toMatch(new RegExp(`(^|\\n)name: ${skillDir.name}(\\n|$)`));
      expect(frontmatter).toMatch(/(^|\n)description: .+/);
    }
  });
});
