import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const defaultsRoot = path.join(
  repoRoot,
  "canonical",
  "skills",
  "project-flow-setup",
  "defaults",
);
const howToPath = path.join(repoRoot, "docs", "project-flow-how-to.md");

describe("project-flow defaults", () => {
  it("documents the workflow Contract", async () => {
    const projectFlow = await readFile(path.join(defaultsRoot, "project-flow.md"), "utf-8");
    const howTo = await readFile(howToPath, "utf-8");

    for (const text of [projectFlow, howTo]) {
      expect(text).toContain("/project-flow-setup");
      expect(text).toContain("/to-issues");
      expect(text).toContain("/roadmap");
      expect(text).toContain("/scope");
      expect(text).toContain("/implement");
      expect(text).toContain("/verification-loop");
      expect(text).toContain("/prep-pr");
    }
  });

  it("says the defaults are read in place, not copied into repos", async () => {
    const projectFlow = await readFile(path.join(defaultsRoot, "project-flow.md"), "utf-8");
    const howTo = await readFile(howToPath, "utf-8");

    for (const text of [projectFlow, howTo]) {
      expect(text).toContain("~/.claude/skills/project-flow-setup/defaults/");
      expect(text).toContain("Override");
      // The whole point: a conforming repo carries no copy of the Contract.
      expect(text).toMatch(/needs no copy of them/);
    }
  });

  it("documents issue tracker behavior and GitHub Project auth", async () => {
    const issueTracker = await readFile(path.join(defaultsRoot, "issue-tracker.md"), "utf-8");
    const triageLabels = await readFile(path.join(defaultsRoot, "triage-labels.md"), "utf-8");

    expect(issueTracker).toContain("Issue records");
    expect(issueTracker).toContain("Sub-issues");
    expect(issueTracker).toContain("Verified closure");
    expect(issueTracker).toContain("Parent");
    expect(issueTracker).toContain("gh issue close");
    expect(issueTracker).toContain("Parent issue comment");
    expect(triageLabels).toContain("gh auth refresh -s project");
    expect(triageLabels).toContain("Status: Inbox, Backlog, Ready, In Progress, Blocked, Review, Done");
    expect(triageLabels).toContain("Priority: P0, P1, P2, P3");
    expect(triageLabels).toContain("Size: XS, S, M, L");
    expect(triageLabels).toContain("Mode: AFK, HITL");
  });

  // The regression this change exists to prevent: a repo-local doc that is a
  // verbatim copy of its default is duplication, and it desyncs silently the
  // next time the default changes. An Override must actually deviate.
  it("keeps no repo-local doc that merely duplicates a default", async () => {
    const defaults = await readdir(defaultsRoot);

    for (const name of defaults) {
      const overrideText = await readFile(
        path.join(repoRoot, "docs", "agents", name),
        "utf-8",
      ).catch(() => null);

      if (overrideText === null) continue;

      const defaultText = await readFile(path.join(defaultsRoot, name), "utf-8");
      expect(overrideText.trim(), `docs/agents/${name} duplicates its default`).not.toBe(
        defaultText.trim(),
      );
    }
  });
});
