import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createReporter } from "../../src/setup/reporter.js";

describe("reporter", () => {
  let logDir: string;
  let logged: string[];

  beforeEach(async () => {
    logDir = await fs.mkdtemp(path.join(os.tmpdir(), "reporter-test-"));
    logged = [];
    vi.spyOn(console, "log").mockImplementation((...args) => {
      logged.push(args.join(" "));
    });
    vi.spyOn(console, "error").mockImplementation((...args) => {
      logged.push(args.join(" "));
    });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(logDir, { recursive: true, force: true });
  });

  const make = (quiet = false) =>
    createReporter({ quiet, logDir, now: new Date("2026-07-13T12:00:00Z") });

  it("keeps detail out of the console but puts it in the log", async () => {
    const reporter = make();
    reporter.detail("every planned file");
    reporter.summary("the glance line");
    const logPath = await reporter.close();

    expect(logged).toEqual(["the glance line"]);

    const contents = await fs.readFile(logPath!, "utf8");
    expect(contents).toContain("every planned file");
    expect(contents).toContain("the glance line");
  });

  it("suppresses summary under quiet but still writes the log", async () => {
    const reporter = make(true);
    reporter.summary("glance");
    reporter.detail("detail");
    const logPath = await reporter.close();

    expect(logged).toEqual([]);

    const contents = await fs.readFile(logPath!, "utf8");
    expect(contents).toContain("glance");
    expect(contents).toContain("detail");
  });

  it("prints errors even under quiet", async () => {
    const reporter = make(true);
    reporter.error("it broke");
    await reporter.close();

    expect(logged).toEqual(["it broke"]);
  });

  it("keeps only the 10 newest logs", async () => {
    // 12 stale logs, ISO-stamped so a lexical sort is chronological.
    for (let i = 1; i <= 12; i += 1) {
      const stamp = `2026-07-13T10-${String(i).padStart(2, "0")}-00-000Z`;
      await fs.writeFile(path.join(logDir, `setup-${stamp}.log`), "old");
    }

    const reporter = make();
    reporter.summary("this run");
    await reporter.close();

    const remaining = (await fs.readdir(logDir)).filter((n) =>
      n.endsWith(".log"),
    );
    expect(remaining).toHaveLength(10);
    // This run stamps 12:00, later than every seeded 10:xx log, so it survives.
    expect(remaining).toContain("setup-2026-07-13T12-00-00-000Z.log");
  });

  it("never fails the run when the log cannot be written", async () => {
    // A path under a regular file cannot be created as a directory.
    const blocker = path.join(logDir, "blocker");
    await fs.writeFile(blocker, "not a directory");
    const reporter = createReporter({
      quiet: false,
      logDir: path.join(blocker, "logs"),
      now: new Date("2026-07-13T12:00:00Z"),
    });

    reporter.summary("work still happened");
    await expect(reporter.close()).resolves.toBeNull();
  });
});
