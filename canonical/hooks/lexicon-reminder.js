#!/usr/bin/env node
// UserPromptSubmit hook: per-turn Lexicon coaching reminder.
//
// Re-injects a short reminder to use shared terms from ~/.claude/LEXICON.md,
// ~/.codex/LEXICON.md, and/or <project>/LEXICON.md on every user turn.
// This is the per-turn anti-drift guard that complements the @import of
// LEXICON.md in CLAUDE.md or AGENTS.md, which only loads at session start.
//
// Ported from lexicon-reminder.sh. `node {hook}` resolves identically on Mac,
// bare Windows, and Windows+WSL.
//
// Wire it in ~/.claude/settings.json (Claude Code):
//
//   { "hooks": { "UserPromptSubmit": [
//     { "hooks": [ { "type": "command", "command": "node ~/.claude/hooks/lexicon-reminder.js" } ] }
//   ] } }
//
// Codex CLI displays UserPromptSubmit additionalContext in the transcript, so
// canonical/hooks/wiring.yaml intentionally does not wire this hook for Codex.
//
// Disable for a session: CLAUDE_LEXICON_REMINDER=0 in the environment.
// Disable globally: touch ~/.claude/.lexicon-reminder.off or ~/.codex/.lexicon-reminder.off

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

// Per-turn nudge, not a rulebook. Research on recurring injected reminders:
// imperative + positive + primacy/recency ordering, few segments (models omit
// instructions under load), telegraphic. Each segment carries its rule plus an
// anchor token; full rationale lives once in CLAUDE.md (loaded at start) so it
// is not re-paid every turn. Segment order is locked by the test suite, the
// style rule last for recency. Keep the locked phrases out of this comment so
// the test's first-occurrence indexes land in the string below, not up here.
const REMINDER =
  "Lexicon reminder: use Lexicon terms and link each one (full rules in CLAUDE.md). Correct misuse, _Avoid_ synonyms, or fail to use the right term. Issue references: link with a description, never a bare #5. Visuals: /visualize (/table, /diagram) for concept shapes. OPERATIVE STYLE RULE: answer first; one idea per line; lists; ASD-STE100; plain words with a software engineer's depth; define each non-Lexicon technical term in one short clause at first use; no filler; code, commits, and PRs stay normal.";

function main() {
  const payload = readPayload();

  // Disable via env var
  if (process.env.CLAUDE_LEXICON_REMINDER === "0") return;

  // Disable via flag file
  const home = os.homedir();
  if (
    fs.existsSync(path.join(home, ".claude", ".lexicon-reminder.off")) ||
    fs.existsSync(path.join(home, ".codex", ".lexicon-reminder.off"))
  ) {
    return;
  }

  // Skip if no Lexicon is configured (no global or project LEXICON.md to
  // enforce). CONTEXT.md is the legacy name — accept it until repos migrate.
  const hasLexicon =
    fs.existsSync(path.join(home, ".claude", "LEXICON.md")) ||
    fs.existsSync(path.join(home, ".codex", "LEXICON.md")) ||
    fs.existsSync(path.join(process.cwd(), "LEXICON.md")) ||
    fs.existsSync(path.join(process.cwd(), "CONTEXT.md"));
  if (!hasLexicon) return;

  // Codex displays UserPromptSubmit additionalContext as transcript noise, so
  // this hook stays quiet there. Claude Code keeps the flat additionalContext shape.
  if (/"turn_id"\s*:/.test(payload)) return;

  // JSON.stringify reproduces the bash json_string escaping for free.
  process.stdout.write(
    `${JSON.stringify({ suppressOutput: true, additionalContext: REMINDER })}\n`,
  );
}

try {
  main();
} finally {
  process.exit(0);
}
