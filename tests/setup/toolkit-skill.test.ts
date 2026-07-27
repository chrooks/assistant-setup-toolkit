import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { discoverSkillDirs } from "../../src/setup/index.js";

const repoRoot = process.cwd();
const skillDir = path.join(repoRoot, "canonical", "skills", "toolkit");
const skillPath = path.join(skillDir, "SKILL.md");
const authoringSkillPath = path.join(skillDir, "authoring-skill.md");
const instructionsPath = path.join(repoRoot, "canonical", "INSTRUCTIONS.md");

/**
 * Seam A — the Skill-content assertion. These read the router as text and check
 * that its load-bearing rules are literally present, so an edit that quietly
 * drops one fails here instead of shipping.
 */
describe("toolkit Skill — the router", () => {
  it("is model-invocable and carries its trigger phrases (AC1)", async () => {
    const skill = await readFile(skillPath, "utf-8");

    expect(skill).toContain("name: toolkit");
    expect(skill).not.toContain("disable-model-invocation");

    // The description is the only thing the model sees when matching skills,
    // so the permanence phrases that discriminate a durable change live there.
    const description = skill.match(/^description: (.+)$/m)?.[1] ?? "";
    expect(description).toMatch(/from now on/i);
    expect(description).toMatch(/always/i);
    expect(description).toMatch(/every time/i);
    expect(description).toMatch(/make a skill/i);
    expect(description).toMatch(/add a rule/i);
  });

  it("routes to all six artifact kinds (AC2)", async () => {
    const skill = await readFile(skillPath, "utf-8");

    expect(skill).toContain("canonical/skills/<name>/");
    expect(skill).toContain("canonical/rules/<area>/");
    expect(skill).toContain("canonical/INSTRUCTIONS.md");
    expect(skill).toContain("canonical/hooks/");
    expect(skill).toContain("canonical/machines/<name>/rules.md");
    expect(skill).toContain("manifests/install.yaml");
  });

  it("states the belt-and-suspenders pairing and asks rather than infers (AC3)", async () => {
    const skill = await readFile(skillPath, "utf-8");

    expect(skill).toMatch(/must fire 100% of the time/i);
    expect(skill).toMatch(/an instruction \*and\* a hook/i);
    expect(skill).toMatch(/question put to the user\*\*, never an inference/i);
  });

  it("never infers scope from the current machine (AC5, router half)", async () => {
    const skill = await readFile(skillPath, "utf-8");

    expect(skill).toMatch(/never infer scope from the machine/i);
    expect(skill).toContain("canonical** (default)");
  });

  it("runs the wizard, and prunes rather than syncs on remove", async () => {
    const skill = await readFile(skillPath, "utf-8");

    expect(skill).toContain("npm run sync");
    expect(skill).toContain("--write prune");
  });

  it("points at live documentation instead of a vendored snapshot", async () => {
    const skill = await readFile(skillPath, "utf-8");

    expect(skill).toContain("github.com/agentskills/agentskills");
    expect(skill).toContain("docs.claude.com/en/docs/claude-code");
    expect(skill).toContain("developers.openai.com/codex");
  });
});

describe("toolkit Skill — the Skill authoring branch", () => {
  it("names the machine-scope destination and forbids inferring scope (AC5)", async () => {
    const branch = await readFile(authoringSkillPath, "utf-8");

    expect(branch).toContain("canonical/machines/<name>/skills/<skill>/");
    expect(branch).toMatch(/never inferred from the current machine/i);
  });

  it("keeps the project scope writing to both Assistant Targets", async () => {
    const branch = await readFile(authoringSkillPath, "utf-8");

    expect(branch).toContain("./.claude/skills/<name>/");
    expect(branch).toContain("./.agents/skills/<name>/");
  });
});

describe("toolkit Skill — the absorbed Skills are gone (AC6)", () => {
  it("no longer discovers write-skill or consult", async () => {
    const names = (await discoverSkillDirs(repoRoot)).map((skill) => skill.name);

    expect(names).toContain("toolkit");
    expect(names).not.toContain("write-skill");
    expect(names).not.toContain("consult");
  });

  it("routes extension work through /toolkit in the instructions", async () => {
    const instructions = await readFile(instructionsPath, "utf-8");

    expect(instructions).toMatch(/hook scripts, machine rules, or Manifest entries → `\/toolkit`/);
    expect(instructions).not.toMatch(/consult the `consult` Skill/);
  });
});

describe("toolkit Skill — the instruction budget (AC7)", () => {
  it("keeps INSTRUCTIONS.md under its documented ceiling", async () => {
    const instructions = await readFile(instructionsPath, "utf-8");

    expect(instructions.split("\n").length).toBeLessThanOrEqual(120);
  });

  it("collapses the Where learnings go table into a pointer", async () => {
    const instructions = await readFile(instructionsPath, "utf-8");

    expect(instructions).toContain("## Where learnings go");
    expect(instructions).toContain("`/toolkit`");
    // The table rows moved into the router; only the pointer stays here.
    expect(instructions).not.toContain("| A thing worth keeping | Goes to |");
    expect(instructions).not.toContain("| Machine-specific fact |");
  });
});
