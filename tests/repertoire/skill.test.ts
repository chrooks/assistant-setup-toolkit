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

  it("looks for a running repertoire server on every port before starting one", () => {
    // A single ordered scan starts a second server on 4747 the moment another service frees it,
    // while the real one keeps running on 4748. Reuse must be a full first pass.
    const find = skill.indexOf("First pass");
    const start = skill.indexOf("Second pass");
    expect(find).toBeGreaterThan(-1);
    expect(start).toBeGreaterThan(find);
    expect(skill.slice(find, start)).toMatch(/every port from 4747 through 4757/);
  });
});
