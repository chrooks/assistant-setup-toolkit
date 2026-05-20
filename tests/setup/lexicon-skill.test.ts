import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { discoverSkillDirs } from "../../src/setup/index.js";

const repoRoot = process.cwd();
const skillPath = path.join(repoRoot, "canonical", "skills", "lexicon", "SKILL.md");

describe("lexicon Skill", () => {
  it("defines /lexicon as the user-facing Lexicon management Skill", async () => {
    const skill = await readFile(skillPath, "utf-8");

    expect(skill).toContain("name: lexicon");
    expect(skill).toContain("disable-model-invocation: false");
    expect(skill).toContain("/lexicon add");
    expect(skill).toContain("/lexicon add rectangle - four-sided 2D shape with 4 right angles");
    expect(skill).toContain("/lexicon add rectangle");
    expect(skill).toContain("/lexicon add four-sided 2D shape with 4 right angles");
    expect(skill).toMatch(/name and definition/i);
    expect(skill).toMatch(/name only/i);
    expect(skill).toMatch(/definition only/i);
    expect(skill).toContain("/lxicon");
    expect(skill).toMatch(/look up|lookup|search/i);
  });

  it("renames the canonical Skill directory from glossary to lexicon", async () => {
    const skills = await discoverSkillDirs(repoRoot);
    const names = skills.map((skill) => skill.name);

    expect(names).toContain("lexicon");
    expect(names).not.toContain("glossary");
  });
});
