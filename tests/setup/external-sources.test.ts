import { describe, it, expect } from "vitest";
import { planExternalFetches } from "../../src/setup/external-sources.js";
import type { ExternalSource } from "../../src/setup/manifest.js";

const SKILL_SOURCE: ExternalSource = {
  id: "test-skill",
  name: "Test Skill",
  kind: "skill",
  url: "https://github.com/example/test-skill",
  default: true,
  targets: ["claude-code"],
};

const MCP_SOURCE: ExternalSource = {
  id: "test-mcp",
  name: "Test MCP",
  kind: "mcp-server",
  url: "https://github.com/example/test-mcp",
  default: false,
  targets: ["claude-code"],
  requiresConfirmation: true,
};

describe("external-sources", () => {
  describe("planExternalFetches", () => {
    it("plans fetch for default fetchable sources", () => {
      const plan = planExternalFetches([SKILL_SOURCE, MCP_SOURCE], {
        targets: ["claude-code"],
        fetch: true,
      });

      // Skill source is default + fetchable
      expect(plan.planned).toHaveLength(1);
      expect(plan.planned[0].id).toBe("test-skill");

      // MCP source is skipped (next-steps-only)
      expect(plan.skipped).toHaveLength(1);
      expect(plan.skipped[0].id).toBe("test-mcp");
      expect(plan.skipped[0].reason).toContain("MCP");
    });

    it("skips all fetches when fetch is disabled", () => {
      const plan = planExternalFetches([SKILL_SOURCE], {
        targets: ["claude-code"],
        fetch: false,
      });

      expect(plan.planned).toHaveLength(0);
      expect(plan.skipped).toHaveLength(1);
      expect(plan.skipped[0].reason).toContain("disabled");
    });

    it("skips sources not targeting selected targets", () => {
      const plan = planExternalFetches([SKILL_SOURCE], {
        targets: ["codex-cli"],
        fetch: true,
      });

      expect(plan.planned).toHaveLength(0);
      expect(plan.skipped).toHaveLength(1);
      expect(plan.skipped[0].reason).toContain("target");
    });

    it("uses selectedIds when provided (overrides default flag)", () => {
      const NON_DEFAULT: ExternalSource = {
        ...SKILL_SOURCE,
        id: "non-default-skill",
        default: false,
      };
      const plan = planExternalFetches([SKILL_SOURCE, NON_DEFAULT], {
        targets: ["claude-code"],
        fetch: true,
        selectedIds: ["non-default-skill"],
      });

      expect(plan.planned.map((p) => p.id)).toEqual(["non-default-skill"]);
      const skippedDefault = plan.skipped.find((s) => s.id === "test-skill");
      expect(skippedDefault?.reason).toContain("Not selected");
    });

    it("empty selectedIds skips all sources", () => {
      const plan = planExternalFetches([SKILL_SOURCE], {
        targets: ["claude-code"],
        fetch: true,
        selectedIds: [],
      });

      expect(plan.planned).toHaveLength(0);
      expect(plan.skipped).toHaveLength(1);
      expect(plan.skipped[0].reason).toContain("Not selected");
    });
  });
});
