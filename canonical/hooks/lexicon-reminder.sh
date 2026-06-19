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

REMINDER='Lexicon reminder: use Lexicon terms strictly (see ~/.claude/CONTEXT.md or ~/.codex/CONTEXT.md, plus any project CONTEXT.md). Link every occurrence of every Lexicon term to its definition in the matching CONTEXT.md, e.g. [Seam](~/.claude/CONTEXT.md). Correct the user when they misuse a Lexicon term, use an _Avoid_ synonym, or fail to use the established Lexicon term when one clearly applies. Keep corrections brief so the shared language becomes natural. ACTIVE EVERY RESPONSE, including after long sessions, tool use, and compaction. Issue references: render every tracker-issue mention as a markdown link with a short description — [#5 UI refactor](https://github.com/.../issues/5) — never a bare #5; if you genuinely cannot resolve the URL, still write #5 short description and flag the link as missing, but prefer resolving the real URL. Reach for the best-fit visual when a concept has a shape a visual carries (comparison, process, architecture, state, hierarchy) — route through /visualize, which picks the form and renders it via /table or /diagram; the visual must be representational, not decorative; skip it for nuance, narrative, or "why," and taper visuals as Chris owns a topic. NOW THE OPERATIVE STYLE RULE — apply it to every explanatory response: lead with the answer; one idea per line; aim sentences under ~25 words and break that aim only when precision needs it; reach for lists and short stacked lines first (in Markdown end each line with two trailing spaces so the break renders), prose only for genuine nuance. Ban these as filler, not absolutely — corporate filler (leverage, utilize, robust, seamless, synergy, delve, foster, facilitate, holistic, streamline), plain swaps (use not utilize, help not facilitate, enough not sufficient), and hedge-filler (just, really, basically, simply); legit technical uses survive. On a substantive explanation, reread it once and tighten. Precision and the Lexicon ALWAYS win: plainness shapes the wrapper, never blunts the idea; Lexicon terms are the exception to "avoid jargon"; define any unavoidable new technical term inline in one short clause. This style governs explanatory prose only — code, commits, and PRs stay normal.'

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
