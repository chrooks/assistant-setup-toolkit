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
    expect(skill).toMatch(/\/plan.*\/grill-me.*\/execute/is);
    expect(skill).toContain("3. /execute");
    expect(skill).toMatch(/invoke the `execute` Skill/i);
    expect(skill).toContain("Right Skill, Right Job");
    expect(skill).not.toMatch(/\bTrivial\b/);
    expect(skill).not.toMatch(/\btrivial\b/);
  });

  it("projects execute guidance without embedding user-level instruction paths", async () => {
    const skill = await readFile(skillPath, "utf-8");
    const projected = rewriteContentForCodex(skill, true);

    expect(projected).toContain("execute` Skill");
    expect(projected).not.toContain("~/.claude/CLAUDE.md");
    expect(projected).not.toContain("~/.codex/AGENTS.md");
  });

  it("keeps Workflow Triage instructions aligned with execute", async () => {
    const instructions = await readFile(instructionsPath, "utf-8");

    expect(instructions).toContain("## Right Skill, Right Job");
    expect(instructions).toContain("`/scope` decides whether to `/execute`, plan, or grill");
    expect(instructions).toContain("`/to-issues` creates, updates, and closes issue records");
    expect(instructions).toContain("`/roadmap` chooses, prioritizes, sequences, and reshapes work");
    expect(instructions).not.toMatch(/\bor Trivial\b/);
  });
});
