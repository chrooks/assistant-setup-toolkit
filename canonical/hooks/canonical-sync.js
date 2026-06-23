#!/usr/bin/env node
// PostToolUse hook: auto-propagate canonical/ edits to Target Projections.
//
// When a Write or Edit touches a file under this repo's canonical/, runs
// the Setup Wizard in quiet mode to keep Assistant Homes and Target
// Projections in sync with the Canonical Assistant Source.
//
// Ported from canonical-sync.sh. `node {hook}` resolves identically on Mac,
// bare Windows, and Windows+WSL.
//
// Wire via canonical/hooks/wiring.yaml — the Setup Wizard registers it as a
// project-level hook in .claude/settings.json and .codex/hooks.json.
//
// Disable for a session: CANONICAL_SYNC=0 in the environment.
// Disable for this project: touch .canonical-sync.off

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(__filename);
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..", "..");

function readPayload() {
  try {
    const raw = fs.readFileSync(0, "utf-8").trim();
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function main() {
  // Disable via env var
  if (process.env.CANONICAL_SYNC === "0") return;

  // Disable via flag file. Keep the legacy Assistant Home flag as a fallback.
  if (
    fs.existsSync(path.join(REPO_ROOT, ".canonical-sync.off")) ||
    fs.existsSync(path.join(os.homedir(), ".claude", ".canonical-sync.off"))
  ) {
    return;
  }

  // PostToolUse hooks receive JSON on stdin with tool_input.file_path.
  const payload = readPayload();
  const filePath =
    payload?.tool_input?.file_path ??
    (typeof payload.file_path === "string" ? payload.file_path : "");
  if (!filePath) return;

  // Only trigger when the edited file is under this repo's canonical/ directory.
  const canonicalAbs = path.join(REPO_ROOT, "canonical") + path.sep;
  const isUnderCanonical =
    filePath.startsWith(canonicalAbs) ||
    filePath.startsWith("canonical/") ||
    filePath.startsWith("canonical\\");
  if (!isUnderCanonical) return;

  // Only run if this looks like the toolkit repo (has manifests/install.yaml).
  if (!fs.existsSync(path.join(REPO_ROOT, "manifests", "install.yaml"))) return;

  // Run Setup Wizard in quiet mode, all targets, default install, no fetch.
  try {
    spawnSync(
      "npm",
      [
        "run",
        "setup",
        "--",
        "--claude",
        "--codex",
        "--default",
        "--no-fetch",
        "--quiet",
        "--overwrite",
      ],
      { cwd: REPO_ROOT, stdio: "ignore", shell: process.platform === "win32" },
    );
  } catch {
    // Sync is best-effort; never block tool completion on failure.
  }
}

try {
  main();
} finally {
  process.exit(0);
}
