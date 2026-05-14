import { describe, it, expect } from "vitest";
import {
  formatNextStepsSection,
  planInstallCommandNextSteps,
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
});
