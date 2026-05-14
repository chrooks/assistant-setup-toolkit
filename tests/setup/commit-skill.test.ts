import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const skillPath = path.join(repoRoot, "canonical", "skills", "commit", "SKILL.md");

describe("commit Skill", () => {
  it("defines an automatically invokable commit workflow with split-scope and gitignore guidance", async () => {
    const skill = await readFile(skillPath, "utf-8");

    expect(skill).toContain("name: commit");
    expect(skill).not.toContain("disable-model-invocation: true");
    expect(skill).toMatch(/more than one logical scope/i);
    expect(skill).toMatch(/split .* separate commits/i);
    expect(skill).toContain("Do not ask for message confirmation by default");
    expect(skill).toContain("/commit confirm");
    expect(skill).toMatch(/\.gitignore/i);
    expect(skill).toMatch(/generated outputs|caches|dependency directories/i);
    expect(skill).toMatch(/let the caller know/i);
  });
});
