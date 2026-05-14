import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const skillPath = path.join(repoRoot, ".Codex", "skills", "consult", "SKILL.md");
const referencePath = path.join(
  repoRoot,
  ".Codex",
  "skills",
  "consult",
  "references",
  "codex-howto-extension-map.md",
);

describe("project-scoped consult Skill", () => {
  it("defines consult as a repo-local Codex Skill", async () => {
    const skill = await readFile(skillPath, "utf-8");

    expect(skill).toContain("name: consult");
    expect(skill).toContain("user-invocable: false");
    expect(skill).toContain("references/codex-howto-extension-map.md");
    expect(skill).toMatch(/Skills/i);
    expect(skill).toMatch(/Plugins/i);
    expect(skill).toMatch(/Setup Wizard/i);
  });

  it("keeps project-scoped guidance separate from generated projections", async () => {
    const reference = await readFile(referencePath, "utf-8");

    expect(reference).toContain(".Codex/skills/<name>/SKILL.md");
    expect(reference).toContain("Project-scoped Skill work lands under `.Codex/skills/<name>/`");
    expect(reference).toContain("Do not edit generated `.codex/` or `.agents/` files");
  });
});
