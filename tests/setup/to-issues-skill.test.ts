import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const skillPath = path.join(repoRoot, "canonical", "skills", "to-issues", "SKILL.md");
const localTodoFormatPath = path.join(
  repoRoot,
  "canonical",
  "skills",
  "to-issues",
  "LOCAL-TODO-FORMAT.md",
);

describe("to-issues Skill", () => {
  it("documents the local TODO.md subcommand", async () => {
    const skill = await readFile(skillPath, "utf-8");

    expect(skill).toContain("argument-hint: \"[local] <plan|spec|prd|issue|path>\"");
    expect(skill).toContain("disable-model-invocation: true");
    expect(skill).toContain("/to-issues local <source...>");
    expect(skill).toContain("update the project-root `TODO.md`");
    expect(skill).toContain("Do not publish issue tracker tickets.");
  });

  it("keeps local mode safe for existing TODO.md content", async () => {
    const skill = await readFile(skillPath, "utf-8");
    const localTodoFormat = await readFile(localTodoFormatPath, "utf-8");

    expect(skill).toContain("Preserve existing `TODO.md` content.");
    expect(skill).toContain("replace only that generated block");
    expect(skill).toContain("Preserve checked items and user-written notes");
    expect(localTodoFormat).toContain("<!-- to-issues:begin -->");
    expect(localTodoFormat).toContain("<!-- to-issues:end -->");
  });

  it("stores the local TODO.md format as a bundled Progressive Disclosure resource", async () => {
    const skill = await readFile(skillPath, "utf-8");
    const localTodoFormat = await readFile(localTodoFormatPath, "utf-8");

    expect(skill).toContain("[LOCAL-TODO-FORMAT.md](./LOCAL-TODO-FORMAT.md)");
    expect(localTodoFormat).toContain("## In Progress / Outstanding TODOs");
    expect(localTodoFormat).toContain("## Completed TODO Historical Log");
    expect(localTodoFormat).toContain("- [ ]");
    expect(localTodoFormat).toContain("- [~]");
    expect(localTodoFormat).toContain("- [X]");
    expect(localTodoFormat).toContain("Type:");
    expect(localTodoFormat).toContain("Status:");
    expect(localTodoFormat).toContain("Blocked By:");
    expect(localTodoFormat).toContain("Existing Work Relation:");
    expect(localTodoFormat).toContain("Decision:");
    expect(localTodoFormat).toContain("#### What to Build");
    expect(localTodoFormat).toContain("#### Acceptance Criteria");
    expect(localTodoFormat).toContain("\n---\n");
  });

  it("keeps completed TODO historical log entries compact", async () => {
    const localTodoFormat = await readFile(localTodoFormatPath, "utf-8");
    const historicalLog = localTodoFormat.split("## Completed TODO Historical Log")[1] ?? "";

    expect(historicalLog).toContain("- [X] Short completed TODO title - 2026-05-14 2:30 EST");
    expect(historicalLog).toContain("  - [X] Observable criterion passed");
    expect(historicalLog).toContain("  - [X] Verification command or manual check passed");
    expect(historicalLog).not.toContain("DateTime Completed:");
    expect(historicalLog).not.toContain("#### Acceptance Criteria");
    expect(historicalLog).not.toContain("Type:");
    expect(historicalLog).not.toContain("Status:");
    expect(historicalLog).not.toContain("Blocked By:");
    expect(historicalLog).not.toContain("Existing Work Relation:");
    expect(historicalLog).not.toContain("Decision:");
    expect(historicalLog).not.toContain("#### What to Build");
  });
});
