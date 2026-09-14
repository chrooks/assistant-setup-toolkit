# Preprocess / review — split the work by who must be present

Capture runs orders of magnitude faster than sit-down ingestion, and that is fine — it is
what makes capture free. The backlog problem is that every processing step waits for the
user, including the steps that don't need them. This flow splits the pipeline:

- **Preprocess** (unattended-safe): read, extract, triage, draft — everything mechanical —
  and stage the results.
- **Review** (the user's sit-down): walk a packet of finished drafts, decide each one,
  apply. An evening of ingestion becomes minutes of decisions.

The user stays the decision-maker. Nothing reaches `<wikiDir>/` or `backlog/` without
their word.

Fire on: "preprocess my inbox / my brain / my saves", "prep the review packet", "stage my
inbox" → preprocess. "Review my packet", "review the packet", "what's staged" → review.

## Staging — where preprocessed work waits

Everything lands in `<vaultPath>/staging/` — a **sibling of `<wikiDir>/`, never inside
it**. A draft sitting in the wiki tree is indistinguishable from held knowledge; staging
outside keeps the wiki's promise (it reflects what the user actually holds) intact.

    staging/
      review-packet.md    ← the digest the user reads at the sit-down
      drafts/             ← full drafts of NEW pages only

Two rules:

- **New pages get full drafts** in `staging/drafts/`, one file per page, frontmatter
  carrying a `target:` line with the destination path (e.g.
  `target: wiki/professional/reference/<name>.md`). Draft quality per
  [page-formats.md](./page-formats.md) — a draft the user approves should be movable
  as-is.
- **Edits to existing pages are described in the packet, never drafted as files.** The
  sync fabric keeps live pages moving between preprocess and review; a drafted diff rots.
  Describe the fold ("add X to [[page]] under 'Y'"), apply it fresh at review time.

## The preprocess pass

Unattended-safe means: it reads, extracts, drafts, stages, and archives capture-inbox
items it has staged. It never writes into `<wikiDir>/` or `backlog/`, never moves a file
out of `<rawDir>/inbox/`, and never asks a question — open questions go in the packet.

1. **Resolve the vault** (Step 0 of the parent skill). Read the existing packet if one
   exists — the packet is **additive**: new items get appended, undecided rows are left
   alone, and an item already in the packet is never re-staged.
2. **Karakeep** (mechanics: [karakeep-drain.md](./karakeep-drain.md)). There are no
   lanes — **every unarchived item is read and staged** (ADR decision 9). Per item:
   - **Extract first** — video via `watch-video`, images via `gallery-dl`, per the drain
     reference. This is the expensive half and it is exactly what the preprocess exists
     to move off the user's sit-down.
   - **Then stage by proposed outcome**, one packet entry each:
     - *ingest* → draft the wiki page(s) into `staging/drafts/` with the "filed from a
       save" provenance marker.
     - *to-engage / to-consume* → draft the row (What it is / Why I saved it / Size /
       Saved) into the packet. **Do not summarize the source** — a row helps the user
       choose when to spend the evening; it never replaces spending it.
     - *discard* → propose it with the source link, never a bare one-liner.
   - Mark every "Why I saved it" cell as a guess — the user confirms or rewrites it at
     review.
   - **Archive each Karakeep item after its packet entry (and draft, if any) is
     written** — the packet becomes the queue of record for staged items, and the next
     preprocess sees only new saves. Every entry carries the bookmark id, so undoing is
     one PATCH. **Never archive an item that failed to stage.**
3. **Vault inbox** (`<rawDir>/inbox/`): read each file fully and stage it — new-page
   drafts into `staging/drafts/`, existing-page folds described in the packet. These are
   usually self-authored, so the proposed disposition is normally "ingest"; the packet
   entry follows the presentation format from [inbox-walk.md](./inbox-walk.md)
   (What's in it / How I'd file it / one open question at most). **Leave the raw file in
   `inbox/`** — only a reviewed apply moves it to `archived/`.
4. **Extraction failures are non-blocking** — link + caption + a note always stage;
   mark the entry "extraction failed, link-only" and keep going. One dead reel never
   stops the pass.
5. **Close**: one `log.md` entry (`## [date] preprocess | N staged`),
   then remind the user to run the LiveSync publish step (`Scan storage and database
   again` → `Replicate now`) so the packet reaches their other devices.

## The review packet

Fixed shape — the user is deciding many items in a row and should never hunt for the
decision. Summary table first, then one section per item:

    # Review packet

    _N items awaiting decision · last preprocess YYYY-MM-DD_

    | # | Item | From | Proposed | Size |
    |---|------|------|----------|------|

    ## 1. <title>
    - **Source**: [raw file or original link] (karakeep: <id> where applicable)
    - **What it is**: <kind first, then one-clause substance — a report, not a pitch>
    - **Proposed**: ingest → [draft](drafts/<name>.md) · fold into [[page]] · to-engage row · to-consume row · discard
    - **Why saved** _(guess — confirm)_: <queue-row items only>
    - **Open question**: <only when a real decision is open>

**Every entry carries its source link — discards included.** A proposed discard is a
verdict the user may want to double-check against the actual item, and a one-liner with
no link forces them to ask. (Learned 2026-08-27, first review pass.)

## The review pass

The sit-down. Same pacing discipline as an inbox walk — one item at a time, approval
per item, never read ahead of the user's decision.

1. Open the packet, state the count, walk the items in order.
2. Per item the user says **approve**, **adjust** (then approve), or **reject**:
   - **Approve** — apply it: move the draft from `staging/drafts/` to its `target:`
     path, apply described folds against the *current* page state, update `index.md`,
     add the `log.md` entry, add backlog rows (with the confirmed "Why I saved it"),
     move the raw file `inbox/` → `archived/`. Then delete the item's packet section.
   - **Reject** — delete the draft, move the raw to `archived/` with nothing filed, log
     the drop. The existing drop semantics, unchanged.
3. **Finish**: when the packet is empty, delete `review-packet.md`. Close with the
   consolidated report (pages created / updated / rows added / dropped, same as the walk
   flows) and the LiveSync publish reminder.

A review where most items get approved unchanged is the success signal — it means
preprocess is drafting at the right quality. Most items becoming wiki pages is still the
failure signal it always was: triage too loose.

## Cadence

Manual trigger for now. Once the procedure has repeated enough to trust, promote the
preprocess pass to a scheduled run on the home server (same manual-until-earned lifecycle
as the Digest syncs) — the review pass stays human, always.
