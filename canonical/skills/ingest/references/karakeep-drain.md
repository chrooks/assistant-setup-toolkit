# Karakeep drain — the phone-capture inbox

Karakeep (self-hosted on the home server) is the **Capture Inbox of record** for
phone share-sheet saves: IG reels, shorts, articles, repos. Distinct from `<rawDir>/inbox/`,
which holds files inside the vault. Both feed the same wiki; they need different handling.

Fire on: "drain karakeep", "ingest my saves/bookmarks", "process the capture inbox".

Design authority: the homelab repo's `docs/adr/0001-capture-pipeline.md`; operational detail
(tool paths, cookies, gotchas) lives in its runbook `12-karakeep-capture-inbox.md`. **Read the runbook
before the first drain in a session** — it holds the proven commands and their failure modes.

## The thing that makes this different from a file walk

Items in `<rawDir>/inbox/` are usually things the user has **already engaged with** — their own
notes, sermons, conversations. Filing them is bookkeeping.

Karakeep items are usually things they **saved but have not dug into yet**. Two failure modes
follow, and the triage below exists to prevent them:

- **The wiki becomes a graveyard of intentions** — pages about things they never actually
  watched, indistinguishable from pages about things they know cold. That corrupts the wiki's
  core promise: that it reflects what they actually hold.
- **The assistant does the engaging instead of them** — summarising a talk they saved *because it
  looked worth their time* means they get the digest and never watch it. That is the
  dependency pattern they explicitly build against.

So: **not every drained item becomes a wiki page.** Most don't.

## Lanes — the capture tag picks the path (ADR decision 8)

Saves carry one of three tags, chosen on the phone at save time. **Read the lane before
you read the item** — it decides how much work the item is worth.

| Tag | Means | What the drain does |
|---|---|---|
| `ref` | file it, don't study it | Full ingest. Bulk-friendly — several per session |
| `study` | this needs an evening | A `to-engage` row. Extraction is worth it here |
| `curious` | I looked, I'm done | **Never processed.** Archive unread, no page, no row |
| *(untagged)* | saved in a hurry | Exactly the old behavior — triage in conversation |

Three rules make this safe:

- **`curious` is archived without being opened.** Don't fetch it, don't transcribe it,
  don't summarise it. Report the count and archive. This bypass is the entire point — the
  saving comes from not draining, not from draining faster.
- **A tag is a routing instruction, not a verdict on quality.** If reading a `ref` item
  shows it is really a `study` item, say so and retag. Lanes are filtered queries, so
  retagging costs one call and nothing is lost.
- **Untagged is a first-class lane, not an error.** Never nag about missing tags. The
  system has to work when the user forgets, or it is friction pretending to be structure.

Default to draining **one lane at a time**, asking which if unstated. `ref` first is
usually right — it is the fastest to clear and it shrinks the queue visibly.

## Triage — for untagged items, and for retag calls

| Outcome | When | Where it lands |
|---|---|---|
| **Ingest now** | Reference-shaped — a technique, recipe, checklist, explainer. *Knowing it* is the whole point; there's nothing to "experience" | Wiki page, normal Steps 2–6 |
| **To-consume** | Leisure media they'll actually play or watch — a game, show, movie, book, album | A row on `backlog/to-consume.md` |
| **To-engage** | Anything else worth digging into themselves — an article, talk, repo, paper | A row on `backlog/to-engage.md` |
| **Discard** | Didn't hold up, or the thought has since been had | Nothing filed; say so |

**In all four cases, archive the item in Karakeep** (never delete). The cached snapshot is
link-rot insurance for reels that vanish.

### The queue rows are processed, not copied

`backlog/` is the *triaged* queue; Karakeep is the raw catch. A row is only worth writing if
it carries what a bookmark can't:

| Item | What it is | Why I saved it | Size | Saved |
|---|---|---|---|---|

- **What it is** — the kind of thing first (talk, repo, article), then the one-line substance.
- **Why I saved it** — reconstruct the hook the user had at save time. The most valuable column.
- **Size** — honest cost: runtime for video, rough read time otherwise.
- **Saved** — capture date, so a lint pass can surface six-month-old untouched rows.

