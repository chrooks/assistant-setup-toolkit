import { describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  collectRepertoire,
  firesWhen,
  modeFromFrontmatter,
  parseSkillFile,
} from "../../src/repertoire/collect.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const claudeHome = path.join(here, "fixtures", "claude-home");
const toolkitRoot = path.resolve(here, "..", "..");
const skillFile = (name: string) => path.join(claudeHome, "skills", name, "SKILL.md");

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
    collectRepertoire({ claudeHome, toolkitRoot, machine: "test-box", now: new Date("2026-09-21T12:00:00Z") });

  it("returns every readable skill and records the unreadable one", async () => {
    const rep = await collect();
    expect(rep.skills.map((s) => s.name).sort()).toEqual(
      ["claude-only", "cut-video", "listen-audio", "multiline-folded", "multiline-pipe", "plain", "script-tag", "typed-only", "watch-video"],
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
    expect(rep.counts).toEqual({ total: 10, own: 3, pulled: 6, plugin: 0, desktop: 0 });
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
});
