// Builds the skills page from this machine's real ~/.claude with `npm run skills`
// and drives it in headless Chromium. Skips where ~/.claude or Chromium is missing.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium, type Browser, type Page } from "playwright-core";
import { collectRepertoire, loadSkillMap } from "../../src/repertoire/collect.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const claudeHome = path.join(os.homedir(), ".claude");
const hasChromium = existsSync(chromium.executablePath());
const hasClaudeHome = existsSync(path.join(claudeHome, "skills"));
if (!hasChromium) console.log(`real-build.e2e skipped: no Chromium at ${chromium.executablePath()}`);
if (!hasClaudeHome) console.log(`real-build.e2e skipped: no skills folder at ${path.join(claudeHome, "skills")}`);

describe.skipIf(!hasChromium || !hasClaudeHome)("skills page (this machine's real skills)", () => {
  let tmp: string;
  let browser: Browser;
  let page: Page;
  let expectedTotal: number;

  beforeAll(async () => {
    tmp = mkdtempSync(path.join(os.tmpdir(), "repertoire-real-"));
    const out = path.join(tmp, "index.html");
    // SSH_CONNECTION keeps the build from opening a browser window.
    const build = spawnSync("npm", ["run", "--silent", "skills", "--", "--out", out], {
      cwd: repoRoot,
      encoding: "utf8",
      env: { ...process.env, SSH_CONNECTION: "test" },
    });
    if (build.status !== 0) throw new Error(`npm run skills failed: ${build.stderr}`);
    expect(build.stdout.split("\n")[0]).toBe(out);

    const rep = await collectRepertoire({
      claudeHome,
      toolkitRoot: repoRoot,
      skillMap: loadSkillMap(path.join(repoRoot, "manifests", "skill-map.yaml")),
      machine: os.hostname(),
      now: new Date(),
    });
    expectedTotal = rep.counts.total;

    browser = await chromium.launch({ headless: true });
    page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(pathToFileURL(out).href);
    await page.waitForSelector("#result-listbox .r");
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  it("lists every skill the collector finds", async () => {
    expect(await page.$$eval("#result-listbox .r", (n) => n.length)).toBe(expectedTotal);
    expect(await page.textContent("#filter-status-text")).toBe(`Showing ${expectedTotal} of ${expectedTotal}`);
  });

  it("reads each mode from real frontmatter", async () => {
    expect(await page.textContent("#row-to-questionnaire .m")).toBe("typed only");
    expect(await page.textContent("#row-consult .m")).toBe("Claude only");
  });

  it("'watch a video' puts /watch-video first", async () => {
    await page.fill("#search-input", "watch a video");
    expect(await page.textContent("#results-name-group .r .nm")).toBe("/watch-video");
    await page.fill("#search-input", "");
  });
});
