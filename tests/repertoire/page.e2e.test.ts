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

  const open = async (hash = "", options: { permissions?: string[]; init?: () => void } = {}) => {
    page = await browser.newPage({ viewport: { width: 1440, height: 900 }, permissions: options.permissions });
    if (options.init) await page.addInitScript(options.init);
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
    expect(await page.textContent("#machine-stamp-counts")).toBe(
      "3 mine + 8 pulled in (1 desktop, 1 plugin) + 1 couldn't read = 12 all",
    );
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
    expect(await page.textContent("#filter-status-text")).toBe('Showing 4 of 12 · "watch a video"');
    expect(await page.isHidden("#more-matches")).toBe(true);
    await page.close();
  });

  it("arrow keys move the active option, Enter opens it, Esc clears", async () => {
    await open();
    await page.fill("#search-input", "watch a video");
    await page.keyboard.press("ArrowDown");
    expect(await page.getAttribute("#search-input", "aria-activedescendant")).toBe("row-watch-video");
    await page.keyboard.press("ArrowDown");
    expect(await page.getAttribute("#search-input", "aria-activedescendant")).toBe("row-cut-video");
    expect(await activeId()).toBe("search-input");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("Enter");
    expect(await page.textContent("#detail-name")).toBe("/watch-video");
    expect(await page.textContent("#detail-description")).toMatch(/^Load a video into context/);
    await page.keyboard.press("Escape");
    expect(await page.inputValue("#search-input")).toBe("");
    expect(await page.$$eval("#result-listbox .r", (n) => n.length)).toBe(12);
    expect(await page.getAttribute("#search-input", "aria-activedescendant")).toBeNull();
    expect(await page.$$("#result-list .r[aria-selected=true]")).toHaveLength(0);
    await page.close();
  });

  it("Esc clears the active row and scrolls the list back to the top", async () => {
    await open();
    await page.setViewportSize({ width: 1440, height: 400 });
    await page.fill("#search-input", "video");
    await page.keyboard.press("Escape");
    await page.keyboard.press("ArrowUp"); // The last row: the list scrolls down to it.
    expect(await page.getAttribute("#search-input", "aria-activedescendant")).toBe("row-broken");
    expect(await page.$eval("#result-list", (n) => n.scrollTop)).toBeGreaterThan(0);
    await page.keyboard.press("Escape");
    expect(await page.getAttribute("#search-input", "aria-activedescendant")).toBeNull();
    expect(await page.$$("#result-list .r[aria-selected=true]")).toHaveLength(0);
    expect(await page.$eval("#result-list", (n) => n.scrollTop)).toBe(0);
    await page.close();
  });

  it("a query with no match shows the message, Browse all, and the pointer, without a weak list", async () => {
    await open();
    expect(await page.getAttribute("#search-input", "aria-expanded")).toBe("true");
    await page.fill("#search-input", "bake sourdough");
    expect(await page.textContent("#no-results-message")).toBe("No skill matches 'bake sourdough'");
    expect(await page.getAttribute("#search-input", "aria-expanded")).toBe("false");
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

  it("the stamp and the source filter use the same words for the same numbers", async () => {
    await open();
    const stamp = (await page.textContent("#machine-stamp-counts"))!;
    const number = (text: string | null) => Number(/\d+/.exec(text ?? "")![0]);
    expect(stamp).toContain(`${number(await page.textContent("#source-own"))} mine`);
    expect(stamp).toContain(`${number(await page.textContent("#source-pulled"))} pulled in`);
    expect(stamp).toContain(`= ${number(await page.textContent("#source-all"))} all`);
    const unreadableRows = await page.$$eval("#group-couldnt-read .r", (n) => n.length);
    expect(stamp).toContain(`${unreadableRows} couldn't read`);
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
  const ids = (selector: string) => page.$$eval(selector, (nodes) => nodes.map((n) => n.id));
  const openRow = async (name: string) => {
    await page.click(`#row-${name}`);
    await page.waitForSelector("#usage-line:not([hidden])");
  };

  it("opens the detail pane in ranking order with tabs and a usage line", async () => {
    await open();
    await openRow("watch-video");
    expect(await ids("#detail-pane section, #detail-pane [role=tablist]")).toEqual([
      "detail-header", "usage-line", "detail-tabs", "detail-body", "trigger-phrases",
      "confused-with", "compare-panel", "handoff-strip",
    ]);
    expect(await page.textContent("#detail-crumb")).toBe("All › Media › watch-video");
    expect(await page.textContent("#usage-code")).toBe("/watch-video [a video URL or a path to a local video file]");
    expect(await page.textContent("#mode-legend")).toBe("auto = you + Claude · typed only = you · Claude only = Claude");
    expect(await page.textContent("#detail-trigger")).toBe(
      "Use when the user pastes a YouTube URL, drops a video file path, or says 'watch this video'.",
    );
    expect(await page.getAttribute("#tab-overview", "aria-selected")).toBe("true");
    expect(await page.isVisible("#overview-panel")).toBe(true);
    await page.click("#tab-source");
    expect(await page.getAttribute("#tab-source", "aria-selected")).toBe("true");
    expect(await page.getAttribute("#tab-overview", "aria-selected")).toBe("false");
    expect(await page.isHidden("#overview-panel")).toBe(true);
    expect(await page.textContent("#skill-source")).toContain("# /watch-video");
    await page.click("#tab-overview");
    expect(await page.isVisible("#overview-panel")).toBe(true);
    await page.close();
  });

  it("the SKILL.md tab shows the script-tag skill's body as text", async () => {
    await open();
    await openRow("script-tag");
    await page.click("#tab-source");
    expect(await page.textContent("#skill-source")).toContain("</script>");
    expect(dialogs).toEqual([]);
    await page.close();
  });

  it("Copy writes the usage line to the clipboard", async () => {
    await open("", { permissions: ["clipboard-read", "clipboard-write"] });
    await openRow("watch-video");
    await page.click("#copy-usage");
    await page.waitForFunction(() => document.getElementById("copy-feedback")?.textContent === "Copied");
    expect(await page.getAttribute("#copy-feedback", "aria-live")).toBe("polite");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      "/watch-video [a video URL or a path to a local video file]",
    );
    await page.close();
  });

  it("Copy falls back when navigator.clipboard is missing (plain http)", async () => {
    await open("", { init: () => Object.defineProperty(navigator, "clipboard", { value: undefined }) });
    expect(await page.evaluate(() => navigator.clipboard)).toBeUndefined();
    await openRow("watch-video");
    await page.click("#copy-usage");
    await page.waitForFunction(() => document.getElementById("copy-feedback")?.textContent === "Copied");
    await page.close();
  });

  it("when every copy method fails, Copy selects the text and says Press Ctrl+C", async () => {
    await open("", {
      init: () => {
        Object.defineProperty(navigator, "clipboard", { value: undefined });
        document.execCommand = () => false;
      },
    });
    await openRow("watch-video");
    await page.click("#copy-usage");
    await page.waitForFunction(() => document.getElementById("copy-feedback")?.textContent === "Press Ctrl+C to copy");
    expect(await page.evaluate(() => String(getSelection()))).toBe("/watch-video [a video URL or a path to a local video file]");
    await page.close();
  });

  const compareColumns = () => page.$$eval("#compare-table thead th.col", (n) => n.map((c) => c.textContent));

  it("confused-with rows compare up to three columns, then every Compare control is disabled", async () => {
    await open();
    await openRow("watch-video");
    expect(await page.$$eval("#confused-with .pair", (n) => n.map((p) => p.querySelector(".other")?.textContent))).toEqual([
      "/listen-audio", "/cut-video",
    ]);
    expect(await page.textContent("#confused-with .pair:first-child .diff")).toBe("Video with scene frames vs audio only");
    expect(await compareColumns()).toEqual(["/watch-video"]);
    expect(await page.$$eval("#compare-table tbody th", (n) => n.map((c) => c.textContent))).toEqual([
      "When it fires", "What it does", "Input / args", "Hands off to", "How it runs", "Source",
    ]);
    await page.click("#compare-listen-audio");
    expect(await compareColumns()).toEqual(["/watch-video", "/listen-audio"]);
    expect(await page.isDisabled("#compare-cut-video")).toBe(false);
    await page.click("#compare-cut-video");
    expect(await compareColumns()).toEqual(["/watch-video", "/listen-audio", "/cut-video"]);
    for (const id of ["#compare-listen-audio", "#compare-cut-video", "#compare-any-input"]) {
      expect(await page.isDisabled(id)).toBe(true);
    }
    const handsOff = await page.$$eval("#compare-table tbody tr:nth-child(4) td", (n) => n.map((c) => c.textContent));
    expect(handsOff).toEqual(["cut-video", "watch-video", "—"]);
    // Opening another skill starts a fresh comparison.
    await openRow("cut-video");
    expect(await compareColumns()).toEqual(["/cut-video"]);
    await page.close();
  });

  it("'+ Compare with any skill' offers every skill through a datalist", async () => {
    await open();
    await openRow("plain");
    expect(await page.$$("#confused-with .pair")).toHaveLength(0);
    expect(await page.getAttribute("#compare-any-input", "list")).toBe("compare-options");
    const options = await page.$$eval("#compare-options option", (n) => n.map((o) => (o as HTMLOptionElement).value));
    expect(options).toHaveLength(11);
    expect(options).toContain("watch-video");
    await page.fill("#compare-any-input", "typed-only");
    await page.press("#compare-any-input", "Enter");
    expect(await compareColumns()).toEqual(["/plain", "/typed-only"]);
    expect(await page.inputValue("#compare-any-input")).toBe("");
    await page.close();
  });

  it("the handoff strip shows one row per lane; See full chain filters to the lane in order; Clear restores", async () => {
    await open();
    await openRow("watch-video");
    const strips = await page.$$eval("#handoff-strip .lane", (lanes) =>
      lanes.map((l) => [...l.querySelectorAll(".n")].map((n) => n.textContent)),
    );
    expect(strips).toEqual([
      ["nothing before", "watch-video", "cut-video"],
      ["listen-audio", "watch-video", "cut-video"],
    ]);
    await page.click("#full-chain-audio-then-video");
    expect(await rowNames("#result-listbox")).toEqual(["/listen-audio", "/watch-video", "/cut-video"]);
    expect(await page.textContent("#filter-status-text")).toBe("Showing 3 of 12");
    expect(await page.textContent("#filter-status-detail")).toBe("Source: All · Category: All · Lane: Audio then video");
    expect(await pressed("lane-audio-then-video")).toBe("true");
    await page.click("#clear-filters");
    expect(await rowCount()).toBe(12);
    expect(await pressed("lane-audio-then-video")).toBe("false");
    await page.close();
  });

  it("typing a new query after See full chain searches every skill, not only the lane", async () => {
    await open();
    await openRow("listen-audio");
    await page.click("#full-chain-audio-then-video");
    expect(await rowCount()).toBe(3);
    await page.fill("#search-input", "plain");
    expect(await rowNames("#results-name-group")).toEqual(["/plain"]);
    expect(await pressed("lane-audio-then-video")).toBe("false");
    expect(await page.textContent("#filter-status-detail")).toBe("Source: All · Category: All");
    await page.fill("#search-input", "video");
    expect(await rowCount()).toBeGreaterThan(0);
    await page.close();
  });

  it("the rail's lane list filters to installed stages in order", async () => {
    await open();
    expect(await ids("#lane-list button")).toEqual(["lane-video-load-then-trim", "lane-audio-then-video"]);
    await page.click("#lane-video-load-then-trim");
    expect(await rowNames("#result-listbox")).toEqual(["/watch-video", "/cut-video"]);
    await page.click("#category-media");
    expect(await pressed("lane-video-load-then-trim")).toBe("false");
    expect(await rowCount()).toBe(3);
    await page.close();
  });

  it("keyboard reaches every control; roles and live regions are in place", async () => {
    await open();
    await openRow("watch-video");
    await page.focus("#search-input");
    const reached = new Set<string>();
    for (let i = 0; i < 80; i++) {
      await page.keyboard.press("Tab");
      const id = await activeId();
      if (id) reached.add(id);
    }
    expect(await page.$$eval("#result-listbox .r", (n) => n.every((r) => (r as HTMLElement).tabIndex === -1))).toBe(true);
    const expected = [
      ...(await ids("#category-list button")), ...(await ids("#lane-list button")),
      ...(await ids("#source-filter button")), "clear-filters", "copy-usage", "tab-overview",
      "compare-listen-audio", "compare-cut-video", "compare-any-input", "full-chain-video-load-then-trim",
      "full-chain-audio-then-video",
    ];
    expect(expected.filter((id) => !reached.has(id))).toEqual([]);
    // The list is one Tab stop: Tab never lands on a row, and the arrow keys reach every row.
    expect([...reached].filter((id) => id.startsWith("row-"))).toEqual([]);
    await page.focus("#search-input");
    await page.keyboard.press("Tab");
    expect(await activeId()).toBe("source-own");
    const lanes = await ids("#lane-list button");
    await page.focus(`#${lanes[lanes.length - 1]}`);
    await page.keyboard.press("Tab");
    expect(await activeId()).toBe("copy-usage"); // The next control after the list.
    await page.focus("#search-input");
    await page.keyboard.press("Escape"); // No active row: the first ArrowDown lands on the first row.
    const arrowed = new Set<string>();
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("ArrowDown");
      arrowed.add((await page.getAttribute("#search-input", "aria-activedescendant"))!);
    }
    expect([...arrowed].sort()).toEqual((await ids("#result-listbox .r")).sort());
    // Tabs use a roving focus: Tab reaches the selected tab, arrow keys reach the other.
    await page.focus("#tab-overview");
    await page.keyboard.press("ArrowRight");
    expect(await activeId()).toBe("tab-source");
    expect(await page.getAttribute("#tab-source", "aria-selected")).toBe("true");
    await page.keyboard.press("ArrowLeft");
    expect(await activeId()).toBe("tab-overview");
    expect(await page.getAttribute("#detail-tabs", "role")).toBe("tablist");
    expect(await page.getAttribute("#tab-overview", "role")).toBe("tab");
    expect(await page.getAttribute("#overview-panel", "role")).toBe("tabpanel");
    expect(await page.getAttribute("#lane-list button", "aria-pressed")).toBe("false");
    expect(await page.getAttribute("#result-listbox", "role")).toBe("listbox");
    expect(await page.getAttribute("#copy-feedback", "aria-live")).toBe("polite");
    const outline = await page.evaluate(() => {
      const button = document.getElementById("copy-usage")!;
      button.focus();
      return getComputedStyle(button).outlineStyle;
    });
    expect(outline).toBe("solid");
    await page.close();
  });
});
