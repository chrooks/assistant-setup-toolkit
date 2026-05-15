import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { discoverSkillDirs } from "../../src/setup/index.js";

const repoRoot = process.cwd();
const skillPath = path.join(repoRoot, "canonical", "skills", "roadmap", "SKILL.md");

describe("roadmap Skill", () => {
  it("defines the prioritization and sequencing Surface", async () => {
    const skill = await readFile(skillPath, "utf-8");

    expect(skill).toContain("name: roadmap");
    expect(skill).toContain("disable-model-invocation: true");
    expect(skill).toContain("chooses, prioritizes, sequences, and reshapes work");
    expect(skill).toContain("/roadmap next");
    expect(skill).toContain("/roadmap board");
    expect(skill).toContain("/roadmap milestone");
    expect(skill).toContain("/roadmap blocked");
    expect(skill).toContain("What should I pick up next?");
  });

  it("keeps the Boundary with to-issues and scope explicit", async () => {
    const skill = await readFile(skillPath, "utf-8");

    expect(skill).toContain("`/to-issues` creates, updates, and closes issue records");
    expect(skill).toContain("`/scope` decides whether to execute, plan, or grill");
    expect(skill).toContain("Do not create new issue records");
  });

  it("uses project-flow setup docs before ranking work", async () => {
    const skill = await readFile(skillPath, "utf-8");

    expect(skill).toContain("docs/agents/project-flow.md");
    expect(skill).toContain("docs/agents/issue-tracker.md");
    expect(skill).toContain("docs/agents/triage-labels.md");
    expect(skill).toContain("/project-flow-setup audit");
    expect(skill).toContain("/project-flow-setup docs");
  });

  it("is discoverable for projection and Skill Artifacts", async () => {
    const skills = await discoverSkillDirs(repoRoot);
    const roadmap = skills.find((skill) => skill.name === "roadmap");

    expect(roadmap?.files).toContain("SKILL.md");
  });
});
