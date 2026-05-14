import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { rewriteContentForCodex } from "../../src/setup/projection.js";

const repoRoot = process.cwd();
const skillPath = path.join(repoRoot, "canonical", "skills", "scope", "SKILL.md");
const instructionsPath = path.join(repoRoot, "canonical", "CLAUDE.md");

describe("scope Skill", () => {
  it("offers execute instead of trivial and delegates execution to user-level skill guidance", async () => {
    const skill = await readFile(skillPath, "utf-8");

    expect(skill).toContain("name: scope");
    expect(skill).toMatch(/\/plan.*\/grill-me.*\/to-prd.*\/execute/is);
    expect(skill).toContain("4. /execute");
    expect(skill).toContain("Using the Right Skill for the Right Job");
    expect(skill).toContain("~/.claude/CLAUDE.md");
    expect(skill).toContain("/tdd");
    expect(skill).toContain("/impeccable");
    expect(skill).not.toMatch(/\bTrivial\b/);
    expect(skill).not.toMatch(/\btrivial\b/);
  });

  it("projects execute guidance to the Codex user-level instruction file", async () => {
    const skill = await readFile(skillPath, "utf-8");
    const projected = rewriteContentForCodex(skill, true);

    expect(projected).toContain("~/.codex/AGENTS.md");
    expect(projected).toContain("when running in Codex Code");
    expect(projected).not.toContain("~/.claude/CLAUDE.md");
  });

  it("keeps Workflow Triage instructions aligned with execute", async () => {
    const instructions = await readFile(instructionsPath, "utf-8");

    expect(instructions).toContain("## Using the Right Skill for the Right Job");
    expect(instructions).toMatch(/\/scope.*\/plan.*\/grill-me.*\/to-prd.*\/execute/is);
    expect(instructions).not.toMatch(/\bor Trivial\b/);
  });
});
