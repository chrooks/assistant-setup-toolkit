import { describe, it, expect } from "vitest";
import {
  rewriteContentForCodex,
  planCodexProjection,
} from "../../src/setup/projection.js";

describe("projection", () => {
  describe("rewriteContentForCodex", () => {
    it("rewrites Claude references to Codex equivalents", () => {
      const input = "See .claude/CLAUDE.md for Claude Code instructions.";
      const result = rewriteContentForCodex(input, false);

      expect(result).toBe("See .codex/AGENTS.md for Codex Code instructions.");
    });

    it("quotes unquoted description and argument-hint in SKILL.md frontmatter", () => {
      const input = [
        "---",
        "description: Run a commit workflow",
        "argument-hint: optional message",
        "---",
        "Body text stays unchanged.",
      ].join("\n");

      const result = rewriteContentForCodex(input, true);

      expect(result).toContain('description: "Run a commit workflow"');
      expect(result).toContain('argument-hint: "optional message"');
      expect(result).toContain("Body text stays unchanged.");
    });

    it("leaves already-quoted frontmatter values alone", () => {
      const input = [
        "---",
        'description: "Already quoted"',
        "---",
        "Body.",
      ].join("\n");

      const result = rewriteContentForCodex(input, true);

      expect(result).toContain('description: "Already quoted"');
    });
  });

  describe("planCodexProjection", () => {
    it("maps CLAUDE.md to .codex/AGENTS.md", () => {
      const plan = planCodexProjection({
        claudeFiles: ["CLAUDE.md"],
        skillDirs: [],
      });

      expect(plan).toHaveLength(1);
      expect(plan[0].source).toBe("CLAUDE.md");
      expect(plan[0].target).toBe(".codex/AGENTS.md");
    });

    it("maps PLAN.md to .codex/PLAN.md", () => {
      const plan = planCodexProjection({
        claudeFiles: ["PLAN.md"],
        skillDirs: [],
      });

      expect(plan).toHaveLength(1);
      expect(plan[0].source).toBe("PLAN.md");
      expect(plan[0].target).toBe(".codex/PLAN.md");
    });

    it("maps CONTEXT.md to .codex/CONTEXT.md", () => {
      const plan = planCodexProjection({
        claudeFiles: ["CONTEXT.md"],
        skillDirs: [],
      });

      expect(plan).toHaveLength(1);
      expect(plan[0].source).toBe("CONTEXT.md");
      expect(plan[0].target).toBe(".codex/CONTEXT.md");
    });

    it("maps skill directories to .agents/skills/", () => {
      const plan = planCodexProjection({
        claudeFiles: [],
        skillDirs: [{ name: "commit", files: ["SKILL.md"] }],
      });

      expect(plan).toHaveLength(1);
      expect(plan[0].source).toBe("skills/commit/SKILL.md");
      expect(plan[0].target).toBe(".agents/skills/commit/SKILL.md");
      expect(plan[0].isSkill).toBe(true);
    });

    it("skips commands (no Codex equivalent surface)", () => {
      // planCodexProjection has no commands input — commands are not projected
      const plan = planCodexProjection({
        claudeFiles: ["CLAUDE.md"],
        skillDirs: [],
      });

      const targets = plan.map((p) => p.target);
      expect(targets.every((t) => !t.includes("commands/"))).toBe(true);
    });

    it("maps hook scripts to .codex/hooks/ verbatim with isHook=true", () => {
      const plan = planCodexProjection({
        claudeFiles: [],
        skillDirs: [],
        hookFiles: ["lexicon-reminder.sh", "session-mode-loader.sh"],
      });

      expect(plan).toHaveLength(2);

      const lexicon = plan.find((m) => m.source === "hooks/lexicon-reminder.sh");
      expect(lexicon).toBeDefined();
      expect(lexicon?.target).toBe(".codex/hooks/lexicon-reminder.sh");
      expect(lexicon?.isHook).toBe(true);
      expect(lexicon?.isSkill).toBe(false);

      const session = plan.find(
        (m) => m.source === "hooks/session-mode-loader.sh",
      );
      expect(session).toBeDefined();
      expect(session?.target).toBe(".codex/hooks/session-mode-loader.sh");
      expect(session?.isHook).toBe(true);
    });

    it("treats hookFiles as optional — omitting it produces no hook mappings", () => {
      const plan = planCodexProjection({
        claudeFiles: ["CLAUDE.md"],
        skillDirs: [],
      });

      expect(plan.every((m) => !m.isHook)).toBe(true);
    });

    it("non-hook mappings have isHook=false", () => {
      const plan = planCodexProjection({
        claudeFiles: ["CLAUDE.md"],
        skillDirs: [{ name: "commit", files: ["SKILL.md"] }],
        hookFiles: [],
      });

      expect(plan.every((m) => m.isHook === false)).toBe(true);
    });
  });
});
