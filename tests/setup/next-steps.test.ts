import { describe, it, expect, afterEach, vi } from "vitest";
import {
  formatNextStepsSection,
  planConfigNextSteps,
  planInstallCommandNextSteps,
  planMachineRuleNextSteps,
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
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("self-hosted emits the exact claude mcp add command for claude-code", () => {
      vi.stubEnv("TOOLKIT_PLAN_ORIGIN", "https://plan.example.test");
      const steps = planVisualPlansNextSteps("self-hosted", ["claude-code"]);
      expect(steps).toHaveLength(1);
      expect(steps[0].description).toContain(
        "claude mcp add --transport http plan https://plan.example.test/_agent-native/mcp",
      );
    });

    it("self-hosted strips a trailing slash rather than doubling it", () => {
      vi.stubEnv("TOOLKIT_PLAN_ORIGIN", "https://plan.example.test/");
      const steps = planVisualPlansNextSteps("self-hosted", ["claude-code"]);
      expect(steps[0].description).toContain(
        "https://plan.example.test/_agent-native/mcp",
      );
      expect(steps[0].description).not.toContain("test//");
    });

    // The origin is machine-local, so a fresh clone has none. Say what to set
    // instead of printing a broken command with an empty host.
    it("self-hosted asks for the origin when the env var is unset", () => {
      vi.stubEnv("TOOLKIT_PLAN_ORIGIN", "");
      const steps = planVisualPlansNextSteps("self-hosted", ["claude-code"]);
      expect(steps).toHaveLength(1);
      expect(steps[0].description).toContain("TOOLKIT_PLAN_ORIGIN");
      expect(steps[0].description).not.toContain("mcp add");
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

  describe("planMachineRuleNextSteps", () => {
    it("nudges to copy TEMPLATE.md when the machine Variant's rule file is missing", () => {
      const steps = planMachineRuleNextSteps("work", false);
      expect(steps).toHaveLength(1);
      expect(steps[0].description).toContain("canonical/machines/work/rules.md");
      expect(steps[0].description).toContain("TEMPLATE.md");
    });

    it("emits no steps when the rule file exists", () => {
      expect(planMachineRuleNextSteps("server", true)).toEqual([]);
    });

    it("emits no steps when no machine Variant is set", () => {
      expect(planMachineRuleNextSteps(undefined, false)).toEqual([]);
    });
  });

  describe("planConfigNextSteps", () => {
    const healthy = {
      fileName: "knowledge-config.json",
      home: "~/.claude",
      exists: true,
      problems: [],
    };

    it("stays silent when every config is healthy — the run is the common case", () => {
      expect(planConfigNextSteps([healthy])).toEqual([]);
    });

    it("points at the example file when the live config is missing", () => {
      const steps = planConfigNextSteps([{ ...healthy, exists: false }]);
      expect(steps).toHaveLength(1);
      expect(steps[0].description).toContain("~/.claude/knowledge-config.json");
      expect(steps[0].description).toContain("knowledge-config.example.json");
    });

    it("names each problem in an existing config", () => {
      const steps = planConfigNextSteps([
        { ...healthy, problems: ["projectsIndex does not resolve", "profileTarget does not resolve"] },
      ]);
      expect(steps).toHaveLength(1);
      expect(steps[0].description).toContain("2 problem(s)");
      expect(steps[0].description).toContain("projectsIndex does not resolve");
      expect(steps[0].description).toContain("profileTarget does not resolve");
    });

    it("reports each Assistant Home separately so a drifted copy is visible", () => {
      const steps = planConfigNextSteps([
        healthy,
        { ...healthy, home: "~/.codex", exists: false },
      ]);
      expect(steps).toHaveLength(1);
      expect(steps[0].description).toContain("~/.codex");
    });
  });
});
