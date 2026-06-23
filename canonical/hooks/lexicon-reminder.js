#!/usr/bin/env node
// UserPromptSubmit hook: per-turn Lexicon coaching reminder.
//
// Re-injects a short reminder to use shared terms from ~/.claude/CONTEXT.md,
// ~/.codex/CONTEXT.md, and/or <project>/CONTEXT.md on every user turn.
// This is the per-turn anti-drift guard that complements the @import of
// CONTEXT.md in CLAUDE.md or AGENTS.md, which only loads at session start.
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
  "Lexicon reminder: use Lexicon terms exactly; link each occurrence to its CONTEXT.md definition. Correct misuse, _Avoid_ synonyms, or fail to use the right term — briefly. Active every response, including after tool use and compaction. Full rules live in ~/.claude/CLAUDE.md and CONTEXT.md; this is the recency nudge, not the rulebook. Issue references: link every tracker issue with a short description — [#5 UI refactor](url) — never a bare #5. Visuals: route concept-shaped explanations (comparison, process, architecture, state, hierarchy) through /visualize, which renders via /table or /diagram; representational, not decorative; skip for nuance or narrative. NOW THE OPERATIVE STYLE RULE — apply to every explanatory response: lead with the answer; one idea per line; prefer lists and short stacked lines over prose; drop corporate and hedge filler; reread once and tighten. Precision and the Lexicon always win. This style governs explanatory prose only — code, commits, and PRs stay normal.";

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

  // Skip if no Lexicon is configured (no global or project CONTEXT.md to enforce)
  const hasLexicon =
    fs.existsSync(path.join(home, ".claude", "CONTEXT.md")) ||
    fs.existsSync(path.join(home, ".codex", "CONTEXT.md")) ||
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
