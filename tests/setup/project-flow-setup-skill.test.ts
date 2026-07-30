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
    expect(skill).toContain("argument-hint: \"[audit|override|apply] [repo]\"");
    expect(skill).not.toContain("disable-model-invocation");
    expect(skill).toContain("Bare `/project-flow-setup`");
    expect(skill).toContain("guided setup");
    expect(skill).toContain("/project-flow-setup audit");
    expect(skill).toContain("/project-flow-setup override");
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

  it("bundles the defaults and reads them in place", async () => {
    const skill = await readFile(skillPath, "utf-8");

    expect(skill).toContain("[project-flow.md](./defaults/project-flow.md)");
    expect(skill).toContain("[issue-tracker.md](./defaults/issue-tracker.md)");
    expect(skill).toContain("[triage-labels.md](./defaults/triage-labels.md)");
    expect(skill).toContain("~/.claude/skills/project-flow-setup/defaults/");
    expect(skill).toContain("**These are read in place, not copied into repos.**");
  });

  it("writes a docs/agents file only as a deliberate Override", async () => {
    const skill = await readFile(skillPath, "utf-8");

    // Guided setup used to write all three docs unconditionally. It must not.
    expect(skill).toContain("Guided setup does not write `docs/agents/` files");
    expect(skill).toContain("Write an Override only for a real deviation.");
    expect(skill).toContain("## Override Mode");
    // An Override is a decision about the repo, so it gates.
    expect(skill).toContain("**Stop and ask:** writing a `docs/agents/` Override");
    // The setup signal is the label taxonomy, not the presence of a doc.
    expect(skill).toContain("gh label list --json name");
  });

  it("is discoverable for projection and Skill Artifacts with defaults", async () => {
    const skills = await discoverSkillDirs(repoRoot);
    const projectFlowSetup = skills.find((skill) => skill.name === "project-flow-setup");

    expect(projectFlowSetup?.files).toContain("SKILL.md");
    expect(projectFlowSetup?.files).toContain("defaults/project-flow.md");
    expect(projectFlowSetup?.files).toContain("defaults/issue-tracker.md");
    expect(projectFlowSetup?.files).toContain("defaults/triage-labels.md");
  });
});
