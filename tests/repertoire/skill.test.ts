import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const skill = readFileSync(path.resolve(here, "..", "..", "canonical", "skills", "repertoire", "SKILL.md"), "utf8");

describe("/repertoire skill text", () => {
  it("runs npm silently, so the first stdout line is the page path and not npm's banner", () => {
    expect(skill).toContain("npm run -s skills");
    expect(skill).not.toMatch(/`npm run skills`\.?\s*$/m);
  });

  it("says what to do when a started server never comes up", () => {
    expect(skill).toMatch(/never shows `id="repertoire-data"`/);
  });
});
