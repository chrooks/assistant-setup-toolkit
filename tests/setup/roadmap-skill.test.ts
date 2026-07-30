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
    expect(skill).toContain("disable-model-invocation: false");
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
    expect(skill).toContain("`/scope` decides whether to implement, plan, or grill");
    expect(skill).toContain("Do not create new issue records");
  });

  it("reads the project-flow Contract before ranking work", async () => {
    const skill = await readFile(skillPath, "utf-8");

    expect(skill).toContain("~/.claude/skills/project-flow-setup/defaults/<name>.md");
    expect(skill).toContain("`docs/agents/<name>.md` is an **Override**");
    // A repo with no Override is conforming, not unconfigured.
    expect(skill).toContain("that is the normal case, not missing setup");
  });

  it("treats a missing type: label family as the unconfigured signal", async () => {
    const skill = await readFile(skillPath, "utf-8");

    expect(skill).toContain("gh label list --json name");
    expect(skill).toContain("run `/project-flow-setup` inline");
    expect(skill).not.toContain("If these docs are missing");
  });

  it("is discoverable for projection and Skill Artifacts", async () => {
    const skills = await discoverSkillDirs(repoRoot);
    const roadmap = skills.find((skill) => skill.name === "roadmap");

    expect(roadmap?.files).toContain("SKILL.md");
  });
});
