import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  loadWiringManifest,
  planHookWiring,
  applyHookWiring,
  type WiringEntry,
  type WiringPlan,
} from "../../src/setup/hook-wiring.js";

/**
 * Spin up an isolated temp dir per test so filesystem state never leaks
 * between cases. Returned path is gone after the next test starts.
 */
async function makeTempDir(label: string): Promise<string> {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), `hook-wiring-${label}-`));
  return base;
}

describe("hook-wiring", () => {
  describe("loadWiringManifest", () => {
    it("returns an empty list when the manifest file is absent", async () => {
      const dir = await makeTempDir("absent");
      const entries = await loadWiringManifest(dir);
      expect(entries).toEqual([]);
    });

    it("parses a valid manifest with a single entry", async () => {
      const dir = await makeTempDir("valid");
      const yaml = [
        "version: 1",
        "hooks:",
        "  - file: lexicon-reminder.sh",
        "    event: UserPromptSubmit",
        "    targets: [claude-code, codex-cli]",
        "",
      ].join("\n");
      await fs.writeFile(path.join(dir, "wiring.yaml"), yaml, "utf-8");

      const entries = await loadWiringManifest(dir);
      expect(entries).toHaveLength(1);
      expect(entries[0].file).toBe("lexicon-reminder.sh");
      expect(entries[0].event).toBe("UserPromptSubmit");
      expect(entries[0].targets).toEqual(["claude-code", "codex-cli"]);
    });

    it("rejects a malformed manifest with a clear error mentioning the path", async () => {
      const dir = await makeTempDir("invalid");
      const yaml = ["version: 99", "hooks:", "  - notAField: bad", ""].join(
        "\n",
      );
      await fs.writeFile(path.join(dir, "wiring.yaml"), yaml, "utf-8");

      await expect(loadWiringManifest(dir)).rejects.toThrow(/wiring\.yaml/);
    });
  });

  describe("planHookWiring", () => {
    const entries: WiringEntry[] = [
      {
        file: "lexicon-reminder.sh",
        event: "UserPromptSubmit",
        targets: ["claude-code", "codex-cli"],
      },
    ];

    it("produces a Claude Code plan with no feature-flag assertion", () => {
      const plans = planHookWiring(entries, {
        "claude-code": "/home/u/.claude",
      });

      expect(plans).toHaveLength(1);
      const claudePlan = plans[0];
      expect(claudePlan.target).toBe("claude-code");
      expect(claudePlan.settingsPath).toBe("/home/u/.claude/settings.json");
      expect(claudePlan.actions).toHaveLength(1);
      expect(claudePlan.actions[0].command).toBe(
        "bash /home/u/.claude/hooks/lexicon-reminder.sh",
      );
      expect(claudePlan.featureFlag).toBeUndefined();
    });

    it("produces a Codex plan with the codex_hooks feature-flag assertion", () => {
      const plans = planHookWiring(entries, { "codex-cli": "/home/u/.codex" });

      expect(plans).toHaveLength(1);
      const codexPlan = plans[0];
      expect(codexPlan.settingsPath).toBe("/home/u/.codex/hooks.json");
      expect(codexPlan.featureFlag).toEqual({
        tomlPath: "/home/u/.codex/config.toml",
        section: "features",
        key: "codex_hooks",
        value: true,
      });
    });

    it("skips targets that are not in the home map", () => {
      const plans = planHookWiring(entries, {
        "claude-code": "/home/u/.claude",
      });
      // Codex was not provided as a home — it must not appear in the plans
      expect(plans.every((p) => p.target !== "codex-cli")).toBe(true);
    });

    it("honors a custom command template with {hook} substitution", () => {
      const customEntries: WiringEntry[] = [
        {
          file: "x.sh",
          event: "UserPromptSubmit",
          targets: ["claude-code"],
          command: "/usr/bin/env bash -lc 'exec {hook}'",
        },
      ];
      const plans = planHookWiring(customEntries, {
        "claude-code": "/home/u/.claude",
      });
      expect(plans[0].actions[0].command).toBe(
        "/usr/bin/env bash -lc 'exec /home/u/.claude/hooks/x.sh'",
      );
    });
  });

  describe("applyHookWiring", () => {
    let homeDir: string;
    let plan: WiringPlan;

    beforeEach(async () => {
      homeDir = await makeTempDir("apply");
      plan = {
        target: "claude-code",
        settingsPath: path.join(homeDir, "settings.json"),
        actions: [
          {
            target: "claude-code",
            settingsPath: path.join(homeDir, "settings.json"),
            event: "UserPromptSubmit",
            command: `bash ${homeDir}/hooks/lexicon-reminder.sh`,
          },
        ],
      };
    });

    it("creates a fresh settings.json when none exists", async () => {
      const result = await applyHookWiring(plan);
      expect(result.added).toBe(1);
      expect(result.alreadyPresent).toBe(0);

      const written = JSON.parse(
        await fs.readFile(plan.settingsPath, "utf-8"),
      );
      expect(written.hooks.UserPromptSubmit).toHaveLength(1);
      expect(written.hooks.UserPromptSubmit[0].hooks[0].command).toBe(
        plan.actions[0].command,
      );
    });

    it("is idempotent — running twice produces exactly one entry", async () => {
      await applyHookWiring(plan);
      const second = await applyHookWiring(plan);

      expect(second.added).toBe(0);
      expect(second.alreadyPresent).toBe(1);

      const written = JSON.parse(
        await fs.readFile(plan.settingsPath, "utf-8"),
      );
      expect(written.hooks.UserPromptSubmit).toHaveLength(1);
    });

    it("preserves unrelated existing hooks", async () => {
      // Pre-populate settings.json with a different SessionStart hook
      const initial = {
        hooks: {
          SessionStart: [
            {
              hooks: [
                {
                  type: "command",
                  command: "bash ~/.claude/hooks/session-mode-loader.sh",
                },
              ],
            },
          ],
        },
      };
      await fs.writeFile(
        plan.settingsPath,
        JSON.stringify(initial, null, 2),
        "utf-8",
      );

      const result = await applyHookWiring(plan);
      expect(result.added).toBe(1);

      const written = JSON.parse(
        await fs.readFile(plan.settingsPath, "utf-8"),
      );
      expect(written.hooks.SessionStart).toHaveLength(1);
      expect(written.hooks.UserPromptSubmit).toHaveLength(1);
      // SessionStart hook untouched
      expect(written.hooks.SessionStart[0].hooks[0].command).toBe(
        "bash ~/.claude/hooks/session-mode-loader.sh",
      );
    });

    it("dryRun computes counts without touching the filesystem", async () => {
      const result = await applyHookWiring(plan, { dryRun: true });
      expect(result.added).toBe(1);

      // settings.json must not have been created
      await expect(fs.access(plan.settingsPath)).rejects.toThrow();
    });

    describe("TOML feature-flag assertion", () => {
      let codexPlan: WiringPlan;

      beforeEach(async () => {
        homeDir = await makeTempDir("toml");
        codexPlan = {
          target: "codex-cli",
          settingsPath: path.join(homeDir, "hooks.json"),
          actions: [
            {
              target: "codex-cli",
              settingsPath: path.join(homeDir, "hooks.json"),
              event: "UserPromptSubmit",
              command: `bash ${homeDir}/hooks/lexicon-reminder.sh`,
            },
          ],
          featureFlag: {
            tomlPath: path.join(homeDir, "config.toml"),
            section: "features",
            key: "codex_hooks",
            value: true,
          },
        };
      });

      it("appends a [features] block when config.toml is absent", async () => {
        const result = await applyHookWiring(codexPlan);
        expect(result.flagAdded).toBe(true);

        const toml = await fs.readFile(codexPlan.featureFlag!.tomlPath, "utf-8");
        expect(toml).toMatch(/^\[features\]$/m);
        expect(toml).toMatch(/^codex_hooks\s*=\s*true$/m);
      });

      it("inserts under existing [features] without duplicating the section", async () => {
        const initial = [
          "model = \"gpt-5.5\"",
          "",
          "[features]",
          "some_other_flag = true",
          "",
        ].join("\n");
        await fs.writeFile(
          codexPlan.featureFlag!.tomlPath,
          initial,
          "utf-8",
        );

        const result = await applyHookWiring(codexPlan);
        expect(result.flagAdded).toBe(true);

        const toml = await fs.readFile(codexPlan.featureFlag!.tomlPath, "utf-8");
        const featuresHeaderCount = (toml.match(/^\[features\]$/gm) ?? [])
          .length;
        expect(featuresHeaderCount).toBe(1);
        expect(toml).toMatch(/^codex_hooks\s*=\s*true$/m);
        expect(toml).toMatch(/^some_other_flag\s*=\s*true$/m);
      });

      it("is idempotent — running twice does not duplicate the flag", async () => {
        await applyHookWiring(codexPlan);
        const second = await applyHookWiring(codexPlan);

        expect(second.flagAdded).toBe(false);

        const toml = await fs.readFile(codexPlan.featureFlag!.tomlPath, "utf-8");
        const flagCount = (toml.match(/^codex_hooks\s*=/gm) ?? []).length;
        expect(flagCount).toBe(1);
      });
    });
  });
});
