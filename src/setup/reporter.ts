/**
 * Run reporting for the Setup Wizard.
 *
 * Two output channels, one Seam:
 *   - `detail(...)`  — the full per-file, per-source narration. Log file only.
 *   - `summary(...)` — the handful of lines a human needs at a glance. Console
 *                      (and the log file too, so the log is self-contained).
 *
 * The wizard used to print ~100 lines per run, over half of them a list of
 * every planned skill ZIP. Detail is not deleted — it moves to a log file the
 * footer links, so a closer look is one click away.
 */

import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";

/** How many past run logs to keep before pruning the oldest. */
const KEEP_LOGS = 10;

export interface Reporter {
  /** Full narration — written to the log file only. */
  detail(...args: unknown[]): void;
  /** Glance-level line — printed to the console and written to the log. */
  summary(...args: unknown[]): void;
  /** A problem — printed to stderr and written to the log, even when quiet. */
  error(...args: unknown[]): void;
  /** Flush buffered lines to disk. Returns the log path, or null if unwritable. */
  close(): Promise<string | null>;
}

export interface ReporterOptions {
  /** Suppress console output (errors still print). */
  readonly quiet: boolean;
  /** Directory to write run logs into. */
  readonly logDir: string;
  /** Timestamp for this run's log filename. */
  readonly now: Date;
}

const format = (args: readonly unknown[]): string =>
  args.map((a) => (typeof a === "string" ? a : String(a))).join(" ");

/**
 * Create a Reporter. Lines are buffered in memory and flushed once on close,
 * so a crashed run never leaves a half-written log and the happy path does a
 * single write.
 */
export function createReporter(options: ReporterOptions): Reporter {
  const lines: string[] = [];
  // Colons are legal in POSIX filenames but make paths awkward to select and
  // are outright illegal on Windows — use a filename-safe stamp.
  const stamp = options.now.toISOString().replace(/[:.]/g, "-");
  const logPath = path.join(options.logDir, `setup-${stamp}.log`);

  return {
    detail(...args: unknown[]) {
      lines.push(format(args));
    },
    summary(...args: unknown[]) {
      const line = format(args);
      lines.push(line);
      if (!options.quiet) console.log(line);
    },
    error(...args: unknown[]) {
      const line = format(args);
      lines.push(line);
      console.error(line);
    },
    async close(): Promise<string | null> {
      try {
        await fs.mkdir(options.logDir, { recursive: true });
        await fs.writeFile(logPath, lines.join(os.EOL) + os.EOL, "utf8");
        await pruneOldLogs(options.logDir);
        return logPath;
      } catch {
        // A log we cannot write must never fail the install — the run's real
        // work already happened, and the console still carried the summary.
        return null;
      }
    },
  };
}

/** Keep only the newest KEEP_LOGS run logs; drop the rest. */
async function pruneOldLogs(logDir: string): Promise<void> {
  try {
    const entries = await fs.readdir(logDir);
    // Filenames are ISO-stamped, so a lexical sort is a chronological sort.
    const logs = entries
      .filter((n) => n.startsWith("setup-") && n.endsWith(".log"))
      .sort()
      .reverse();
    for (const stale of logs.slice(KEEP_LOGS)) {
      await fs.rm(path.join(logDir, stale), { force: true });
    }
  } catch {
    // Pruning is housekeeping — never fail a run over it.
  }
}
