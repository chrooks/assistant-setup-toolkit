import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const templateRoot = path.join(
  repoRoot,
  "canonical",
  "skills",
  "project-flow-setup",
  "templates",
);
const howToPath = path.join(repoRoot, "docs", "project-flow-how-to.md");

describe("project-flow setup templates", () => {
  it("documents the repo-local workflow Contract", async () => {
    const projectFlow = await readFile(path.join(templateRoot, "project-flow.md"), "utf-8");
    const howTo = await readFile(howToPath, "utf-8");

    for (const text of [projectFlow, howTo]) {
      expect(text).toContain("/project-flow-setup");
      expect(text).toContain("/to-issues");
      expect(text).toContain("/roadmap");
      expect(text).toContain("/scope");
      expect(text).toContain("/execute");
      expect(text).toContain("/verification-loop");
      expect(text).toContain("/prep-pr");
      expect(text).toContain("docs/agents/project-flow.md");
      expect(text).toContain("docs/agents/issue-tracker.md");
      expect(text).toContain("docs/agents/triage-labels.md");
    }
  });

  it("documents issue tracker behavior and GitHub Project auth", async () => {
    const issueTracker = await readFile(path.join(templateRoot, "issue-tracker.md"), "utf-8");
    const triageLabels = await readFile(path.join(templateRoot, "triage-labels.md"), "utf-8");

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
});