Reading the source enough to fill those four columns is the *work* of the drain. A row that
just restates the title has done nothing for them.

### Provenance marker on pages born from un-engaged saves

A wiki page created from something the user hasn't personally engaged with carries a line under
its title:

    > _Filed from a save — the user hasn't engaged with the source directly._

Cheap, honest, and it lets a later lint ask whether a long-untouched page still earns space.

## Getting the queue

API key: `~/.config/karakeep/ingest.key` (chmod 600 — use it, never print it). Base URL
`http://localhost:8084/api/v1` from the home server itself.

    KEY=$(cat ~/.config/karakeep/ingest.key)
    curl -s -H "Authorization: Bearer $KEY" \
      "http://localhost:8084/api/v1/bookmarks?archived=false&limit=50" | jq .
    # single item with body: /bookmarks/{id}?includeContent=true

**Counting the lanes** — do this first, before reading anything. Lane membership is a
filtered query on the tag id; the bookmark never moves.

    # tag ids (stable, created 2026-08-05)
    curl -s -H "Authorization: Bearer $KEY" "$BASE/tags" \
      | jq -r '.tags[] | select(.name|IN("ref","study","curious")) | "\(.name)\t\(.id)"'

    # one lane's queue
    curl -s -H "Authorization: Bearer $KEY" "$BASE/tags/<tagId>/bookmarks" | jq '.bookmarks|length'

Untagged has no negative filter — pull the full unarchived queue and subtract the three
lanes client-side.

**Retagging** (when reading shows the lane was wrong) — attach and detach by name:

    curl -s -X POST -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
      -d '{"tags":[{"tagName":"study"}]}' "$BASE/bookmarks/<id>/tags"
    curl -s -X DELETE -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
      -d '{"tags":[{"tagName":"ref"}]}'   "$BASE/bookmarks/<id>/tags"

Present the **per-lane counts** first, then walk the chosen lane **one item at a time** using
the presentation format in [inbox-walk.md](./inbox-walk.md) — same format, with the triage
decision standing in for "How I'd file it".

`curious` is the exception: never walked. Report the count, archive the lane, move on.

    # archive a whole lane without reading it — curious only
    for id in $(curl -s -H "Authorization: Bearer $KEY" "$BASE/tags/<curiousId>/bookmarks" \
                | jq -r '.bookmarks[].id'); do
      curl -s -X PATCH -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
        -d '{"archived":true}' "$BASE/bookmarks/$id" -o /dev/null
    done

## Turning media into text

Short-form video and image posts need extraction before there's anything to triage. Full
commands, install paths, and verified gotchas are in the homelab runbook 12 — **do not reconstruct
them from memory.** The shape:

- **YouTube** — try captions first (`yt-dlp --skip-download --write-auto-subs`); no download,
  no cookies.
- **Video without captions / Instagram** — download with burner-account cookies, transcribe
  with local `faster-whisper` (CPU, `small`).
- **Single image post** — fetch Karakeep's cached `imageAssetId` (never `screenshotAssetId`,
  which catches IG's login-wall overlay) and read it with vision.
- **Carousel** — Karakeep caches only slide 1; pull every slide with `gallery-dl`, ordered by
  `{num}` and never by filename (IG slide IDs are not monotonic).

**Failure is graceful and always non-blocking:** link + caption + note always land; the
transcript is best-effort. A dead extraction downgrades the item to link-only, it does not
stop the drain.

## Cross-repo hand-off is propose/dispose

Gym and exercise content hands off to coach-homie as **candidates only** — drop source,
transcript, and plain descriptions flagged unvetted. `/ingest` never writes into coach-homie's
`EXERCISE_LEXICON.md`; a coach-homie session vets under its own vocabulary contract
(ADR decision 6).

## Finishing

Close with the same consolidated report as a file walk, plus the triage split — how many
became pages, how many became queue rows, how many were dropped. A drain where most items
became wiki pages is a signal the triage was too loose.
