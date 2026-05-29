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
# Wire it in ~/.codex/hooks.json (Codex CLI). Codex hooks are gated on
# [features] codex_hooks = true in ~/.codex/config.toml — confirm that's set:
#
#   { "hooks": { "UserPromptSubmit": [
#     { "hooks": [ { "type": "command", "command": "bash ~/.codex/hooks/lexicon-reminder.sh" } ] }
#   ] } }
#
# Disable for a session: CLAUDE_LEXICON_REMINDER=0 in the environment.
# Disable globally: touch ~/.claude/.lexicon-reminder.off

set -euo pipefail

# Guard: never block prompt submission on hook failure
trap 'exit 0' ERR

# Disable via env var
if [ "${CLAUDE_LEXICON_REMINDER:-1}" = "0" ]; then
  exit 0
fi

# Disable via flag file
if [ -f "${HOME}/.claude/.lexicon-reminder.off" ]; then
  exit 0
fi

# Skip if no Lexicon is configured (no global or project CONTEXT.md to enforce)
HAS_LEXICON=0
[ -f "${HOME}/.claude/CONTEXT.md" ] && HAS_LEXICON=1
[ -f "$(pwd)/CONTEXT.md" ] && HAS_LEXICON=1
if [ "$HAS_LEXICON" -eq 0 ]; then
  exit 0
fi

# Emit plain stdout. Both Claude Code and Codex UserPromptSubmit hooks accept
# plain text on stdout and inject it as developer context for the upcoming turn.
# This is intentional: Claude Code's structured output uses {"additionalContext": "..."}
# (flat) and Codex uses {"hookSpecificOutput": {..., "additionalContext": "..."}} (nested).
# Plain stdout sidesteps the shape difference and works on both surfaces.
printf '%s\n' 'Lexicon reminder: use Lexicon terms strictly (see ~/.claude/CONTEXT.md or ~/.codex/CONTEXT.md, plus any project CONTEXT.md). Speak in clean, colloquial prose — not dense, tech-y, or corporate — easy for anyone familiar with the terms to follow. Link every occurrence of every Lexicon term to its definition in the matching CONTEXT.md, e.g. [Seam](~/.claude/CONTEXT.md). Correct the user when they misuse a Lexicon term, use an _Avoid_ synonym, or fail to use the established Lexicon term when one clearly applies. Keep corrections brief so the shared language becomes natural. ACTIVE EVERY RESPONSE, including after long sessions, tool use, and compaction.'

exit 0
