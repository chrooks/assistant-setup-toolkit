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
            sourcePath: "/repo/canonical/skills/feature/SKILL.md",
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
            sourcePath: "/repo/canonical/CLAUDE.md",
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

    it("routes rules to codex-home for codex-cli", () => {
      const result = buildAssistantPayloads({
        targets: ["codex-cli"],
        components: ["rules"],
        externalFiles: [],
        canonicalFiles: [],
        projectionFiles: [
          {
            relativePath: "rules/python/database.md",
            sourcePath: "/repo/.codex/rules/python/database.md",
            component: "rules",
            origin: "target-projection",
            executable: false,
          },
        ],
      });

      const codexPayload = result.payloads.find((p) => p.homeId === "codex-home");
      expect(codexPayload).toBeDefined();
      expect(
        codexPayload!.files.some((f) => f.relativePath === "rules/python/database.md"),
      ).toBe(true);
    });

    it("routes rules to claude-home for claude-code", () => {
      const result = buildAssistantPayloads({
        targets: ["claude-code"],
        components: ["rules"],
        externalFiles: [],
        canonicalFiles: [
          {
            relativePath: "rules/python/database.md",
            sourcePath: "/repo/canonical/rules/python/database.md",
            component: "rules",
            origin: "canonical-source",
            executable: false,
          },
        ],
        projectionFiles: [],
      });

      const claudePayload = result.payloads.find((p) => p.homeId === "claude-home");
      expect(claudePayload).toBeDefined();
      expect(
        claudePayload!.files.some((f) => f.relativePath === "rules/python/database.md"),
      ).toBe(true);
    });

    it("routes config to the codex-home ROOT for codex-cli", () => {
      const result = buildAssistantPayloads({
        targets: ["codex-cli"],
        components: ["config"],
        externalFiles: [],
        canonicalFiles: [],
        projectionFiles: [
          {
            relativePath: "knowledge-config.example.json",
            sourcePath: "/repo/.codex/knowledge-config.example.json",
            component: "config",
            origin: "target-projection",
            executable: false,
          },
        ],
      });

      const codexPayload = result.payloads.find((p) => p.homeId === "codex-home");
      expect(codexPayload).toBeDefined();
      // Lands at the home root — no config/ path segment.
      expect(
        codexPayload!.files.some(
          (f) => f.relativePath === "knowledge-config.example.json",
        ),
      ).toBe(true);
    });

    it("routes config to the claude-home ROOT for claude-code", () => {
      const result = buildAssistantPayloads({
        targets: ["claude-code"],
        components: ["config"],
        externalFiles: [],
        canonicalFiles: [
          {
            relativePath: "knowledge-config.example.json",
            sourcePath: "/repo/canonical/config/knowledge-config.example.json",
            component: "config",
            origin: "canonical-source",
            executable: false,
          },
        ],
        projectionFiles: [],
      });

      const claudePayload = result.payloads.find((p) => p.homeId === "claude-home");
      expect(claudePayload).toBeDefined();
      expect(
        claudePayload!.files.some(
          (f) => f.relativePath === "knowledge-config.example.json",
        ),
      ).toBe(true);
    });

    it("excludes visual-plan skills when the visual-plans Variant is none", () => {
      const skill = (relativePath: string): PayloadFile => ({
        relativePath,
        sourcePath: `/repo/canonical/${relativePath}`,
        component: "skills",
        origin: "canonical-source",
        executable: false,
      });
      const result = buildAssistantPayloads({
        targets: ["claude-code"],
        components: ["skills"],
        externalFiles: [],
        canonicalFiles: [
          skill("skills/visual-plan/SKILL.md"),
          skill("skills/visual-recap/SKILL.md"),
          skill("skills/visualize/SKILL.md"),
        ],
        projectionFiles: [],
        variants: { "visual-plans": "none" },
      });

      const files = result.payloads[0].files.map((f) => f.relativePath);
      expect(files).toEqual(["skills/visualize/SKILL.md"]);
    });

    it("includes visual-plan skills for the self-hosted Variant", () => {
      const result = buildAssistantPayloads({
        targets: ["claude-code"],
        components: ["skills"],
        externalFiles: [],
        canonicalFiles: [
          {
            relativePath: "skills/visual-plan/SKILL.md",
            sourcePath: "/repo/canonical/skills/visual-plan/SKILL.md",
            component: "skills",
            origin: "canonical-source",
            executable: false,
          },
        ],
        projectionFiles: [],
        variants: { "visual-plans": "self-hosted" },
      });

      expect(result.payloads[0].files).toHaveLength(1);
    });
  });
});
