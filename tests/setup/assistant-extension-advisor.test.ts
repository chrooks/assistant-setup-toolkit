import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { discoverSkillDirs } from "../../src/setup/index.js";

const repoRoot = process.cwd();
const skillPath = path.join(
  repoRoot,
  "canonical",
  "skills",
  "consult",
  "SKILL.md",
);
const referencePath = path.join(
  repoRoot,
  "canonical",
  "skills",
  "consult",
  "references",
  "claude-howto-extension-map.md",
);

describe("consult Skill (formerly assistant-extension-advisor)", () => {
  it("defines an automatic advisory Skill for assistant extension decisions", async () => {
    const skill = await readFile(skillPath, "utf-8");

    expect(skill).toContain("name: consult");
    expect(skill).toContain("user-invocable: false");
    expect(skill).toContain("references/claude-howto-extension-map.md");
    expect(skill).toMatch(/description:.*Skills/i);
    expect(skill).toMatch(/description:.*Plugins/i);
    expect(skill).toMatch(/description:.*hook scripts/i);
    expect(skill).toMatch(/description:.*manifests\/install\.yaml/i);
    expect(skill).toMatch(/description:.*Setup Wizard/i);
  });

  it("maps claude-howto guidance into toolkit decision rules", async () => {
    const reference = await readFile(referencePath, "utf-8");

    expect(reference).toContain("/Users/cdbrooks/Development/Software/Repositories/claude-howto");
    expect(reference).toMatch(/Use a Skill for one reusable workflow/i);
    expect(reference).toMatch(/Use a Plugin for bundled multi-component distribution/i);
    expect(reference).toMatch(/Use a hook script for event-triggered side effects/i);
    expect(reference).toMatch(/Use an MCP Server for live external tool or data access/i);
    expect(reference).toMatch(/Use Next Steps for actions the Setup Wizard should surface but not run/i);
    expect(reference).toMatch(/claude --plugin-dir/i);
    expect(reference).toMatch(/official Claude Code docs/i);
  });

  it("is discoverable with nested reference files for projection and artifacts", async () => {
    const skills = await discoverSkillDirs(repoRoot);
    const advisor = skills.find((skill) => skill.name === "consult");

    expect(advisor?.files).toContain("SKILL.md");
    expect(advisor?.files).toContain("references/claude-howto-extension-map.md");
  });
});
