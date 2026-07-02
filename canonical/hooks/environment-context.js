#!/usr/bin/env node
// SessionStart hook: tell the assistant what machine it's actually on.
//
// Chris works across several machines (MacBook, PC, work laptop, Hestia) and
// often connects via VS Code Remote-SSH. Without this, the assistant has no
// way to know it isn't sitting on his local machine and can suggest the wrong
// OS commands/paths. This fires every session, unconditionally, with one
// additionalContext line: hostname, OS, and whether the session is remote —
// plus a directive so the assistant actually adjusts its behavior instead of
// just having the fact available. No config, no per-machine profile, no
// off-switch — it's informational only and cheap enough to always run.
//
// Node, not bash, to match the sibling hooks and dodge shell portability
// traps. Built-in modules only — no dependencies.

import fs from "node:fs";
import os from "node:os";

// Keep in sync with the test's local copy in environment-context.test.js.
const OS_LABELS = { darwin: "macOS", linux: "Linux", win32: "Windows" };

function osLabel() {
  return OS_LABELS[os.platform()] || os.platform();
}

function isRemoteSsh() {
  return Boolean(process.env.SSH_CONNECTION || process.env.SSH_CLIENT);
}

function buildMessage() {
  const hostname = os.hostname();
  const platform = osLabel();

  if (isRemoteSsh()) {
    return (
      `You are running on ${hostname} (${platform}), connected via a remote SSH session ` +
      "(likely VS Code Remote-SSH). This is not Chris's local machine — use " +
      `${platform}-appropriate commands and paths.`
    );
  }

  return (
    `You are running locally on ${hostname} (${platform}). Use ${platform}-appropriate ` +
    "commands and paths, and don't assume this is a different one of Chris's machines."
  );
}

function main() {
  const message = buildMessage();
  process.stdout.write(JSON.stringify({ suppressOutput: true, additionalContext: message }));
}

try {
  // Drain stdin if the harness piped a payload; this hook's output doesn't
  // depend on it. Best-effort and non-blocking, matching quiz-me.js.
  try {
    fs.readFileSync(0);
  } catch {
    /* no stdin — fine */
  }
  main();
} catch {
  /* a hook must never block or fail a session */
}
process.exit(0);
