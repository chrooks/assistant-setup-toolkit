import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { discoverSkillDirs } from "../../src/setup/index.js";

const repoRoot = process.cwd();
const skillPath = path.join(
  repoRoot,
  "canonical",
  "skills",
  "project-flow-setup",
  "SKILL.md",
);

describe("project-flow-setup Skill", () => {
  it("defines a side-effectful guided setup Skill", async () => {
    const skill = await readFile(skillPath, "utf-8");

    expect(skill).toContain("name: project-flow-setup");
    expect(skill).toContain("argument-hint: \"[audit|docs|apply] [repo]\"");
    expect(skill).toContain("disable-model-invocation: true");
    expect(skill).toContain("Bare `/project-flow-setup`");
    expect(skill).toContain("guided setup");
    expect(skill).toContain("/project-flow-setup audit");
    expect(skill).toContain("/project-flow-setup docs");
    expect(skill).toContain("/project-flow-setup apply");
  });

  it("keeps the workflow Boundary and approval gate explicit", async () => {
    const skill = await readFile(skillPath, "utf-8");

    expect(skill).toContain("`/project-flow-setup` configures a repository");
    expect(skill).toContain("`/to-issues` creates, updates, and closes issue records");
    expect(skill).toContain("`/roadmap` chooses, prioritizes, sequences, and reshapes work");
    // Setup is plumbing: it runs to completion. Only lossy actions gate.
    expect(skill).toContain("### Approval boundary");
    expect(skill).toContain("**Apply without asking:**");
    expect(skill).toContain("**Stop and ask:**");
    expect(skill).toContain("gh auth refresh -s project");
    // `read:project` cannot create a Project — recommending it costs a round trip.
    expect(skill).toContain("Always name `project`, never `read:project`");
  });

  it("references bundled templates for repo-local docs", async () => {
    const skill = await readFile(skillPath, "utf-8");

    expect(skill).toContain("[project-flow.md](./templates/project-flow.md)");
    expect(skill).toContain("[issue-tracker.md](./templates/issue-tracker.md)");
    expect(skill).toContain("[triage-labels.md](./templates/triage-labels.md)");
    expect(skill).toContain("docs/agents/project-flow.md");
    expect(skill).toContain("docs/agents/issue-tracker.md");
    expect(skill).toContain("docs/agents/triage-labels.md");
  });

  it("is discoverable for projection and Skill Artifacts with templates", async () => {
    const skills = await discoverSkillDirs(repoRoot);
    const projectFlowSetup = skills.find((skill) => skill.name === "project-flow-setup");

    expect(projectFlowSetup?.files).toContain("SKILL.md");
    expect(projectFlowSetup?.files).toContain("templates/project-flow.md");
    expect(projectFlowSetup?.files).toContain("templates/issue-tracker.md");
    expect(projectFlowSetup?.files).toContain("templates/triage-labels.md");
  });
});
