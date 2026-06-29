#!/usr/bin/env node
// Self-contained Node test for quiz-me.js — no framework, just `node` + assert.
//
// It builds a throwaway HOME with a fake per-project transcript dir, sets file
// modification times with fs.utimesSync, runs the hook in a child process with
// HOME overridden (os.homedir() honors $HOME on POSIX), and asserts on stdout.
//
//   node canonical/hooks/quiz-me.test.js

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HOOK = path.resolve(__dirname, "quiz-me.js");

// Must mirror the hook's encoding exactly.
function encode(p) {
  return p.replace(/[/.]/g, "-");
}

function setup() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "quizme-"));
  const work = path.join(tmp, "work"); // the child's cwd
  fs.mkdirSync(work, { recursive: true });
  const home = path.join(tmp, "home");
  const projDir = path.join(home, ".claude", "projects", encode(work));
  return { tmp, work, home, projDir };
}

function writeJsonl(dir, name, ageMs) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, name);
  fs.writeFileSync(file, "{}\n");
  const seconds = (Date.now() - ageMs) / 1000;
  fs.utimesSync(file, seconds, seconds);
}

function run(work, home) {
  return execFileSync("node", [HOOK], {
    cwd: work,
    env: { ...process.env, HOME: home, CLAUDE_QUIZ_ME: "1" },
    encoding: "utf8",
  });
}

let failures = 0;
function check(name, ok) {
  console.log((ok ? "PASS" : "FAIL") + ": " + name);
  if (!ok) failures++;
}

const HOUR = 3600 * 1000;
const tmpDirs = [];

// (a) a prior transcript older than the gap -> emits the quiz offer
{
  const s = setup();
  tmpDirs.push(s.tmp);
  writeJsonl(s.projDir, "old.jsonl", 7 * HOUR);
  const out = run(s.work, s.home);
  check("prior session older than gap emits quiz offer", out.includes("quiz-me"));
}

// (b) a prior transcript newer than the gap -> silent
{
  const s = setup();
  tmpDirs.push(s.tmp);
  writeJsonl(s.projDir, "recent.jsonl", 1 * HOUR);
  const out = run(s.work, s.home);
  check("recent prior session stays silent", out.trim() === "");
}

// (c) no project directory -> silent
{
  const s = setup();
  tmpDirs.push(s.tmp);
  // deliberately do not create s.projDir
  const out = run(s.work, s.home);
  check("no project dir stays silent", out.trim() === "");
}

// (d) only a just-created current-session file (mtime now) -> silent
{
  const s = setup();
  tmpDirs.push(s.tmp);
  writeJsonl(s.projDir, "current.jsonl", 0);
  const out = run(s.work, s.home);
  check("only current-session file stays silent", out.trim() === "");
}

for (const dir of tmpDirs) {
  fs.rmSync(dir, { recursive: true, force: true });
}

if (failures === 0) {
  console.log("All quiz-me hook tests passed.");
  process.exit(0);
} else {
  console.error(failures + " quiz-me hook test(s) failed.");
  process.exit(1);
}
