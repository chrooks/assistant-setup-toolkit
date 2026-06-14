---
name: lint
description: Health-check the LLM-Wiki knowledge base (Obsidian vault) — run a read-only structural scan (orphans, hubs/god-nodes, dead-ends, broken wikilinks, clusters), then review contradictions, stale claims, and gaps, propose fixes through an approval gate, log the pass, and file investigation questions to questions.md. Use when the user says "lint the wiki / my brain / knowledge base", "health-check the wiki", "find orphans / broken links / stale claims", or wants a periodic maintenance pass over the wiki. Pass an optional page or topic to focus on one neighborhood.
argument-hint: "[optional: a page slug or topic to focus on]"
disable-model-invocation: false
---

# Lint

The periodic health-check operation of the LLM-Wiki, alongside **ingest** (file a source)
and **query** (ask the wiki questions). Lint finds rot and keeps the wiki healthy as it
grows: structural problems, contradictions, stale claims, gaps, and unexplored threads.

You read and propose; the user approves; you write. **Nothing edits the wiki without the
gate** — same discipline as ingest's write gate. The bundled script is read-only and only
ever *counts*; all judgment and every write stays with you and the user.

## Step 0 — Resolve the vault

Read `~/.claude/knowledge-config.json` for `vaultPath`, `wikiDir` (same config ingest uses).

```bash
cat ~/.claude/knowledge-config.json
```

If missing or the path doesn't exist, ask the user before continuing — never guess. Then
skim `<wikiDir>/index.md` so you know the page landscape.

## Step 1 — Run the structural scan (read-only)

```bash
python3 ~/.claude/skills/lint/scripts/wiki-graph.py --top 10
```

The script (stdlib only, never writes) resolves `wikiDir` from the same config and prints:

- **Orphans** — content pages with 0 inbound links; unreachable by browsing.
- **Hubs / god-nodes** — top pages by inbound count; where the wiki is over-concentrated.
- **Dead-ends** — pages with 0 outbound links; candidates for missing cross-references.
- **Broken wikilinks** — genuine breaks: a `[[target]]` that exists nowhere *and* isn't a
  planned page (typo or rot). These are the ones to act on.
- **Planned forward-links** — unresolved `[[targets]]` that `questions.md` has registered as
  pages-to-build. Expected and low-priority; they clear as you build the pages. The script
  reads `questions.md` to make this distinction, so keep the backlog current.
- **Clusters** — connected components; islands hint at split or stranded topics.

Add `--json` if you want to post-process. The scan is whole-wiki and cheap; always run it
on the full vault even when the discussion is focused (Step 5).

## Step 2 — Read for the things the script can't see

The script finds structure, not meaning. Read the affected pages (and recent `log.md`
entries) to judge the three semantic concerns:

- **Contradictions** — claims that conflict across pages. Check whether existing
  `> [!warning] Contradiction` flags are now resolvable, and whether new conflicts exist.
- **Stale claims** — a claim a newer source has since superseded. There is **no script for
  this** — it's pure reading judgment. Look for old facts on hub pages especially.
- **Gaps / missing pages** — concepts mentioned all over but lacking their own page. The
  script's **broken wikilinks** and **dead-ends** are your best leads here.

Respect the ingest skill's `[inferred]` provenance tags: an `[inferred]` claim that newer
sources don't support is a prime stale-claim candidate. (Lint surfaces these tags; it
doesn't own the convention — see the ingest skill's "Claim provenance".)

## Step 3 — Triage to the top findings

Don't dump every nit. Lead with the highest-signal problems — a hub citing a stale claim,
a broken link that should be a real page, a genuine contradiction — and cap the
conversation at roughly the top 5–10. List minor ones in a single line so the user knows
they exist without drowning in them.

## Step 4 — Propose fixes, then write through the gate

Surface the proposed fixes and **wait for the user to approve** before writing anything.
Typical fixes, all gated:

- Add a missing cross-reference (`[[wikilink]]`) between two pages that should connect.
- Create a stub page for a broken link or a real gap, then link it both directions.
- Resolve or update a contradiction flag with the date and outcome.
- Correct or re-tag a stale claim (don't silently overwrite — note what changed and when).

Apply the formats in the ingest skill's `references/page-formats.md`. Prefer many small
focused pages; reuse existing pages over near-duplicates.

## Step 5 — Suggested investigation questions → `questions.md`

Lint's distinctive output. From sparse clusters, dangling hubs, and gaps, propose a few
**investigation questions** — threads worth sourcing or querying next (this is the user's
job: sourcing and direction). File approved ones into a single standing backlog at
`<wikiDir>/questions.md`, appended and **deduped** (don't re-add a question already there
or already answered). This pairs with **query**: pull a thread, investigate, file the
answer back as a page, and strike the question.

If `questions.md` doesn't exist yet, create it with a simple `# Open Questions` heading and
a one-line note that lint maintains it.

## Step 6 — Log the pass

Append one dated, greppable entry to `<wikiDir>/log.md` (same prefix style as ingest):

```markdown
## [<YYYY-MM-DD>] lint | <N orphans, M broken links, K stale flags, Q questions raised>

- Structure: <one-line scan summary>
- Fixes applied: [[Page A]] (added links), [[Stub B]] (new) | none
- Questions added: <count> to [[questions]]
```

The log entry plus the in-page fixes are the only persisted artifacts — there is **no
standalone report page** (it would just go stale).

## Focused mode

`/lint <page-or-topic>` still runs the whole-wiki scan (Step 1), but narrows Steps 2–5 to
that page's neighborhood — its inbound/outbound links and topically related pages. Use it
when you're already working in one area and want a deep check there rather than a full pass.

## Related operations

- **ingest** — file a new source into the wiki; owns the `[inferred]` provenance convention.
- **query** — ask questions against the wiki; consumes the `questions.md` backlog lint fills.
