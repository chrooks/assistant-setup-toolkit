# Wiki Page Formats

Templates the `ingest` skill applies. These are conventions, not rigid law — defer to the
vault's own `CLAUDE.md` if it specifies something different. Use today's date in
`YYYY-MM-DD` form. All dates are absolute, never "today" / "last week".

## Summary page (one per source)

Path: `<wikiDir>/<source-slug>.md` (kebab-case from the source title).

```markdown
---
type: source
title: <Source Title>
date_ingested: <YYYY-MM-DD>
source_path: raw-sources/<original-file-or-url>
tags: [<topic>, <topic>]
---

# <Source Title>

## Summary

<3–6 sentences: what this source is and its core claims, in plain language.>

## Key Points

- <point, linking entities/concepts inline: [[Entity Name]], [[Concept Name]]>
- <point>

## Connections

- How this relates to / extends / contradicts existing pages: [[Other Page]].

## Open Questions

- <anything unresolved worth a future query or source>
```

## Entity page

Path: `<wikiDir>/<entity-slug>.md`. An entity = a person, org, place, product, system —
something with a proper name. Accumulate across sources; don't overwrite, integrate.

```markdown
---
type: entity
title: <Entity Name>
tags: [<kind>]
---

# <Entity Name>

<Running description, revised as new sources arrive.>

## Facts

- <fact> — _([[Source Title]], <YYYY-MM-DD>)_

## Related

- [[Concept or Entity]]
```

## Concept page

Path: `<wikiDir>/<concept-slug>.md`. A concept = an idea, method, theme, or pattern.
Same accumulation rule as entities.

```markdown
---
type: concept
title: <Concept Name>
tags: [<area>]
---

# <Concept Name>

## What It Is

<Plain-language explanation.>

## How It Shows Up

- <observation / application> — _([[Source Title]])_

## Related

- [[Concept or Entity]]
```

## index.md catalog line

`index.md` is content-oriented — a catalog grouped by category (Sources, Entities,
Concepts). Add one line per page:

```markdown
- [[<page-slug>|<Page Title>]] — <one-line summary> _(<YYYY-MM-DD>)_
```

Keep category headings (`## Sources`, `## Entities`, `## Concepts`) and file each new page
under the right one.

## Contradiction flag

When a new source conflicts with an existing claim, flag it on the affected page rather
than silently overwriting:

```markdown
> [!warning] Contradiction (<YYYY-MM-DD>)
> [[New Source]] claims X, but [[Older Source]] (<date>) claimed Y. Unresolved.
```

## log.md entry

`log.md` is chronological and append-only. One entry per operation. Keep the prefix
consistent so it stays greppable (`grep "^## \[" log.md | tail -5`):

```markdown
## [<YYYY-MM-DD>] ingest | <Source Title>

- Summary page: [[<source-slug>]]
- Pages touched: [[Entity A]], [[Concept B]] (updated), [[Concept C]] (new)
- Contradictions: <none | brief note>
```
