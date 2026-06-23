#!/usr/bin/env node
// claude-notify.js — macOS banner + Pushover push when an assistant session
// finishes a turn (Stop) or needs your input (Notification).
//
// Ported from claude-notify.sh. `node {hook}` resolves identically on Mac,
// bare Windows, and Windows+WSL, so the toolkit wires every hook through node.
//
// Canonical Assistant Source: edit here, then `npm run setup` (or the
// canonical-sync hook) projects this into each Assistant Home and wires it
// against Stop + Notification per canonical/hooks/wiring.yaml.
//
// Quiet-debounce (Stop / "done" only):
//   When a turn finishes, wait DEBOUNCE_SEC. If a new prompt arrives in that
//   window you're actively working — stay silent. Only ping after real silence
//   (you walked away). Activity is stamped by notify-activity.js on
//   UserPromptSubmit. "needs-input" stays immediate: it's rarer, actionable,
//   and answering a permission prompt is not a UserPromptSubmit, so debouncing
//   it would misfire.
//
// The bash `( sleep; ping ) &` subshell becomes a detached child node process
// running this same file in __wait mode. The parent returns immediately so the
// hook never blocks the assistant; the child outlives it via child.unref().
//
// Pushover secrets are NOT stored here. They live in a private chmod-600 file
// the user creates once (surfaced as a Setup Wizard Next Step):
//   ~/.claude/secrets-pushover.env   with PUSHOVER_TOKEN= and PUSHOVER_USER=
// The Mac banner always fires; Pushover fires only when that file + both keys
// are present.
//
// Usage:
//   node claude-notify.js done          # Stop event (debounced)
//   node claude-notify.js needs-input   # Notification event (immediate)
//   node claude-notify.js __send "<title>" "<body>"   # internal: actually emit
//   node claude-notify.js __wait <title> <body> <actFile> <before>  # internal

import { spawn, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);

const DEBOUNCE_SEC = Number(process.env.NOTIFY_DEBOUNCE_SEC ?? 45);
const SECRETS_FILE =
  process.env.PUSHOVER_SECRETS_FILE ??
  path.join(os.homedir(), ".claude", "secrets-pushover.env");
const RUN_DIR =
  process.env.NOTIFY_RUN_DIR ?? path.join(os.homedir(), ".claude", "run");

/** Escape double quotes for embedding in the osascript string. */
function esc(value) {
  return String(value).replace(/"/g, '\\"');
}

function readPayload() {
  try {
    const raw = fs.readFileSync(0, "utf-8").trim();
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** Parse a KEY=VALUE secrets file, stripping optional surrounding quotes. */
function parseSecrets(file) {
  const out = {};
  let text;
  try {
    text = fs.readFileSync(file, "utf-8");
  } catch {
    return out;
  }
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    if (key) out[key] = value;
  }
  return out;
}

/** Fire the macOS banner (darwin only) and a Pushover push when secrets exist. */
async function emit(title, body) {
  if (process.platform === "darwin") {
    try {
      spawnSync("osascript", [
        "-e",
        `display notification "${esc(body)}" with title "${esc(title)}" sound name "Glass"`,
      ]);
    } catch {
      // Banner is best-effort.
    }
  }

  const secrets = parseSecrets(SECRETS_FILE);
  const token = secrets.PUSHOVER_TOKEN;
  const user = secrets.PUSHOVER_USER;
  if (token && user) {
    try {
      const form = new URLSearchParams({ token, user, title, message: body });
      await fetch("https://api.pushover.net/1/messages.json", {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      // Push is best-effort; never throw out of a hook.
    }
  }
}

function readStamp(actFile) {
  try {
    const n = Number.parseInt(fs.readFileSync(actFile, "utf-8").trim(), 10);
    return Number.isInteger(n) ? n : 0;
  } catch {
    return 0;
  }
}

function sessionKey(payload, cwd) {
  if (typeof payload.session_id === "string" && payload.session_id) {
    return payload.session_id;
  }
  return `cwd-${crypto.createHash("sha1").update(cwd).digest("hex").slice(0, 8)}`;
}

async function main() {
  const mode = process.argv[2] ?? "done";

  // --- Internal: emit the notification (banner + push) ---
  if (mode === "__send") {
    await emit(process.argv[3] ?? "Assistant", process.argv[4] ?? "Session update");
    return;
  }

  // --- Internal: detached debounce waiter ---
  if (mode === "__wait") {
    const [, , , title, body, actFile, beforeRaw] = process.argv;
    const before = Number.parseInt(beforeRaw ?? "0", 10) || 0;
    await new Promise((resolve) => setTimeout(resolve, DEBOUNCE_SEC * 1000));
    const after = readStamp(actFile);
    if (after <= before) {
      await emit(title, body);
    }
    return;
  }

  // --- Public modes: read the hook payload (JSON on stdin) ---
  const payload = readPayload();
  const cwd =
    typeof payload.cwd === "string" && payload.cwd ? payload.cwd : process.cwd();
  const project = path.basename(cwd);
  const message = typeof payload.message === "string" ? payload.message : "";
  const actFile = path.join(RUN_DIR, `notify-${sessionKey(payload, cwd)}.act`);

  if (mode === "needs-input") {
    // Immediate — no debounce. Run synchronously so we emit before exiting.
    spawnSync(process.execPath, [
      __filename,
      "__send",
      `⏳ ${project} — needs you`,
      message || "Assistant is waiting for your input",
    ]);
    return;
  }

  // mode === "done" (debounced). Return immediately; wait in a detached child.
  const title = `✅ ${project} — done`;
  const body = message || "Session finished responding";
  const before = readStamp(actFile);
  const child = spawn(
    process.execPath,
    [__filename, "__wait", title, body, actFile, String(before)],
    { detached: true, stdio: "ignore" },
  );
  child.unref();
}

main()
  .catch(() => {})
  .finally(() => process.exit(0));
