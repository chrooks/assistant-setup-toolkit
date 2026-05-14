import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

describe("Lexicon reminder", () => {
  it("coaches corrections instead of requiring repeated term definitions", async () => {
    const instructions = await readFile(
      path.join(repoRoot, "canonical", "CLAUDE.md"),
      "utf-8",
    );
    const hook = await readFile(
      path.join(repoRoot, "canonical", "hooks", "lexicon-reminder.sh"),
      "utf-8",
    );

    expect(instructions).not.toMatch(/define each term on first use/i);
    expect(hook).not.toMatch(/define each term on first use/i);
    expect(instructions).toMatch(/correct .*misuse/i);
    expect(instructions).toMatch(/fail to use/i);
    expect(hook).toMatch(/correct .*misuse/i);
    expect(hook).toMatch(/fail to use/i);
    expect(hook).toContain("_Avoid_");
  });
});
