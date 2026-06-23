#!/usr/bin/env node
// UserPromptSubmit hook: DevOS per-turn steering.
//
// Keeps a DevOS run alive across turns. If the current project has an active
// Throughline (a file matching feature_requests/*-throughline.md with
// `status: in_progress`), this re-injects a one-line reminder of the current
// stage and next action on every user turn. A skill is a one-shot injected
// prompt, so over a long session or after compaction the agent can forget a run
// is active; this hook fires every turn (guaranteed by the harness, not the
// model) and re-anchors it. It fires ONLY when an active Throughline exists, so
// it adds no noise otherwise.
//
// This is the same proven pattern as lexicon-reminder.js in this directory.
//
// Ported from devos-steering.sh. `node {hook}` resolves identically on Mac,
// bare Windows, and Windows+WSL.
//
// Wire it in ~/.claude/settings.json (Claude Code):
//
//   { "hooks": { "UserPromptSubmit": [
//     { "hooks": [ { "type": "command", "command": "node ~/.claude/hooks/devos-steering.js" } ] }
//   ] } }
//
// Disable for a session: CLAUDE_DEVOS_STEERING=0 in the environment.
// Disable globally: touch ~/.claude/.devos-steering.off or ~/.codex/.devos-steering.off
//
// Verify it is firing: set CLAUDE_DEVOS_STEERING_DEBUG=1 to append a timestamped
// breadcrumb to ~/.claude/devos-steering.log on each invocation.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function readPayload() {
  try {
    return fs.readFileSync(0, "utf-8");
  } catch {
    return "";
  }
}

/** Append an opt-in breadcrumb so we can confirm the hook fired. */
function debugLog(message) {
  if (process.env.CLAUDE_DEVOS_STEERING_DEBUG !== "1") return;
  try {
    const dir = path.join(os.homedir(), ".claude");
    fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
    fs.appendFileSync(
      path.join(dir, "devos-steering.log"),
      `${stamp}\t${process.cwd()}\t${message}\n`,
      "utf-8",
    );
  } catch {
    // Breadcrumb is best-effort.
  }
}

/** Extract the YAML frontmatter (text between the first two `---` lines). */
function readFrontmatter(file) {
  let text;
  try {
    text = fs.readFileSync(file, "utf-8");
  } catch {
    return "";
  }
  const lines = text.split(/\r?\n/);
  // Find the opening `---` fence (allow a leading blank line or BOM before it,
  // matching the bash awk that locates the first fence rather than requiring
  // line 0). Collect every line up to the closing fence.
  let start = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (/^---\s*$/.test(lines[i])) {
      start = i;
      break;
    }
  }
  if (start === -1) return "";
  const out = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^---\s*$/.test(lines[i])) break;
    out.push(lines[i]);
  }
  return out.join("\n");
}

function getField(frontmatter, key) {
  const match = frontmatter.match(new RegExp(`^${key}:\\s*(.*?)\\s*$`, "m"));
  return match ? match[1] : "";
}

function findThroughlines(cwd) {
  const dir = path.join(cwd, "feature_requests");
  let entries;
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return [];
  }
  return entries
    .filter((name) => name.endsWith("-throughline.md"))
    .sort()
    .map((name) => path.join(dir, name));
}

function main() {
  const payload = readPayload();

  // Disable via env var
  if (process.env.CLAUDE_DEVOS_STEERING === "0") return;

  // Disable via flag file
  const home = os.homedir();
  if (
    fs.existsSync(path.join(home, ".claude", ".devos-steering.off")) ||
    fs.existsSync(path.join(home, ".codex", ".devos-steering.off"))
  ) {
    return;
  }

  // Find an active Throughline in the current project.
  let active = "";
  let activeFm = "";
  for (const file of findThroughlines(process.cwd())) {
    const fm = readFrontmatter(file);
    if (/^status:\s*in_progress\s*$/m.test(fm)) {
      active = file;
      activeFm = fm;
      break;
    }
  }

  // No active run: stay silent.
  if (!active) {
    debugLog("silent: no active throughline");
    return;
  }

  const slug =
    getField(activeFm, "slug") ||
    path.basename(active).replace(/-throughline\.md$/, "");
  const stage = getField(activeFm, "stage");
  const next = getField(activeFm, "next_action");

  const reminder = `DevOS run active: ${slug} — stage=${stage}, next=${next}. The Throughline at ${active} is the source of truth; continue the run with /dev (the Conductor). Read the Throughline before acting, do the current stage's work, then advance stage and next_action.`;

  // Codex displays UserPromptSubmit additionalContext as transcript noise, so
  // this hook stays quiet there (it is wired claude-code-only in wiring.yaml).
  if (/"turn_id"\s*:/.test(payload)) {
    debugLog(`silent: codex turn_id (active=${slug} stage=${stage})`);
    return;
  }

  debugLog(`fired: ${slug} stage=${stage} next=${next}`);
  process.stdout.write(
    `${JSON.stringify({ suppressOutput: true, additionalContext: reminder })}\n`,
  );
}

try {
  main();
} finally {
  process.exit(0);
}
