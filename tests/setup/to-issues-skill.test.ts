import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const skillPath = path.join(repoRoot, "canonical", "skills", "to-issues", "SKILL.md");

describe("to-issues Skill", () => {
  it("documents the local TODO.md subcommand", async () => {
    const skill = await readFile(skillPath, "utf-8");

    expect(skill).toContain("argument-hint: \"[local] <plan|spec|prd|issue|path>\"");
    expect(skill).toContain("disable-model-invocation: true");
    expect(skill).toContain("/to-issues local <source...>");
    expect(skill).toContain("update the project-root `TODO.md`");
    expect(skill).toContain("Do not publish issue tracker tickets.");
  });

  it("keeps local mode safe for existing TODO.md content", async () => {
    const skill = await readFile(skillPath, "utf-8");

    expect(skill).toContain("Preserve existing `TODO.md` content.");
    expect(skill).toContain("replace only that generated block");
    expect(skill).toContain("Preserve checked items and user-written notes");
    expect(skill).toContain("<!-- to-issues:begin -->");
    expect(skill).toContain("<!-- to-issues:end -->");
  });
});
