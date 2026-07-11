import { describe, it, expect } from "vitest";
import {
  formatNextStepsSection,
  planInstallCommandNextSteps,
  planVisualPlansNextSteps,
} from "../../src/setup/next-steps.js";
import type { ExternalSource } from "../../src/setup/manifest.js";

const CAVEMAN_SOURCE: ExternalSource = {
  id: "caveman",
  name: "Caveman",
  kind: "plugin",
  url: "https://github.com/JuliusBrussee/caveman",
  default: true,
  targets: ["claude-code", "codex-cli"],
  installCommands: {
    "claude-code": [
      "claude plugin marketplace add JuliusBrussee/caveman",
      "claude plugin install caveman@caveman",
    ],
    "codex-cli": ["npx skills add JuliusBrussee/caveman -a codex"],
  },
};

describe("next-steps", () => {
  describe("planInstallCommandNextSteps", () => {
    it("surfaces native install commands for selected External Sources and Assistant Targets", () => {
      const steps = planInstallCommandNextSteps({
        sources: [CAVEMAN_SOURCE],
        selectedSourceIds: ["caveman"],
        targets: ["codex-cli"],
      });

      expect(steps).toEqual([
        {
          kind: "install-command",
          sourceId: "caveman",
          description:
            "Run native Caveman install for Codex CLI: npx skills add JuliusBrussee/caveman -a codex",
        },
      ]);
    });

    it("joins multi-command installs in command order", () => {
      const steps = planInstallCommandNextSteps({
        sources: [CAVEMAN_SOURCE],
        selectedSourceIds: ["caveman"],
        targets: ["claude-code"],
      });

      expect(steps[0].description).toBe(
        "Run native Caveman install for Claude Code: claude plugin marketplace add JuliusBrussee/caveman && claude plugin install caveman@caveman",
      );
    });

    it("skips unselected sources", () => {
      const steps = planInstallCommandNextSteps({
        sources: [CAVEMAN_SOURCE],
        selectedSourceIds: [],
        targets: ["codex-cli"],
      });

      expect(steps).toHaveLength(0);
    });
  });

  describe("formatNextStepsSection", () => {
    it("prints a visibly separated section", () => {
      const lines = formatNextStepsSection([
        {
          kind: "manual-action",
          description: "Run the native install command.",
        },
      ]);

      expect(lines).toEqual([
        "",
        "========================================",
        "Next Steps",
        "========================================",
        "  1. Run the native install command.",
        "========================================",
      ]);
    });
  });

  describe("planVisualPlansNextSteps", () => {
    it("self-hosted emits the exact claude mcp add command for claude-code", () => {
      const steps = planVisualPlansNextSteps("self-hosted", ["claude-code"]);
      expect(steps).toHaveLength(1);
      expect(steps[0].description).toContain(
        "claude mcp add --transport http plan https://plan.hestia.chrooks.com/_agent-native/mcp",
      );
    });

    it("local-files emits the env-var step and no MCP command", () => {
      const steps = planVisualPlansNextSteps("local-files", ["claude-code"]);
      expect(steps).toHaveLength(1);
      expect(steps[0].description).toContain(
        "AGENT_NATIVE_PLANS_MODE=local-files",
      );
      expect(steps[0].description).not.toContain("mcp add");
    });

    it("none emits no steps", () => {
      expect(planVisualPlansNextSteps("none", ["claude-code"])).toEqual([]);
    });
  });
});
