import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { discoverSkillDirs } from "../../src/setup/index.js";

const repoRoot = process.cwd();
const skillPath = path.join(repoRoot, "canonical", "skills", "ship", "SKILL.md");

describe("ship Skill", () => {
  it("declares the shipping-posture trigger surface", async () => {
    const skill = await readFile(skillPath, "utf-8");

    expect(skill).toContain("name: ship");
    expect(skill).toContain("ship mode");
    expect(skill).toContain("just ship it");
    // "I'm fried" is the original signal this Skill was named for. It stays an
    // alias, but the trigger moved to intent because "fried" is a lagging
    // indicator — you only say it once the decision budget is already gone.
    expect(skill).toContain("I'm fried");
    expect(skill).toContain("decision fatigue");
  });

  it("distinguishes its lever from caveman and ponytail", async () => {
    const skill = await readFile(skillPath, "utf-8");

    expect(skill).toMatch(/caveman \| words/);
    expect(skill).toMatch(/ponytail \| scope/);
    expect(skill).toMatch(/decisions, round trips, and unnecessary context/);
  });

  it("states the uncertainty rule as the central discipline", async () => {
    const skill = await readFile(skillPath, "utf-8");

    // The whole Skill hinges on this: design calls survive, confirmation-seeking
    // dies. Invert it and the mode stops grilling on architecture while still
    // asking where files go — strictly worse than no mode at all.
    expect(skill).toContain(
      "**Stop converting your uncertainty into his decisions.**",
    );
    expect(skill).toContain("**Keep asking**");
    expect(skill).toContain("**Stop asking**");
  });

  it("holds the safety floor against the agency increase", async () => {
    const skill = await readFile(skillPath, "utf-8");

    expect(skill).toContain("**Does not relax under this mode.**");
    expect(skill).toContain("Irreversible or destructive actions");
    expect(skill).toContain("Outward-facing actions");
    expect(skill).toContain("**The mode removes choices, never consent.**");
    // Compressing a report must never launder it.
    expect(skill).toMatch(/never launders it/);
  });

  it("keeps an escape hatch for work the human must do", async () => {
    const skill = await readFile(skillPath, "utf-8");

    expect(skill).toContain("Needs you:");
    expect(skill).toContain("A command only he can run");
    expect(skill).toContain("invalidates the task as scoped");
  });

  it("does not compress explanation the human asked for", async () => {
    const skill = await readFile(skillPath, "utf-8");

    expect(skill).toContain("## When NOT to compress");
    expect(skill).toMatch(/Explanation he explicitly asked for/);
    expect(skill).toMatch(/shortens the response, never the reading/);
  });

  it("is discoverable as a canonical Skill", async () => {
    const dirs = await discoverSkillDirs(repoRoot);

    expect(dirs.map((dir) => dir.name)).toContain("ship");
  });
});
