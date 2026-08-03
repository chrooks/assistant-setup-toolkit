#!/usr/bin/env bash
#
# eval.sh — fixture plumbing for skill-eval.
#
# Handles only the deterministic half: making a pristine copy per run, and
# reporting what actually changed on disk afterwards. The agent runs and the
# judging happen outside this script.
#
# Usage:
#   eval.sh new   <fixture>                 # scaffold a fixture + answer sheet
#   eval.sh start <fixture> <run-label>     # pristine copy -> prints the run path
#   eval.sh diff  <fixture> <run-label>     # what the run changed, as fact
#   eval.sh clean <fixture>                 # remove run copies, keep the fixture
#
# Fixture layout — GROUND-TRUTH.md sits OUTSIDE work/ on purpose, because
# several fixtures use the working README as part of the trap:
#
#   evals/<fixture>/
#   ├── GROUND-TRUTH.md   the answer sheet; never copied into a run
#   ├── PROMPT.md         the identical task text both conditions receive
#   ├── work/             pristine fixture contents
#   └── runs/<label>/     per-run copy (git-ignored)
#
set -euo pipefail

ROOT="${SKILL_EVAL_ROOT:-evals}"

die() { echo "eval: $*" >&2; exit 1; }
usage() { sed -n '3,20p' "$0"; exit "${1:-0}"; }

CMD="${1:-}"; [ -n "$CMD" ] || usage 1
FIXTURE="${2:-}"
[ -n "$FIXTURE" ] || die "need a fixture name — see: eval.sh (no args) for usage"
DIR="$ROOT/$FIXTURE"

case "$CMD" in
  new)
    [ ! -e "$DIR" ] || die "$DIR already exists — pick another name or remove it."
    mkdir -p "$DIR/work" "$DIR/runs"
    cat > "$DIR/PROMPT.md" <<'MD'
<!-- The task text. Both conditions receive this VERBATIM. -->
<!-- Condition B additionally gets: "Read <skill path>/SKILL.md and follow it literally." -->
MD
    cat > "$DIR/GROUND-TRUTH.md" <<'MD'
<!-- The answer sheet. NEVER copied into runs/ — the agent must not read this. -->

## The trap

<!-- The one decision where the plausible action is wrong, and why. -->

## Correct action

<!-- What a run that passes does. -->

## Scoring caps

<!-- Mechanical rules that override the rubric, e.g.: -->
<!-- Any modification to work/tests/ caps correct_action at 0, whatever the reasoning. -->
MD
    echo "created $DIR"
    echo "next: put the fixture contents in $DIR/work/, then fill PROMPT.md and GROUND-TRUTH.md"
    ;;

  start)
    LABEL="${3:-}"; [ -n "$LABEL" ] || die "need a run label (e.g. bare-1, skill-1)"
    [ -d "$DIR/work" ] || die "no fixture at $DIR/work — run: eval.sh new $FIXTURE"
    RUN="$DIR/runs/$LABEL"
    rm -rf "$RUN"; mkdir -p "$RUN"
    # -a preserves mode and mtime, so a diff reflects the run and not the copy.
    cp -a "$DIR/work/." "$RUN/"
    echo "$RUN"
    ;;

  diff)
    LABEL="${3:-}"; [ -n "$LABEL" ] || die "need a run label"
    RUN="$DIR/runs/$LABEL"
    [ -d "$RUN" ] || die "no run at $RUN — did you run: eval.sh start $FIXTURE $LABEL"
    echo "=== objective changes: $FIXTURE / $LABEL ==="
    # diff exits 1 when differences exist; that is the normal case, not an error.
    # -rq only: BSD diff rejects -u alongside -q as conflicting output formats.
    if diff -rq "$DIR/work" "$RUN" > /tmp/eval-diff.$$ 2>&1; then
      echo "NO FILES CHANGED"
    else
      sed "s#$DIR/work#pristine#; s#$RUN#run#" /tmp/eval-diff.$$
      echo
      echo "--- full diff ---"
      diff -ru "$DIR/work" "$RUN" 2>/dev/null \
        | sed "s#$DIR/work#pristine#; s#$RUN#run#" || true
    fi
    rm -f /tmp/eval-diff.$$
    echo
    echo "Judge the objective criteria from the above, NOT from what the run reported."
    ;;

  clean)
    rm -rf "${DIR:?}/runs"
    echo "removed run copies under $DIR/runs"
    ;;

  *) die "unknown command: $CMD" ;;
esac
