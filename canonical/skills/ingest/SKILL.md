---
name: ingest
description: Ingest a source into the LLM-Wiki knowledge base (Obsidian vault) — read it, discuss takeaways, then update the wiki: a summary page, index.md, entity & concept pages with [[wikilinks]], contradiction flags, and a dated log entry. Use when the user says "ingest this", "add this to my brain / wiki / knowledge base", drops a file into raw-sources, or wants a source, article, paper, conversation, or URL filed into the wiki.
argument-hint: "[source: a raw-sources file path, a URL, pasted text, or 'this conversation']"
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

The source (`$ARGUMENTS`) is one of:

- **A file** already in `<vaultPath>/<rawDir>/` — read it in place.
- **A URL** — fetch it (WebFetch), and offer to save a markdown copy into `<rawDir>/` so the source stays immutable and local.
- **Pasted text** — offer to save it into `<rawDir>/` first; raw sources are the source of truth.
- **"this conversation"** — the source is the current thread. (This is how ingest absorbs the old `/capture` flow.) Write the wiki pages straight from the conversation; there's no raw file unless the user wants one saved.
- **An Apple Note** (macOS) — the user names a note they jotted in Apple Notes. Import it into `<rawDir>/` first, then ingest the imported file:

  ```bash
  # the script lives in this skill's scripts/ dir (Claude Code path shown):
  NTR=~/.claude/skills/ingest/scripts/notes-to-raw.sh
  bash "$NTR" --list                 # list exact note titles to find the right one
  bash "$NTR" "Exact Note Title"      # import one note by title (prints new raw-sources path)
  ```

  The first run triggers a one-time macOS Automation permission prompt — tell the user to approve it. Then read the printed file and continue from Step 2.

Never modify files under `<rawDir>/` — they're immutable.

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
4. **Contradictions** — where the source conflicts with an existing claim, don't silently overwrite. Flag it inline on the affected page with the date and both sources.
5. **log.md** — append one dated entry (see format reference).

Prefer many small focused pages over few large ones. Reuse existing pages over creating near-duplicates — search the wiki first.

## Step 5 — Report

Tell the user exactly which pages you created vs updated, and call out any contradiction
you flagged. Keep it to a short list so they can browse the results in Obsidian.

## Related operations

- **query** — ask questions against the wiki; good answers get filed back as pages.
- **lint** — periodic health check (contradictions, stale claims, orphans, gaps).
