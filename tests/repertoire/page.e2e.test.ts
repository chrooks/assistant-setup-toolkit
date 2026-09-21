// Drives the built skills page in headless Chromium. Builds from the fixture
// ~/.claude home with the real `npm run skills` script.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium, type Browser, type Page } from "playwright-core";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const hasChromium = existsSync(chromium.executablePath());
if (!hasChromium) {
  console.log(`page.e2e skipped: no Chromium at ${chromium.executablePath()} (playwright-core 1.62.1 expects revision 1234)`);
}

describe.skipIf(!hasChromium)("skills page (fixture build)", () => {
  let tmp: string;
  let url: string;
  let stdout: string;
  let stderr: string;
  let browser: Browser;
  let page: Page;
  const dialogs: string[] = [];

  beforeAll(async () => {
    tmp = mkdtempSync(path.join(os.tmpdir(), "repertoire-"));
    const out = path.join(tmp, "index.html");
    const build = spawnSync(
      path.join(repoRoot, "node_modules", ".bin", "tsx"),
      [
        "scripts/skills-page.ts",
        "--claude-home", path.join(here, "fixtures", "claude-home"),
        "--skill-map", path.join(here, "fixtures", "skill-map.yaml"),
        "--out", out,
      ],
      // SSH_CONNECTION keeps the build from opening a browser window.
      { cwd: repoRoot, encoding: "utf8", env: { ...process.env, SSH_CONNECTION: "test" } },
    );
    if (build.status !== 0) throw new Error(`build failed: ${build.stderr}`);
    stdout = build.stdout;
    stderr = build.stderr;
    url = pathToFileURL(out).href;
    browser = await chromium.launch({ headless: true });
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  const open = async (hash = "") => {
    page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on("dialog", (dialog) => {
      dialogs.push(dialog.message());
      void dialog.dismiss();
    });
    await page.goto(url + hash);
    await page.waitForSelector("#result-listbox .r");
    return page;
  };
  const activeId = () => page.evaluate(() => document.activeElement?.id);
  const rowNames = (selector: string) =>
    page.$$eval(`${selector} .r .nm`, (nodes) => nodes.map((n) => n.textContent));

  it("prints the path, then the remote line", () => {
    expect(stdout.trim().split("\n")).toEqual([path.join(tmp, "index.html"), "Remote session — use /repertoire for a link."]);
  });

  it("focuses the search box on load; '/' and Ctrl+K bring focus back", async () => {
    await open();
    expect(await activeId()).toBe("search-input");
    expect(await page.$eval("label[for=search-input]", (n) => n.textContent)).toBe("What are you trying to do?");
    await page.evaluate(() => (document.activeElement as HTMLElement).blur());
    expect(await activeId()).not.toBe("search-input");
    await page.keyboard.press("/");
    expect(await activeId()).toBe("search-input");
    expect(await page.inputValue("#search-input")).toBe("");
    await page.evaluate(() => (document.activeElement as HTMLElement).blur());
    await page.keyboard.press("Control+k");
    expect(await activeId()).toBe("search-input");
    await page.close();
  });

  it("names the unreadable and Uncategorized skills on stderr", () => {
    expect(stderr).toMatch(/Couldn't read broken \(.*skills\/broken\/SKILL\.md\)/);
    expect(stderr).toContain("Uncategorized (add to manifests/skill-map.yaml): desktop-only, multiline-folded, plugin-only");
  });

  it("shows every skill with an empty search, the stamp, and the script-tag skill intact", async () => {
    await open();
    expect(await page.$$eval("#result-listbox .r", (n) => n.length)).toBe(12);
    expect(await page.textContent("#filter-status-text")).toBe("Showing 12 of 12");
    expect(dialogs).toEqual([]);
    expect(await page.textContent("#row-script-tag .desc")).toBe(
      "Embed a chart with <script>alert(1)</script> markup and keep </script> text intact.",
    );
    const stamp = await page.textContent("#machine-stamp");
    expect(stamp).toContain(`Machine: ${os.hostname()}`);
    expect(stamp).toContain("Built:");
    expect(await page.textContent("#machine-stamp-counts")).toBe("3 mine · 6 pulled in · 1 plugin · 1 desktop");
    await page.close();
  });

  it("'watch a video' groups name matches, then what-it-does matches, with weaker ones behind a button", async () => {
    await open();
    await page.fill("#search-input", "watch a video");
    expect(await rowNames("#results-name-group")).toEqual(["/watch-video", "/cut-video"]);
    expect(await rowNames("#results-intent-group")).toContain("/listen-audio");
    expect(await page.$$eval("#result-listbox .r", (n) => n.length)).toBeLessThan(15);
    expect(await page.textContent("#filter-status-text")).toBe('Showing 3 of 12 · "watch a video"');
    expect(await page.getAttribute("#filter-status", "aria-live")).toBe("polite");
    expect(await page.textContent("#more-matches")).toBe("Show 1 weaker match");
    expect(page.url()).toContain("#q=watch%20a%20video");
    await page.click("#more-matches");
    expect(await rowNames("#results-weak-group")).toEqual(["/plain"]);
    expect(await page.isHidden("#more-matches")).toBe(true);
    await page.close();
  });

  it("arrow keys move the active option, Enter opens it, Esc clears", async () => {
    await open();
    await page.fill("#search-input", "watch a video");
    await page.keyboard.press("ArrowDown");
    expect(await page.getAttribute("#result-listbox", "aria-activedescendant")).toBe("row-watch-video");
    await page.keyboard.press("ArrowDown");
    expect(await page.getAttribute("#result-listbox", "aria-activedescendant")).toBe("row-cut-video");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("Enter");
    expect(await page.textContent("#detail-name")).toBe("/watch-video");
    expect(await page.textContent("#detail-description")).toMatch(/^Load a video into context/);
    await page.keyboard.press("Escape");
    expect(await page.inputValue("#search-input")).toBe("");
    expect(await page.$$eval("#result-listbox .r", (n) => n.length)).toBe(12);
    await page.close();
  });

  it("a query with no match shows the message, Browse all, and the pointer, without a weak list", async () => {
    await open();
    await page.fill("#search-input", "bake sourdough");
    expect(await page.textContent("#no-results-message")).toBe("No skill matches 'bake sourdough'");
    expect(await page.textContent("#no-results-pointer")).toBe("/find-skills looks beyond your toolkit · /toolkit makes a new one");
    expect(await page.isHidden("#no-results-weak")).toBe(true);
    expect(await page.isVisible("#browse-all")).toBe(true);
    await page.fill("#search-input", "transcribe sourdough");
    expect(await rowNames("#no-results-weak")).toEqual(["/listen-audio"]);
    expect(await page.textContent("#no-results-weak .gh")).toContain("Weak matches");
    await page.click("#browse-all");
    expect(await page.inputValue("#search-input")).toBe("");
    expect(await page.$$eval("#result-listbox .r", (n) => n.length)).toBe(12);
    await page.close();
  });

  it("prefills the search from #q=", async () => {
    await open("#q=watch%20a%20video");
    expect(await page.inputValue("#search-input")).toBe("watch a video");
    expect(await rowNames("#results-name-group")).toEqual(["/watch-video", "/cut-video"]);
    await page.close();
  });

  const rowCount = () => page.$$eval("#result-listbox .r", (n) => n.length);
  const pressed = (id: string) => page.getAttribute(`#${id}`, "aria-pressed");

  it("groups the empty-search catalog by category, then Uncategorized, then Couldn't read", async () => {
    await open();
    expect(await page.$$eval("#result-listbox > .grp", (n) => n.map((g) => g.id))).toEqual([
      "group-media", "group-writing", "group-modes", "group-uncategorized", "group-couldnt-read",
    ]);
    expect(await page.textContent("#group-media .gh")).toBe("Media3 · 3 mine · 0 pulled in");
    expect(await rowNames("#group-media")).toEqual(["/watch-video", "/cut-video", "/listen-audio"]);
    expect(await rowNames("#group-uncategorized")).toEqual(["/desktop-only", "/multiline-folded", "/plugin-only"]);
    expect(await page.textContent("#row-plugin-only .src")).toBe("plugin");
    expect(await page.getAttribute("#row-plugin-only .src", "title")).toBe("fixture-tools@fixtures");
    expect(await page.textContent("#row-desktop-only .src")).toBe("desktop");
    expect(await page.textContent("#row-typed-only .m")).toBe("typed only");
    expect(await page.textContent("#row-claude-only .m")).toBe("Claude only");
    expect(await page.textContent("#row-broken .desc")).toContain(path.join("skills", "broken", "SKILL.md"));
    await page.click("#row-broken");
    expect(await page.textContent("#detail-crumb")).toBe("All › Couldn't read › broken");
    expect(await page.textContent("#detail-description")).toContain(path.join("skills", "broken", "SKILL.md"));
    await page.close();
  });

  it("the category list narrows the list and shows mine · pulled counts", async () => {
    await open();
    expect(await page.textContent("#category-all")).toBe("All categories12");
    expect(await page.textContent("#category-media")).toBe("Media3 · 0");
    expect(await page.textContent("#category-uncategorized")).toBe("Uncategorized0 · 3");
    expect(await pressed("category-all")).toBe("true");
    await page.click("#category-media");
    expect(await rowCount()).toBe(3);
    expect(await pressed("category-media")).toBe("true");
    expect(await pressed("category-all")).toBe("false");
    expect(await page.textContent("#filter-status-text")).toBe("Showing 3 of 12");
    expect(await page.textContent("#filter-status-detail")).toBe("Source: All · Category: Media");
    await page.click("#clear-filters");
    expect(await rowCount()).toBe(12);
    expect(await pressed("category-all")).toBe("true");
    await page.close();
  });

  it("the Mine / Pulled in / All filter narrows the list; Clear restores it", async () => {
    await open();
    expect(await page.textContent("#source-own")).toBe("Mine 3");
    expect(await page.textContent("#source-pulled")).toBe("Pulled in 8");
    expect(await page.textContent("#source-all")).toBe("All 12");
    await page.click("#source-own");
    expect(await rowCount()).toBe(3);
    expect(await pressed("source-own")).toBe("true");
    expect(await pressed("source-all")).toBe("false");
    await page.click("#source-pulled");
    expect(await rowCount()).toBe(8);
    expect(await page.textContent("#filter-status-text")).toBe("Showing 8 of 12");
    await page.click("#category-uncategorized");
    expect(await rowCount()).toBe(3);
    await page.click("#clear-filters");
    expect(await rowCount()).toBe(12);
    expect(await page.textContent("#filter-status-text")).toBe("Showing 12 of 12");
    expect(await pressed("source-all")).toBe("true");
    await page.close();
  });

  it("search respects the source filter", async () => {
    await open();
    await page.click("#source-pulled");
    await page.fill("#search-input", "watch a video");
    expect(await page.$$("#results-name-group")).toHaveLength(0);
    expect(await page.textContent("#no-results-message")).toBe("No skill matches 'watch a video'");
    await page.close();
  });
});
