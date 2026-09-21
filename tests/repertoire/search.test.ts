import { beforeAll, describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collectRepertoire, type SkillEntry } from "../../src/repertoire/collect.js";
import { search } from "../../src/repertoire/search.js";

const here = path.dirname(fileURLToPath(import.meta.url));
let skills: SkillEntry[];

beforeAll(async () => {
  const rep = await collectRepertoire({
    claudeHome: path.join(here, "fixtures", "claude-home"),
    toolkitRoot: path.resolve(here, "..", ".."),
    machine: "test-box",
    now: new Date(),
  });
  skills = rep.skills;
});

const names = (list: SkillEntry[]) => list.map((s) => s.name);

describe("search", () => {
  it("'watch a video' ranks name matches first, then what-it-does matches, with weak ones apart", () => {
    const result = search("watch a video", skills);
    expect(names(result.nameMatches)).toEqual(["watch-video", "cut-video"]);
    expect(names(result.intentMatches)).toEqual(["listen-audio"]);
    expect(names(result.weak)).toEqual(["plain"]);
    expect(result.nameMatches.length + result.intentMatches.length).toBeLessThan(15);
  });

  it("drops stopwords and words under three letters", () => {
    expect(search("the a of", skills)).toEqual({ nameMatches: [], intentMatches: [], weak: [] });
    expect(names(search("the video", skills).nameMatches).sort()).toEqual(["cut-video", "watch-video"]);
  });

  it("'bake sourdough' matches nothing, not even weakly", () => {
    expect(search("bake sourdough", skills)).toEqual({ nameMatches: [], intentMatches: [], weak: [] });
  });

  it("a partial query that matches nothing fully returns only weak matches", () => {
    const result = search("transcribe sourdough", skills);
    expect(result.nameMatches).toEqual([]);
    expect(result.intentMatches).toEqual([]);
    expect(names(result.weak)).toEqual(["listen-audio"]);
  });

  it("matches case-insensitively and by word prefix", () => {
    expect(names(search("TRANSCRIB", skills).intentMatches)).toContain("listen-audio");
  });
});
