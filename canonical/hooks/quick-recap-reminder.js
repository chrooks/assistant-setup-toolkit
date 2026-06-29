#!/usr/bin/env node
// UserPromptSubmit hook: per-turn completion-status (Quick Recap) reminder.
//
// Re-injects a short nudge to end work-completing turns with a single
// 🟢/🟡/🔴 status line. This is the per-turn anti-drift guard that complements
// the full convention in ~/.claude/CLAUDE.md, which only loads at session start.
//
// Scope: ONLY turns that complete a unit of work (edits, commits, file/config
// changes, a built or wired feature). Pure Q&A and explanation skip it.
//
// `node {hook}` resolves identically on Mac, bare Windows, and Windows+WSL.
//
// Wire it in ~/.claude/settings.json (Claude Code):
//
//   { "hooks": { "UserPromptSubmit": [
//     { "hooks": [ { "type": "command", "command": "node ~/.claude/hooks/quick-recap-reminder.js" } ] }
//   ] } }
//
// Codex CLI displays UserPromptSubmit additionalContext in the transcript, so
// canonical/hooks/wiring.yaml intentionally does not wire this hook for Codex.
//
// Disable for a session: CLAUDE_QUICK_RECAP_REMINDER=0 in the environment.
// Disable globally: touch ~/.claude/.quick-recap-reminder.off

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

// Per-turn nudge, not a rulebook. Telegraphic, imperative; full rules live once
// in CLAUDE.md (loaded at start) so they are not re-paid every turn.
const REMINDER =
  "Quick-recap reminder: if this turn completes a unit of work (edits, commits, file/config changes, a built or wired feature), END the response with one status line — 🟢 finished / 🟡 non-routine follow-up remains, name it / 🔴 blocked on user input. Under 100 chars, at the very end, nothing after it (no ---, no spacer). Pure Q&A or explanation: skip the line.";

function main() {
  const payload = readPayload();

  // Disable via env var
  if (process.env.CLAUDE_QUICK_RECAP_REMINDER === "0") return;

  // Disable via flag file
  const home = os.homedir();
  if (
    fs.existsSync(path.join(home, ".claude", ".quick-recap-reminder.off")) ||
    fs.existsSync(path.join(home, ".codex", ".quick-recap-reminder.off"))
  ) {
    return;
  }

  // Codex displays UserPromptSubmit additionalContext as transcript noise, so
  // this hook stays quiet there. Claude Code keeps the flat additionalContext shape.
  if (/"turn_id"\s*:/.test(payload)) return;

  process.stdout.write(
    `${JSON.stringify({ suppressOutput: true, additionalContext: REMINDER })}\n`,
  );
}

try {
  main();
} finally {
  process.exit(0);
}
