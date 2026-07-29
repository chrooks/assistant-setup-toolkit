#!/usr/bin/env bash
#
# Ranked GitHub repo search for /build-or-buy.
#
# `gh search repos` defaults to --sort=best-match, which buries maintained
# projects under abandoned forks and one-off toys. This always sorts by stars,
# and unions a best-match pass back in so relevance is not lost.
#
# usage: ./search-github.sh "query one" ["query two" ...] [--lang go] [--topic cli] [--limit 25]
#
set -euo pipefail

LANG_FILTER=""
TOPIC_FILTER=""
LIMIT=25
QUERIES=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --lang)    LANG_FILTER="$2"; shift 2 ;;
    --topic)   TOPIC_FILTER="$2"; shift 2 ;;
    --limit)   LIMIT="$2"; shift 2 ;;
    -h|--help) sed -n '3,9p' "$0"; exit 0 ;;
    *)         QUERIES+=("$1"); shift ;;
  esac
done

if [[ ${#QUERIES[@]} -eq 0 ]]; then
  echo 'usage: search-github.sh "query one" ["query two" ...] [--lang go] [--topic cli] [--limit 25]' >&2
  exit 2
fi

command -v gh >/dev/null || { echo "gh not on PATH" >&2; exit 127; }
command -v jq >/dev/null || { echo "jq not on PATH" >&2; exit 127; }

# GitHub ANDs keywords across name+description only. Four keywords match almost
# nothing, and the handful of toys that survive then sort to the top no matter
# what --sort says. This is the actual cause of "it never finds the good repos".
for q in "${QUERIES[@]}"; do
  # shellcheck disable=SC2206
  words=($q)
  if [[ ${#words[@]} -gt 3 ]]; then
    echo "error: \"$q\" has ${#words[@]} keywords; GitHub ANDs them and returns near-nothing." >&2
    echo "       Use 2-3 keywords per query and pass more phrasings instead:" >&2
    echo "         search-github.sh \"scene detection\" \"video segmentation\" \"shot boundary\"" >&2
    exit 2
  fi
done

FIELDS='fullName,stargazersCount,pushedAt,license,language,description,url,isArchived'
TMP=$(mktemp)
trap 'rm -f "$TMP"' EXIT

# search <sort> <query>
search() {
  local sort="$1" query="$2"
  local -a args=(search repos)
  # ponytail: word-split the query on purpose — gh treats each word as a
  # keyword, which matches more real repos than a quoted phrase would.
  # shellcheck disable=SC2206
  local -a terms=($query)
  args+=("${terms[@]}" --limit "$LIMIT" --include-forks=false --archived=false --json "$FIELDS")
  [[ -n "$LANG_FILTER" ]] && args+=(--language "$LANG_FILTER")
  [[ -n "$TOPIC_FILTER" ]] && args+=(--topic "$TOPIC_FILTER")
  [[ "$sort" != "best-match" ]] && args+=(--sort "$sort" --order desc)
  gh "${args[@]}" 2>/dev/null || echo '[]'
}

for q in "${QUERIES[@]}"; do
  search stars "$q" >> "$TMP"
  search best-match "$q" >> "$TMP"
done

echo "| ★ | repo | last push | license | lang | what it does |"
echo "|---:|---|---|---|---|---|"

jq -r -s '
  add
  | unique_by(.fullName)
  | map(select(.isArchived | not))
  | sort_by(-.stargazersCount)
  | .[0:20][]
  | "| \(.stargazersCount) | [\(.fullName)](\(.url)) | \(.pushedAt[0:7]) | \(.license.key // "none") | \(.language // "-") | \((.description // "") | .[0:90] | gsub("\\|"; "/")) |"
' "$TMP"

TOTAL=$(jq -s 'add | unique_by(.fullName) | map(select(.isArchived | not)) | length' "$TMP")
echo
echo "_${TOTAL} unique non-archived repos across ${#QUERIES[@]} phrasing(s); top 20 shown, sorted by stars._"
