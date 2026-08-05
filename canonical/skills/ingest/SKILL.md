---
name: ingest
description: Ingest a source into the LLM-Wiki knowledge base (Obsidian vault) — read it, discuss takeaways, then update the wiki: a summary page, index.md, entity & concept pages with [[wikilinks]], contradiction flags, and a dated log entry. Use when the user says "ingest this", "add this to my brain / wiki / knowledge base", drops a file into raw-sources, or wants a source, article, paper, conversation, or URL filed into the wiki. Also clears a whole inbox backlog one file at a time — "ingest my inbox", "one at a time", "work through the backlog" — and drains the Karakeep phone-capture inbox ("drain karakeep", "ingest my saves / bookmarks").
argument-hint: "[source: a raw-sources file path, a URL, pasted text, 'inbox', or 'this conversation']"
disable-model-invocation: false
---

# Ingest

Integrate one source into a persistent, interlinked markdown wiki (the Karpathy LLM-Wiki
pattern). The wiki is a **compounding artifact** — don't just summarize the source in
isolation, weave it into what already exists: update entity pages, revise topic summaries,
flag contradictions, and keep the cross-references current.

You write the wiki; the user curates and directs. A single ingest commonly touches 5–15 pages.

## Step 0 — Resolve the vault

Read `~/.claude/knowledge-config.json` for `vaultPath`, `rawDir`, `wikiDir`.

```bash
cat ~/.claude/knowledge-config.json
```

If it's missing or the path doesn't exist, ask the user for the vault location before
continuing — never guess or write to the wrong vault. Then read the vault's own `CLAUDE.md`
(the **schema**) for that vault's conventions, and skim `<wikiDir>/index.md` so you know
what pages already exist.

## Step 1 — Acquire the source

`<rawDir>/inbox/` holds sources not yet ingested; `<rawDir>/archived/` holds already-ingested
sources. New captures land in `inbox/`; Step 6 moves them to `archived/` once ingestion
completes.

**Two inboxes, two flows:**

- **`<rawDir>/inbox/`** — files in the vault, usually things the user has already engaged
  with. "Ingest my inbox", "one at a time", "work through the backlog" →
  [references/inbox-walk.md](./references/inbox-walk.md): enumerate once, then run Steps 2–6
  per file in a fixed presentation format, stopping for approval before each write.
- **Karakeep** — the phone share-sheet capture inbox, usually things the user saved but
  *hasn't* dug into yet. "Drain karakeep", "ingest my saves/bookmarks" →
  [references/karakeep-drain.md](./references/karakeep-drain.md). Same one-at-a-time loop, but
  gated by a **four-way triage** — most items become a queue row in `backlog/`, not a wiki
  page. Filing an un-engaged save as knowledge is the failure mode that flow exists to prevent.

The source (`$ARGUMENTS`) is one of:

- **A file** already in `<vaultPath>/<rawDir>/` (`inbox/` or `archived/`) — read it in place.
- **A URL** — fetch it (WebFetch), and offer to save a markdown copy into `<rawDir>/inbox/` so the source stays immutable and local.
- **Pasted text** — offer to save it into `<rawDir>/inbox/` first; raw sources are the source of truth.
- **"this conversation"** — the source is the current thread. (This is how ingest absorbs the old `/capture` flow.) Write the wiki pages straight from the conversation; there's no raw file unless the user wants one saved.
- **An Apple Note** (macOS) — the user names a note they jotted in Apple Notes. Import it into `<rawDir>/inbox/` first, then ingest the imported file:

  ```bash
  # the script lives in this skill's scripts/ dir (Claude Code path shown):
  NTR=~/.claude/skills/ingest/scripts/notes-to-raw.sh
  bash "$NTR" --list                 # list exact note titles to find the right one
  bash "$NTR" "Exact Note Title"      # import one note by title (prints new raw-sources path)
  ```

  The first run triggers a one-time macOS Automation permission prompt — tell the user to approve it. Then read the printed file and continue from Step 2.

