#!/usr/bin/env node
// PostToolUse hook (matcher: Bash): living-diagram upkeep reminder.
//
// After a `git commit` in a repo that carries living-diagram models
// (docs/roadmap/*-model.json), injects a reminder to update the models when
// the commit touched source files but neither model. Silent in every other
// case: non-commit commands, repos without models, commits that already
// updated a model, docs-only commits, failed commits (HEAD older than 120s).
//
// Case: living-diagrams contract drifted the same day it was codified —
// "have we been updating the roadmap diagram?" (2026-07 loop audit).
//
// Wire via canonical/hooks/wiring.yaml. Claude-only.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const HEAD_MAX_AGE_SEC = 120;

function readPayload() {
  try {
    const raw = fs.readFileSync(0, "utf-8").trim();
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function git(cwd, args) {
  return execFileSync("git", args, { cwd, stdio: ["ignore", "pipe", "ignore"] })
    .toString()
    .trim();
}

function main() {
  const payload = readPayload();
  const command = payload?.tool_input?.command ?? "";
  if (!/\bgit\b[^|;&]*\bcommit\b/.test(command)) return;

  const cwd = payload?.cwd || process.cwd();
  let repoRoot;
  try {
    repoRoot = git(cwd, ["rev-parse", "--show-toplevel"]);
  } catch {
    return;
  }

  const modelDir = path.join(repoRoot, "docs", "roadmap");
  let models = [];
  try {
    models = fs.readdirSync(modelDir).filter((f) => f.endsWith("-model.json"));
  } catch {
    return; // repo doesn't carry living diagrams
  }
  if (models.length === 0) return;

  try {
    // Skip when the commit didn't actually land (failed hook, empty commit).
    const headTime = Number(git(repoRoot, ["log", "-1", "--format=%ct"]));
    if (Date.now() / 1000 - headTime > HEAD_MAX_AGE_SEC) return;

    const changed = git(repoRoot, [
      "diff-tree",
      "--no-commit-id",
      "--name-only",
      "-r",
      "HEAD",
    ])
      .split("\n")
      .filter(Boolean);

    const touchedModel = changed.some(
      (f) => f.startsWith("docs/roadmap/") && f.endsWith("-model.json"),
    );
    if (touchedModel) return;

    const touchedSource = changed.some(
      (f) => !f.startsWith("docs/") && !f.endsWith(".md"),
    );
    if (!touchedSource) return;
  } catch {
    return; // never block or noise on git errors
  }

  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PostToolUse",
        additionalContext:
          "This commit changed source files but no living-diagram model. Per the living-diagrams contract, update the docs/roadmap/*-model.json models (roadmap when issues changed; architecture when components or data flows changed) and rebuild — or state in one line why no update is needed.",
      },
    }),
  );
}

try {
  main();
} finally {
  process.exit(0);
}
