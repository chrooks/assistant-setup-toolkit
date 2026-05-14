import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { discoverSkillDirs } from "../../src/setup/index.js";

const repoRoot = process.cwd();
const reviewFanoutPath = path.join(
  repoRoot,
  "canonical",
  "skills",
  "review-fanout",
  "SKILL.md",
);
const verificationLoopPath = path.join(
  repoRoot,
  "canonical",
  "skills",
  "verification-loop",
  "SKILL.md",
);

describe("review-fanout Skill", () => {
  it("defines a reusable concurrent review workflow", async () => {
    const skill = await readFile(reviewFanoutPath, "utf-8");

    expect(skill).toContain("name: review-fanout");
    expect(skill).toMatch(/description:.*Concurrent read-only code review fan-out/i);
    expect(skill).toContain("Use this Skill manually");
    expect(skill).toContain("from `/verification-loop`");
    expect(skill).toContain("`code-reviewer` agent via ECC");
    expect(skill).toContain("`/improve-codebase-architecture`");
    expect(skill).toContain("`/codex:adversarial-review`");
    expect(skill).toContain("read-only");
    expect(skill).toContain("## Concern Synthesis");
    expect(skill).toContain("## Fix-Forward Offer");
  });

  it("keeps verification-loop as the caller of review-fanout", async () => {
    const skill = await readFile(verificationLoopPath, "utf-8");

    expect(skill).toContain("delegated review fan-out");
    expect(skill).toContain("invoke `/review-fanout`");
    expect(skill).toContain("Paste the returned concern synthesis");
    expect(skill).not.toContain("`code-reviewer` agent via ECC");
    expect(skill).not.toContain("## Concern Synthesis");
  });

  it("is discoverable for projection and artifacts", async () => {
    const skills = await discoverSkillDirs(repoRoot);
    const reviewFanout = skills.find((skill) => skill.name === "review-fanout");

    expect(reviewFanout?.files).toContain("SKILL.md");
  });
});
