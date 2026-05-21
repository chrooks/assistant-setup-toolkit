import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { rewriteContentForCodex } from "../../src/setup/projection.js";

const repoRoot = process.cwd();
const skillPath = path.join(repoRoot, "canonical", "skills", "execute", "SKILL.md");

describe("execute Skill", () => {
  it("defines the /execute workflow around user-level skill guidance", async () => {
    const skill = await readFile(skillPath, "utf-8");

    expect(skill).toContain("name: execute");
    expect(skill).toContain("disable-model-invocation: false");
    expect(skill).toContain("Right Skill, Right Job");
    expect(skill).toContain("~/.claude/CLAUDE.md");
    expect(skill).toContain("/tdd");
    expect(skill).toContain("/impeccable");
    expect(skill).toContain("/verification-loop");
    expect(skill).toContain("/review-fanout");
    expect(skill).toContain("/commit");
    expect(skill).toContain("/diagnose");
    expect(skill).toContain("/find-skill");
    expect(skill).toMatch(
      /run `\/verification-loop`[\s\S]*run `\/review-fanout`[\s\S]*use\s+`\/tdd`[\s\S]*Use `\/commit`/,
    );
    expect(skill).not.toMatch(/\bTrivial\b/);
    expect(skill).not.toMatch(/\btrivial\b/);
  });

  it("projects user-level instruction references for Codex", async () => {
    const skill = await readFile(skillPath, "utf-8");
    const projected = rewriteContentForCodex(skill, true);

    expect(projected).toContain("~/.codex/AGENTS.md");
    expect(projected).toContain("when running in Codex CLI");
    expect(projected).not.toContain("~/.claude/CLAUDE.md");
  });
});
