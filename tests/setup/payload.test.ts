import { describe, it, expect } from "vitest";
import { buildAssistantPayloads } from "../../src/setup/payload.js";
import type { PayloadFile } from "../../src/setup/domain.js";

describe("payload", () => {
  describe("buildAssistantPayloads", () => {
    it("local canonical source wins over external source for same relative path", () => {
      // Both external and local provide skills/feature/SKILL.md
      const result = buildAssistantPayloads({
        targets: ["claude-code"],
        components: ["skills"],
        externalFiles: [
          {
            relativePath: "skills/feature/SKILL.md",
            sourcePath: "/tmp/external/skills/feature/SKILL.md",
            component: "skills",
            origin: "external-source",
            executable: false,
          },
        ],
        canonicalFiles: [
          {
            relativePath: "skills/feature/SKILL.md",
            sourcePath: "/repo/.claude/skills/feature/SKILL.md",
            component: "skills",
            origin: "canonical-source",
            executable: false,
          },
        ],
        projectionFiles: [],
      });

      // Should have one payload for claude-home
      const claudePayload = result.payloads.find((p) => p.homeId === "claude-home");
      expect(claudePayload).toBeDefined();

      // The winning file should be from canonical-source
      const skillFile = claudePayload!.files.find(
        (f) => f.relativePath === "skills/feature/SKILL.md",
      );
      expect(skillFile).toBeDefined();
      expect(skillFile!.origin).toBe("canonical-source");

      // Conflict should be recorded
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].relativePath).toBe("skills/feature/SKILL.md");
      expect(result.conflicts[0].winner).toBe("canonical-source");
    });

    it("includes all files when no conflicts exist", () => {
      const result = buildAssistantPayloads({
        targets: ["claude-code"],
        components: ["instructions", "skills"],
        externalFiles: [
          {
            relativePath: "skills/external-only/SKILL.md",
            sourcePath: "/tmp/external/skills/external-only/SKILL.md",
            component: "skills",
            origin: "external-source",
            executable: false,
          },
        ],
        canonicalFiles: [
          {
            relativePath: "CLAUDE.md",
            sourcePath: "/repo/.claude/CLAUDE.md",
            component: "instructions",
            origin: "canonical-source",
            executable: false,
          },
        ],
        projectionFiles: [],
      });

      const claudePayload = result.payloads.find((p) => p.homeId === "claude-home");
      expect(claudePayload!.files).toHaveLength(2);
      expect(result.conflicts).toHaveLength(0);
    });

    it("builds separate payloads for codex-home and agents-home", () => {
      const result = buildAssistantPayloads({
        targets: ["codex-cli"],
        components: ["instructions", "skills"],
        externalFiles: [],
        canonicalFiles: [],
        projectionFiles: [
          {
            relativePath: "AGENTS.md",
            sourcePath: "/repo/.codex/AGENTS.md",
            component: "instructions",
            origin: "target-projection",
            executable: false,
          },
          {
            relativePath: "skills/commit/SKILL.md",
            sourcePath: "/repo/.agents/skills/commit/SKILL.md",
            component: "skills",
            origin: "target-projection",
            executable: false,
          },
        ],
      });

      // Codex-home gets instructions (AGENTS.md)
      const codexPayload = result.payloads.find((p) => p.homeId === "codex-home");
      expect(codexPayload).toBeDefined();
      expect(codexPayload!.files.some((f) => f.relativePath === "AGENTS.md")).toBe(true);

      // Agents-home gets skills
      const agentsPayload = result.payloads.find((p) => p.homeId === "agents-home");
      expect(agentsPayload).toBeDefined();
      expect(agentsPayload!.files.some((f) => f.relativePath === "skills/commit/SKILL.md")).toBe(
        true,
      );
    });
  });
});
