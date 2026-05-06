import { describe, it, expect } from "vitest";
import { planMcpNextSteps } from "../../src/setup/mcp.js";
import type { ExternalSource } from "../../src/setup/manifest.js";

describe("mcp", () => {
  describe("planMcpNextSteps", () => {
    it("generates a secret-required Next Step for Context7", () => {
      const sources: ExternalSource[] = [
        {
          id: "context7",
          name: "Context7",
          kind: "mcp-server",
          url: "https://github.com/upstash/context7",
          default: false,
          targets: ["claude-code"],
          requiresConfirmation: true,
          requiredSecrets: ["CONTEXT7_API_KEY"],
        },
      ];

      const steps = planMcpNextSteps(sources);

      expect(steps).toHaveLength(1);
      expect(steps[0].description).toContain("CONTEXT7_API_KEY");
      expect(steps[0].kind).toBe("mcp-secret");
    });

    it("generates a confirmation Next Step for Playwright MCP", () => {
      const sources: ExternalSource[] = [
        {
          id: "playwright-mcp",
          name: "Playwright MCP",
          kind: "mcp-server",
          url: "https://github.com/microsoft/playwright-mcp",
          default: false,
          targets: ["claude-code"],
          requiresConfirmation: true,
        },
      ];

      const steps = planMcpNextSteps(sources);

      expect(steps).toHaveLength(1);
      expect(steps[0].description).toContain("Playwright MCP");
      expect(steps[0].kind).toBe("mcp-confirmation");
    });

    it("skips non-MCP sources", () => {
      const sources: ExternalSource[] = [
        {
          id: "test-skill",
          name: "Test Skill",
          kind: "skill",
          url: "https://github.com/example/test",
          default: true,
          targets: ["claude-code"],
        },
      ];

      const steps = planMcpNextSteps(sources);
      expect(steps).toHaveLength(0);
    });
  });
});
