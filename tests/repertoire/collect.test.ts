import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  collectRepertoire,
  firesWhen,
  loadSkillMap,
  modeFromFrontmatter,
  parseSkillFile,
} from "../../src/repertoire/collect.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const claudeHome = path.join(here, "fixtures", "claude-home");
const toolkitRoot = path.resolve(here, "..", "..");
const skillFile = (name: string) => path.join(claudeHome, "skills", name, "SKILL.md");
const fixtureMap = path.join(here, "fixtures", "skill-map.yaml");
const realMap = path.join(toolkitRoot, "manifests", "skill-map.yaml");

function withMap(yaml: string, run: (file: string) => void): void {
  const dir = mkdtempSync(path.join(os.tmpdir(), "skill-map-"));
  try {
    const file = path.join(dir, "skill-map.yaml");
    writeFileSync(file, yaml);
    run(file);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("loadSkillMap", () => {
  it("loads the fixture map and the real map", () => {
    const map = loadSkillMap(fixtureMap);
    expect(Object.keys(map.categories)).toEqual(["Media", "Writing", "Modes"]);
    expect(map.lanes[0]).toEqual({ name: "Video load then trim", stages: ["watch-video", "ghost-skill", "cut-video"] });
    expect(map.neighbors[0]).toEqual({ a: "watch-video", b: "listen-audio", difference: "Video with scene frames vs audio only" });
    const real = loadSkillMap(realMap);
    expect(Object.keys(real.categories)).toContain("Media");
    expect(real.lanes.length).toBeGreaterThan(0);
  });

  it("rejects a malformed map with the file path and the bad field", () => {
    withMap("categories:\n  Media: watch-video\nlanes: []\nneighbors: []\n", (file) => {
      expect(() => loadSkillMap(file)).toThrow(/skill-map\.yaml[\s\S]*categories\.Media/);
    });
    withMap("categories: [unclosed\n", (file) => {
      expect(() => loadSkillMap(file)).toThrow(/skill-map\.yaml/);
    });
  });

  it("rejects a skill listed in two categories", () => {
    withMap("categories:\n  A: [plain]\n  B: [plain]\n", (file) => {
      expect(() => loadSkillMap(file)).toThrow(/plain.*more than one category/);
    });
  });
});

describe("parseSkillFile", () => {
  it("reads a one-line description and the body", async () => {
    const parsed = await parseSkillFile(skillFile("plain"));
    expect(parsed.frontmatter.name).toBe("plain");
    expect(parsed.frontmatter.description).toMatch(/^Summarize a long video transcript/);
    expect(parsed.body).toContain("# /plain");
  });

  it("reads a `|` block description as its full text", async () => {
    const parsed = await parseSkillFile(skillFile("multiline-pipe"));
    expect(parsed.frontmatter.description).toBe(
      "Draft release notes from merged commits.\nUse when the user says 'write release notes'.\n",
    );
  });

  it("reads a `>` block description folded onto one line", async () => {
    const parsed = await parseSkillFile(skillFile("multiline-folded"));
    expect(parsed.frontmatter.description).toBe("Sort a reading list by priority and due date.\n");
  });

  it("reads a plain one-line value that contains ': ', as Claude Code does", async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "skill-colon-"));
    try {
      const file = path.join(dir, "SKILL.md");
      writeFileSync(file, "---\nname: ingest\ndescription: Read it, then update the wiki: a summary page.\nargument-hint: \"[source: a path]\"\ndisable-model-invocation: false\n---\n\nBody\n");
      const parsed = await parseSkillFile(file);
      expect(parsed.frontmatter).toEqual({
        name: "ingest",
        description: "Read it, then update the wiki: a summary page.",
        "argument-hint": "[source: a path]",
        "disable-model-invocation": false,
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("throws on invalid YAML", async () => {
    await expect(parseSkillFile(skillFile("broken"))).rejects.toThrow();
  });
});

describe("modeFromFrontmatter", () => {
  it("maps the two flags to the three modes", () => {
    expect(modeFromFrontmatter({})).toBe("auto");
    expect(modeFromFrontmatter({ "disable-model-invocation": false })).toBe("auto");
    expect(modeFromFrontmatter({ "disable-model-invocation": true })).toBe("typed-only");
    expect(modeFromFrontmatter({ "user-invocable": false })).toBe("claude-only");
    expect(modeFromFrontmatter({ "user-invocable": true })).toBe("auto");
  });
});

describe("firesWhen", () => {
  it("takes the 'Use when' sentence", () => {
    expect(
      firesWhen("Summarize a long video transcript into bullet notes. Use when the user asks for a summary of notes. Keeps the source language."),
    ).toBe("Use when the user asks for a summary of notes.");
  });

  it("falls back to the whole description", () => {
    expect(firesWhen("Internal helper contract for formatting tool output.")).toBe(
      "Internal helper contract for formatting tool output.",
    );
  });
});

describe("collectRepertoire", () => {
  const collect = () =>
    collectRepertoire({
      claudeHome,
      toolkitRoot,
      skillMap: loadSkillMap(fixtureMap),
      machine: "test-box",
      now: new Date("2026-09-21T12:00:00Z"),
    });

  it("returns every readable skill and records the unreadable one", async () => {
    const rep = await collect();
    expect(rep.skills.map((s) => s.name).sort()).toEqual(
      ["claude-only", "cut-video", "desktop-only", "listen-audio", "multiline-folded", "multiline-pipe", "plain", "plugin-only", "script-tag", "typed-only", "watch-video"],
    );
    expect(rep.unreadable).toHaveLength(1);
    expect(rep.unreadable[0]).toMatchObject({ name: "broken", path: skillFile("broken") });
    expect(rep.unreadable[0]!.error).not.toBe("");
    expect(rep.machine).toBe("test-box");
    expect(rep.generatedAt).toBe("2026-09-21T12:00:00.000Z");
  });

  it("marks a skill as mine when discoverSkillDirs finds it in canonical/", async () => {
    const rep = await collect();
    const byName = new Map(rep.skills.map((s) => [s.name, s]));
    expect(byName.get("watch-video")!.source).toBe("own");
    expect(byName.get("listen-audio")!.source).toBe("own");
    expect(byName.get("plain")!.source).toBe("pulled");
    expect(rep.counts).toEqual({ total: 12, own: 3, pulled: 6, plugin: 1, desktop: 1 });
  });

  it("carries mode, argument hint, fires-when, and the raw body", async () => {
    const rep = await collect();
    const byName = new Map(rep.skills.map((s) => [s.name, s]));
    expect(byName.get("typed-only")!.mode).toBe("typed-only");
    expect(byName.get("claude-only")!.mode).toBe("claude-only");
    expect(byName.get("cut-video")!.mode).toBe("auto");
    expect(byName.get("multiline-folded")!.argumentHint).toBe("<path to list>");
    expect(byName.get("plain")!.argumentHint).toBeNull();
    expect(byName.get("multiline-pipe")!.firesWhen).toBe("Use when the user says 'write release notes'.");
    expect(byName.get("script-tag")!.body).toContain("</script>");
  });

  it("lists an enabled plugin's skills and desktop-only skills, each duplicate once as the skills/ copy", async () => {
    const rep = await collect();
    const byName = new Map(rep.skills.map((s) => [s.name, s]));
    expect(byName.get("plugin-only")).toMatchObject({ source: "plugin", origin: "fixture-tools@fixtures" });
    expect(byName.get("plugin-only")!.path).toBe(
      path.join(claudeHome, "plugins", "cache", "fixture-tools", "1.0.0", "skills", "plugin-only", "SKILL.md"),
    );
    expect(byName.get("desktop-only")).toMatchObject({ source: "desktop", origin: "desktop app" });
    expect(rep.skills.filter((s) => s.name === "plain")).toHaveLength(1);
    expect(byName.get("plain")).toMatchObject({ source: "pulled", origin: null, path: skillFile("plain") });
    expect(byName.has("disabled-only")).toBe(false);
  });

  it("puts each skill in its map category, in map order, and the rest under Uncategorized", async () => {
    const rep = await collect();
    expect(rep.categories).toEqual(["Media", "Writing", "Modes", "Uncategorized"]);
    expect(rep.skills.map((s) => `${s.category}/${s.name}`)).toEqual([
      "Media/watch-video", "Media/cut-video", "Media/listen-audio",
      "Writing/plain", "Writing/multiline-pipe", "Writing/script-tag",
      "Modes/typed-only", "Modes/claude-only",
      "Uncategorized/desktop-only", "Uncategorized/multiline-folded", "Uncategorized/plugin-only",
    ]);
    const byName = new Map(rep.skills.map((s) => [s.name, s]));
    expect(byName.get("plugin-only")!.uncategorized).toBe(true);
    expect(byName.get("watch-video")!.uncategorized).toBe(false);
  });

  it("skips map names that are not installed, in lanes and neighbors too", async () => {
    const rep = await collect();
    expect(rep.skills.some((s) => s.name === "ghost-skill")).toBe(false);
    expect(rep.lanes).toEqual([
      { name: "Video load then trim", stages: ["watch-video", "cut-video"] },
      { name: "Audio then video", stages: ["listen-audio", "watch-video", "cut-video"] },
    ]);
    expect(rep.neighbors).toEqual([
      { a: "watch-video", b: "listen-audio", difference: "Video with scene frames vs audio only" },
      { a: "cut-video", b: "watch-video", difference: "Trims and joins a video vs loads one to discuss" },
    ]);
  });

  it("works without settings.json, plugins, or synced/", async () => {
    const empty = mkdtempSync(path.join(os.tmpdir(), "claude-home-"));
    try {
      const rep = await collectRepertoire({ claudeHome: empty, toolkitRoot, skillMap: loadSkillMap(fixtureMap), machine: "m", now: new Date() });
      expect(rep.skills).toEqual([]);
      expect(rep.counts.total).toBe(0);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });
});
