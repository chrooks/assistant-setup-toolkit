#!/usr/bin/env tsx
// Loop Audit extraction CLI — walks the Claude Code history archive and writes
// the human-turn corpus. See feature_requests/loop-audit-plan.md.
//
//   npm run loop-audit:extract -- [--archive DIR] [--days N] [--out FILE]

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { parseArgs } from "node:util";
import { extractArchive } from "../src/loop-audit/extract.js";

const DAY_MS = 24 * 60 * 60 * 1000;

const { values } = parseArgs({
  options: {
    archive: { type: "string", default: "/srv/claude-history" },
    days: { type: "string", default: "84" },
    out: { type: "string", default: "artifacts/loop-audit/corpus.jsonl" },
  },
});

const days = Number(values.days);
if (!Number.isFinite(days) || days <= 0) {
  console.error(`--days must be a positive number, got: ${values.days}`);
  process.exit(1);
}
if (!existsSync(values.archive!)) {
  console.error(`Archive not found: ${values.archive} (this tool runs on hestia)`);
  process.exit(1);
}

const since = new Date(Date.now() - days * DAY_MS);
const { turns, stats } = extractArchive(values.archive!, since);

mkdirSync(dirname(values.out!), { recursive: true });
writeFileSync(values.out!, turns.map((t) => JSON.stringify(t)).join("\n") + "\n");

const devices = Object.keys(stats.perDevice).length;
const perDevice = Object.entries(stats.perDevice)
  .map(([d, n]) => `${d}: ${n}`)
  .join("   ");
console.log(
  `Scanned ${stats.filesScanned} transcripts (${stats.filesInWindow} in window) across ${devices} devices`,
);
console.log(
  `Kept ${stats.turnsKept} human turns (dropped ${stats.turnsDropped}) from ${stats.sessions} sessions since ${since.toISOString().slice(0, 10)}`,
);
console.log(perDevice);
console.log(`Corpus: ${values.out}`);
