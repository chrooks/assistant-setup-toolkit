#!/usr/bin/env bash
# UserPromptSubmit hook: per-turn Lexicon coaching reminder.
#
# Re-injects a short reminder to use Lexicon terms from ~/.claude/CONTEXT.md,
# ~/.codex/CONTEXT.md, and/or <project>/CONTEXT.md on every user turn.
# This is the per-turn anti-drift guard that complements the @import of
# CONTEXT.md in CLAUDE.md or AGENTS.md, which only loads at session start.
#
# Wire it in ~/.claude/settings.json (Claude Code):
#
#   { "hooks": { "UserPromptSubmit": [
#     { "hooks": [ { "type": "command", "command": "bash ~/.claude/hooks/lexicon-reminder.sh" } ] }
#   ] } }
#
# Codex CLI displays UserPromptSubmit additionalContext in the transcript, so
# canonical/hooks/wiring.yaml intentionally does not wire this hook for Codex.
#
# Disable for a session: CLAUDE_LEXICON_REMINDER=0 in the environment.
# Disable globally: touch ~/.claude/.lexicon-reminder.off or ~/.codex/.lexicon-reminder.off

set -euo pipefail

# Guard: never block prompt submission on hook failure
trap 'exit 0' ERR

PAYLOAD="$(cat 2>/dev/null || true)"

# Disable via env var
if [ "${CLAUDE_LEXICON_REMINDER:-1}" = "0" ]; then
  exit 0
fi

# Disable via flag file
if [ -f "${HOME}/.claude/.lexicon-reminder.off" ]; then
  exit 0
fi
if [ -f "${HOME}/.codex/.lexicon-reminder.off" ]; then
  exit 0
fi

# Skip if no Lexicon is configured (no global or project CONTEXT.md to enforce)
HAS_LEXICON=0
[ -f "${HOME}/.claude/CONTEXT.md" ] && HAS_LEXICON=1
[ -f "${HOME}/.codex/CONTEXT.md" ] && HAS_LEXICON=1
[ -f "$(pwd)/CONTEXT.md" ] && HAS_LEXICON=1
if [ "$HAS_LEXICON" -eq 0 ]; then
  exit 0
fi

# Per-turn nudge, not a rulebook. Research on recurring injected reminders:
# imperative + positive + primacy/recency ordering, few segments (models omit
# instructions under load), telegraphic. Each segment carries its rule plus an
# anchor token; full rationale lives once in CLAUDE.md (loaded at start) so it
# is not re-paid every turn. Segment order is locked by the test suite, the
# style rule last for recency. Keep the locked phrases out of this comment so
# the test's first-occurrence indexes land in the string below, not up here.
# ponytail: short on purpose — re-injected every single turn.
REMINDER='Lexicon reminder: use Lexicon terms exactly; link each occurrence to its CONTEXT.md definition. Correct misuse, _Avoid_ synonyms, or fail to use the right term — briefly. Active every response, including after tool use and compaction. Full rules live in ~/.claude/CLAUDE.md and CONTEXT.md; this is the recency nudge, not the rulebook. Issue references: link every tracker issue with a short description — [#5 UI refactor](url) — never a bare #5. Visuals: route concept-shaped explanations (comparison, process, architecture, state, hierarchy) through /visualize, which renders via /table or /diagram; representational, not decorative; skip for nuance or narrative. NOW THE OPERATIVE STYLE RULE — apply to every explanatory response: lead with the answer; one idea per line; prefer lists and short stacked lines over prose; drop corporate and hedge filler; reread once and tighten. Precision and the Lexicon always win. This style governs explanatory prose only — code, commits, and PRs stay normal.'

json_string() {
  local value="$1"
  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  value="${value//$'\n'/\\n}"
  printf '"%s"' "$value"
}

REMINDER_JSON="$(json_string "$REMINDER")"

# Codex displays UserPromptSubmit additionalContext as hook context in the
# transcript, so this hook stays quiet there. Claude Code keeps the flat
# additionalContext shape.
if printf '%s' "$PAYLOAD" | grep -q '"turn_id"[[:space:]]*:'; then
  exit 0
else
  printf '{"suppressOutput":true,"additionalContext":%s}\n' "$REMINDER_JSON"
fi

exit 0
