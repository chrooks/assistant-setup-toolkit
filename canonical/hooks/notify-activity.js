#!/usr/bin/env node
// notify-activity.js — stamp "you're actively working in this session" on every
// UserPromptSubmit. claude-notify.js reads this stamp to decide whether to stay
// quiet (you're here) or ping (you walked away). See claude-notify.js.
//
// Ported from notify-activity.sh: `node {hook}` is the only command prefix that
// resolves the same on Mac, bare Windows, and Windows+WSL, so every toolkit hook
// runs through node.
//
// Canonical Assistant Source: edit here; projected to each Assistant Home by
// the Setup Wizard / canonical-sync hook per canonical/hooks/wiring.yaml.

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function readPayload() {
  try {
    const raw = fs.readFileSync(0, "utf-8").trim();
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function main() {
  const runDir =
    process.env.NOTIFY_RUN_DIR ?? path.join(os.homedir(), ".claude", "run");
  const payload = readPayload();
  const cwd =
    typeof payload.cwd === "string" && payload.cwd ? payload.cwd : process.cwd();
  const sessionId =
    typeof payload.session_id === "string" && payload.session_id
      ? payload.session_id
      : `cwd-${crypto.createHash("sha1").update(cwd).digest("hex").slice(0, 8)}`;

  try {
    fs.mkdirSync(runDir, { recursive: true });
    fs.writeFileSync(
      path.join(runDir, `notify-${sessionId}.act`),
      `${Math.floor(Date.now() / 1000)}\n`,
      "utf-8",
    );
  } catch {
    // Stamping is best-effort; never block prompt submission on failure.
  }
}

try {
  main();
} finally {
  process.exit(0);
}
