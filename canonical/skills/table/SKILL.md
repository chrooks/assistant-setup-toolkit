---
name: table
description: "Render tabular data as a table — `/table md` for a quick read-only Markdown table, `/table html` for a self-contained interactive table with sort, filter, search, and column toggles. Use when showing comparative or multi-attribute data, lists of records, query results, or anything Chris should scan or manipulate as a table instead of prose."
argument-hint: "[md|html] <data, file, or description of what to tabulate>"
---

# /table — Markdown or Interactive Table Renderer

Chris reads and retains in table form. This skill turns tabular data into one of two
outputs, chosen by need:

- **`md`** — a read-only Markdown table, rendered inline in the response. The common case:
  data that just needs to be *seen*. Reach for this proactively whenever a response
  carries comparative or multi-attribute data.
- **`html`** — a single self-contained HTML file with sort, per-column filter, global
  search, and column toggles, opened in the browser. For data that needs to be
  *manipulated*: many rows, exploratory comparison, or something Chris will keep.

## Invocation

```
/table              <data>   → pick the mode by judgment (see below)
/table md           <data>   → force a Markdown table
/table html         <data>   → force the interactive HTML table
```

Aliases: `full`, `interactive`, `app` → `html`. `markdown`, `quick` → `md`.

`<data>` may be: data already in the conversation, a file to read (CSV/JSON/etc.),
a query result, or a prose description of what to tabulate.

## Mode Selection (bare `/table`)

Default to **`md`** — it is cheaper and covers most needs. Choose **`html`** only when
at least one is true:

- More than ~25 rows, or enough columns that scanning needs filtering.
- Chris will sort, filter, or search the data, not just read it once.
- Chris signals he wants to keep or revisit it ("a tool", "let me filter", "sortable").

When genuinely ambiguous, render `md` now and offer the `html` upgrade in one line.

## `md` Mode — Markdown Table

- Emit a GitHub-flavored Markdown table inline. No file, no browser.
- First row is headers; include the alignment row (`---`). Right-align numeric columns
  with `---:`.
- Escape literal pipes in cell values as `\|`. Replace newlines inside a cell with a
  space or `<br>`.
- Do **not** truncate rows or columns silently. If the data is large, render it and add
  one line: "That is N rows — say `/table html` for a sortable, filterable version."
- Keep cells terse and scannable. Lead with the column that anchors each row.

## `html` Mode — Interactive Table

The template at [`templates/table-template.html`](templates/table-template.html) is a
zero-dependency, single-file table whose filtering and sorting are ported from the
Cornerstone `/players` explorer (`FilterBar` + `playerFilters` + `SortControls`). It gives:

- **A composable filter builder** — pick a column, get the right input (text contains,
  a value dropdown for low-cardinality columns, or an operator `≥ ≤ = > <` + number for
  numeric columns), then **Add Filter**. Filters combine with **AND/OR** connectors, can
  be **NOT**-negated, grouped with **( )** parentheses, and drag-reordered. Evaluated
  recursively (AND binds tighter than OR), capped at 10 active filters.
- **Multi-key sort** — up to 3 keys, each with a direction toggle; click a header to sort
  by that column, or build secondary/tertiary keys in the Sort row.
- **Column toggles, global search, and pagination.**

Filter kinds are derived automatically from the column schema, so you do NOT hand-write
filters — just give good `type`s:

- `type: "number"` → numeric filter (operator + value), right-aligned, sorts numerically.
- `type: "string"` with ≤ 25 distinct values → a select dropdown filter.
- `type: "string"` with many distinct values → a text "contains" filter.

Fill three placeholders and open the result.

### Steps

1. **Shape the data** into two arrays:
   - `COLUMNS`: `[{ "key": "name", "label": "Name", "type": "string" }, ...]`
     - `key` matches the row object keys. `label` is the human header — **labels must be
       unique**, they key the filter-type dropdown.
     - `type` is `"string"` or `"number"` — `number` sorts numerically and right-aligns.
   - `DATA`: `[{ "name": "...", "pts": 12 }, ...]` — one object per row.
2. **Read** `templates/table-template.html` and replace, exactly:
   - `__TABLE_TITLE__` (appears twice: `<title>` and `<h1>`) → a short descriptive title.
   - `/*__TABLE_COLUMNS__*/[]` → the `COLUMNS` JSON (replace the whole `/*…*/[]` token).
   - `/*__TABLE_DATA__*/[]` → the `DATA` JSON (replace the whole `/*…*/[]` token).
   - **Make the JSON safe to sit inside `<script>`:** after `JSON.stringify`, a cell
     containing `</script>` would close the block and kill the page. Replace
     `</script` → `<\/script` and `<!--` → `<\!--` (both identical JSON). The simplest
     reliable fill is a tiny Python pass:
     ```python
     def js_safe(s): return s.replace("</script", "<\\/script").replace("</SCRIPT", "<\\/SCRIPT").replace("<!--", "<\\!--")
     html = html.replace("/*__TABLE_DATA__*/[]", js_safe(json.dumps(DATA))).replace("/*__TABLE_COLUMNS__*/[]", js_safe(json.dumps(COLUMNS)))
     ```
3. **Write** the filled HTML to a findable, repo-clean location:
   - Prefer `<cwd>/.table-exports/<slug>.html`. Create `.table-exports/` if missing.
   - `<slug>` is a short kebab-case name from the title. Add a number if it exists.
4. **Open** it: `open "<path>"` on macOS (`xdg-open` Linux, `start` Windows).
5. **Report** the absolute path in one line so Chris can find, move, or re-open it.

### Notes

- The template handles its own sort/filter/search/column-toggle — do not add libraries.
- Validate the JSON you inject; a trailing comma breaks the whole page.
- `.table-exports/` is a generated-output dir — mention it can be gitignored if the
  project does not already ignore it.

## Behavior

- No confirmation prompts. `/table md X` → table immediately. `/table html X` → build,
  open, report path.
- This skill is for *display*. It does not fetch or compute the data — it formats data it
  is given or can read.
- If the input is not actually tabular (no consistent columns), say so and suggest a list
  instead of forcing a table.
