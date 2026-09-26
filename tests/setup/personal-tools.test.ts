import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildAssistantPayloads } from "../../src/setup/payload.js";
import { loadWiringManifest, planHookWiring } from "../../src/setup/hook-wiring.js";
import { loadPresets } from "../../src/setup/presets.js";
import type { PayloadFile } from "../../src/setup/domain.js";

// Personal-only pieces reach a machine only when its Preset opts in with
// `personal-tools: on`, so a new restricted or client machine never gets them.

const skill = (relativePath: string): PayloadFile => ({
  relativePath,
  sourcePath: `/repo/canonical/${relativePath}`,
  component: "skills",
  origin: "canonical-source",
  executable: false,
});
const files = [
  skill("skills/commit/SKILL.md"),
  skill("skills/ingest/SKILL.md"),
  skill("skills/loop-audit/SKILL.md"),
];
const installed = (variants: Record<string, string>, target: "claude-code" | "codex-cli") =>
  buildAssistantPayloads({
    targets: [target],
    components: ["skills"],
    externalFiles: [],
    canonicalFiles: target === "claude-code" ? files : [],
    projectionFiles: target === "codex-cli" ? files : [],
    variants,
  })
    .payloads.flatMap((p) => p.files.map((f) => f.relativePath))
    .sort();

describe("personal-tools Variant", () => {
  for (const target of ["claude-code", "codex-cli"] as const) {
    it(`${target}: personal-only skills install only when the machine opts in`, () => {
      expect(installed({}, target)).toEqual(["skills/commit/SKILL.md"]);
      expect(installed({ "personal-tools": "on" }, target)).toEqual([
        "skills/commit/SKILL.md",
        "skills/ingest/SKILL.md",
        "skills/loop-audit/SKILL.md",
      ]);
    });
  }

  it("wires the phone-notification hooks only when the machine opts in", async () => {
    const entries = await loadWiringManifest(path.join(process.cwd(), "canonical", "hooks"));
    const commands = (variants: Record<string, string>) =>
      planHookWiring(entries, { "claude-code": "/home/u/.claude" }, { variants, projectRoot: "/repo" })
        .flatMap((p) => p.actions.map((a) => a.command));

    expect(commands({}).filter((c) => /claude-notify|notify-activity/.test(c))).toEqual([]);
    expect(commands({ "personal-tools": "on" }).filter((c) => /claude-notify|notify-activity/.test(c))).toHaveLength(3);
  });

  it("opts in the personal Presets and leaves the work Preset out", async () => {
    const presets = await loadPresets(path.join(process.cwd(), "manifests", "presets.yaml"));
    expect(presets.personal.variants?.["personal-tools"]).toBe("on");
    expect(presets.mac.variants?.["personal-tools"]).toBe("on");
    expect(presets.work.variants?.["personal-tools"]).toBeUndefined();
  });
});
