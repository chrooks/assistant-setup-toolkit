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

## Every item gets read (ADR decision 9)

Capture carries **no routing metadata**. There are no lanes and no capture tags — the
three that once existed (`ref`, `study`, `curious`) were removed 2026-09-14 and nothing
reads them.

The reason is worth keeping, because it will be proposed again: Karakeep's iOS share
extension cannot tag at save time, and tagging afterwards in the app costs a context
switch out of whatever the user was doing. In 40 days it happened zero times out of 153
saves. More decisively, the scheme assumed most saves were throwaway — and the user's
own account is the opposite: *"If I saved something to Karakeep then I probably wanted
the contents."*

**So treat every unarchived item as wanted.** Never propose a tagging scheme, never nag
about metadata, and never skip an item unread to save time. The drain's cost is real and
it is handled on the other side — by the **preprocess pass**
([preprocess-review.md](./preprocess-review.md)), which moves extraction and drafting to
unattended time so the user's sit-down is decisions only.

Drain **one item at a time**, oldest first unless told otherwise.

## Triage — the four outcomes

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
    BASE=http://localhost:8084/api/v1
    curl -s -H "Authorization: Bearer $KEY" "$BASE/bookmarks?limit=100" | jq .
    # single item with body: /bookmarks/{id}?includeContent=true

**Two API traps, both of which fail silently as an empty queue. Verified 2026-09-14.**

- **`limit` caps at 100.** A higher value returns `{"success":false,"error":{"name":
  "ZodError",...}}` with HTTP 200 and no `bookmarks` key — so `jq '.bookmarks|length'`
  reports **0**, and the drain looks finished when it has not started.
- **`?archived=false` does not filter on this version.** It returns the same empty
  shape. Pull unfiltered and filter client-side on `.archived`.

Always page to the end rather than trusting one response — 44 unarchived items sat
behind a `nextCursor` on the first page:

    : > all.json; cursor=""
    while :; do
      url="$BASE/bookmarks?limit=100"; [ -n "$cursor" ] && url="$url&cursor=$cursor"
      curl -s -H "Authorization: Bearer $KEY" "$url" > p.json
      jq -c '.bookmarks[]' p.json >> all.json
      cursor=$(jq -r '.nextCursor // empty' p.json); [ -z "$cursor" ] && break
    done
    jq -s '{total:length, unarchived:[.[]|select(.archived==false)]|length}' all.json

**Sanity-check the count before reporting it.** An empty queue and a malformed request
look identical through `jq`. If the queue reads as 0, confirm against the unfiltered
total before telling the user they are caught up.

Present the **unarchived count** first, then walk the queue **one item at a time**,
oldest first, using the presentation format in [inbox-walk.md](./inbox-walk.md) — same
format, with the triage decision standing in for "How I'd file it".

**Archive after processing** (never delete — the cached snapshot is link-rot insurance):

    curl -s -X PATCH -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
      -d '{"archived":true}' "$BASE/bookmarks/<id>" -o /dev/null

## Turning media into text

Short-form video and image posts need extraction before there's anything to triage.

### Video → `/watch-video`, always

**Anything with a video track goes through the `watch-video` Skill.** This is Step 1 of the
parent Skill and it is not optional here — the drain does not hand-roll video extraction.

    node ~/.claude/skills/watch-video/scripts/video.mjs "<url-or-file>" \
      --cookies ~/.config/yt-dlp/ig-cookies.txt

Pass `--cookies` **every time**. Without it the script falls back to the operator's own
logged-in Chrome profile, and a drain is bulk automation over saved bookmarks — exactly what
the burner account exists to keep off the real session.

Why this and not a bare `yt-dlp | whisper` chain: **`watch-video` reads the picture as well
as the audio.** It pulls captions or a transcript *and* samples frames — at 1 fps for clips
under two minutes, which is nearly every reel. Read the `grids[]` from its manifest, not the
individual frames.

That matters because **short-form video routinely carries its content as burned-in captions
over silent or music-only audio.** An audio-only path returns an empty transcript on those
and reports success. Learned the hard way on 2026-08-06: two items in one drain were written
off as unrecoverable, and both came back complete on a second pass through `watch-video` —
eight pressure cues and five named exercises, all of them on-screen text.

A `transcript.status` of `none` is therefore **not** a reason to give up on a reel. Check the
grids before concluding an item has no content.

### Images → `gallery-dl`

Still the right tool; `watch-video` handles video, not image slides.

- **Single image post** — fetch Karakeep's cached `imageAssetId` (never `screenshotAssetId`,
  which catches IG's login-wall overlay) and read it with vision.
- **Carousel** — Karakeep caches only slide 1; pull every slide with `gallery-dl`, ordered by
  `{num}` and never by filename (IG slide IDs are not monotonic).
- **A carousel with video slides is both jobs.** `gallery-dl` gets the slides; each `.mp4`
  among them then goes through `watch-video` as a local file path. That two-stage shape is
  what recovered the posture carousel.

Install paths, cookie-file format, and verified gotchas are in the homelab runbook 12 —
**do not reconstruct them from memory.**

**Failure is graceful and always non-blocking:** link + caption + note always land; the
transcript is best-effort. A dead extraction downgrades the item to link-only, it does not
stop the drain. But "the audio was empty" is not a dead extraction — see above.

## Cross-repo hand-off is propose/dispose

Gym and exercise content hands off to coach-homie as **candidates only** — drop source,
transcript, and plain descriptions flagged unvetted. `/ingest` never writes into coach-homie's
`EXERCISE_LEXICON.md`; a coach-homie session vets under its own vocabulary contract
(ADR decision 6).

## Finishing

Close with the same consolidated report as a file walk, plus the triage split — how many
became pages, how many became queue rows, how many were dropped. A drain where most items
became wiki pages is a signal the triage was too loose.