- **Video content** (a video URL or a local video file) — invoke the `watch-video` skill first to load it as transcript + frames; do not fetch or transcribe video yourself. Once it reports the video loaded and ready, treat its transcript as the source text and continue from Step 2 — read the transcript fully, and pull specific frames (per `watch-video`'s cache path) when a wiki page needs a visual reference. Offer to save the transcript into `<rawDir>/inbox/` so the source stays immutable and local, same as a URL.

Content under `<rawDir>/` is immutable — never edit it. It may be relocated (inbox → archived)
once ingested; that's a move, not a modification.

## Step 2 — Read it fully

Read the whole source before writing anything. If the markdown references local images
(e.g. under `raw-sources/assets/`), read the text first, then view the key images
separately for additional context — a single pass can't read inline images.

## Step 3 — Discuss takeaways (the write gate)

Surface the key takeaways to the user in a few lines and confirm emphasis **before** writing.
This is the safety gate for a multi-file write. Ask what to foreground if it's ambiguous.

## Step 4 — Write / update the wiki

Apply the formats in [references/page-formats.md](./references/page-formats.md):

1. **Summary page** — one page per source in `<wikiDir>/`. Create it, or revise it if this source was ingested before.
2. **index.md** — add (or update) the catalog line for the summary page under the right category.
3. **Entity & concept pages** — for each significant entity/concept, create its page if absent or fold the new facts into the existing one. Add `[[wikilinks]]` both directions (the new page links out; hub pages link back).
4. **Typed relations** — when the relationship between two pages is *explicit*, name it. A relation is a keyword prefixed onto a wikilink inside `## Related`:

       ## Related

       - supersedes [[old-approach]] — replaced after the 2026-07 reorg
       - applied_in [[cornerstone]] — versioning-as-idempotency for non-deterministic evals
       - [[ordinary-link]] — plain see-also, no keyword

   Exactly six keywords, and the list does not grow without a deliberate decision:

   | Keyword | Means | Inverse |
   |---|---|---|
   | `supersedes` | this replaced that | `superseded_by` |
   | `contradicts` | conflicting claims, unresolved | symmetric |
   | `derived_from` | page born from a source or session | — |
   | `part_of` | belongs to a hub or cluster | — |
   | `alternative_to` | considered and not chosen | symmetric |
   | `applied_in` | concept → the project where it was used | — |

   **Only type a relation the source or the page actually states. Never infer one from topic
   similarity** — a guessed relation puts a false claim into a graph that gets queried and
   trusted later, which is worse than leaving the link bare. Bare `[[X]]` is the untyped
   default and is the correct outcome for most links.

   Hub membership is now *computed* from inbound `part_of`, so don't declare a page a hub —
   point its members at it.

5. **Contradictions & provenance** — where the source conflicts with an existing claim, don't silently overwrite. Flag it inline on the affected page with the date and both sources, and add `contradicts [[other-page]]` to `## Related` so the conflict is findable rather than buried in prose. When you write a claim that isn't stated directly in any one source but is your own synthesis across several, mark it `[inferred]` so it reads as a conclusion, not a quote. See [references/page-formats.md](./references/page-formats.md) ("Claim provenance").
6. **log.md** — append one dated entry (see format reference).

Prefer many small focused pages over few large ones. Reuse existing pages over creating near-duplicates — search the wiki first.

## Step 5 — Report

Tell the user exactly which pages you created vs updated, and call out any contradiction
you flagged. Keep it to a short list so they can browse the results in Obsidian.

## Step 6 — Archive the source

If the source was a file in `<rawDir>/inbox/`, move it to `<rawDir>/archived/` now that
ingestion is complete — this is what marks it as done. Skip this step for "this
conversation" sources, or a file that already lived in `archived/`.

## Related operations

- **query** — ask questions against the wiki; good answers get filed back as pages.
- **lint** — periodic health check over the whole wiki: structural analysis (orphans, hubs, clusters via a bundled read-only script), contradictions, stale claims, gaps, and auto-suggested investigation questions filed to `questions.md`.
