#!/usr/bin/env bash
# One runnable check for log-owed-stop.cjs: clean tree passes, dirty tree blocks, second pass yields. A crash fails.
set -euo pipefail
HOOK="$(cd "$(dirname "$0")" && pwd)/log-owed-stop.cjs"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
git -C "$T" init -q && git -C "$T" -c user.email=t@t -c user.name=t commit -q --allow-empty -m init
run() { echo "$1" | CLAUDE_PROJECT_DIR="$T" node "$HOOK"; }
out="$(run '{}')"; [ -z "$out" ] || { echo "FAIL: clean tree not silent"; exit 1; }; echo "clean tree: pass"
touch "$T/stray.md"
out="$(run '{}')"; grep -q '"decision":"block"' <<<"$out" || { echo "FAIL: dirty tree did not block"; exit 1; }; echo "dirty tree: blocks"
out="$(run '{"stop_hook_active":true}')"; [ -z "$out" ] || { echo "FAIL: second pass not silent"; exit 1; }; echo "second pass: yields"
